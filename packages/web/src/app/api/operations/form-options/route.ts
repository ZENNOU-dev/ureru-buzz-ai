import { NextRequest, NextResponse } from "next/server";
import { adOrchSupabase, fetchAllRows } from "@/lib/ad-orch-supabase";

export const dynamic = "force-dynamic";

const META_TOKEN = process.env.META_ACCESS_TOKEN;
const META_API = "https://graph.facebook.com/v22.0";

async function fetchCampaignStatuses(ids: string[]): Promise<Record<string, string>> {
  if (!META_TOKEN || ids.length === 0) return {};
  const statusMap: Record<string, string> = {};
  const batchSize = 50;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const res = await fetch(`${META_API}/${id}?fields=effective_status&access_token=${META_TOKEN}`);
          const data = await res.json();
          return { id, status: data.effective_status ?? "UNKNOWN" };
        } catch {
          return { id, status: "UNKNOWN" };
        }
      })
    );
    for (const r of results) statusMap[r.id] = r.status;
  }
  return statusMap;
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const platform = req.nextUrl.searchParams.get("platform") ?? "meta";

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  if (!adOrchSupabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const isTiktok = platform === "tiktok";
    const viewName = isTiktok ? "v_tiktok_performance" : "v_ad_performance";
    const adsetCol = isTiktok ? "adgroup_id" : "adset_id";
    const adsetNameCol = isTiktok ? "adgroup_name" : "adset_name";
    const selectFields = isTiktok
      ? "campaign_id, campaign_name, adgroup_id, adgroup_name, account_id"
      : "campaign_id, campaign_name, adset_id, adset_name, account_id";

    // Parallel fetches
    const [rows, accountsRes, articleLpsRes, catsContentsRes, catsConfigRes, presetsRes, geoPresetsRes, rulesRes, placementPresetsRes] = await Promise.all([
      fetchAllRows((from, to) =>
        adOrchSupabase!.from(viewName).select(selectFields)
          .eq("project_id", projectId).range(from, to)
      ),
      // Filter accounts by platform
      adOrchSupabase.from("ad_accounts")
        .select("account_id, account_name, is_target, platform, operator_name")
        .eq("project_id", projectId)
        .eq("platform", platform),
      adOrchSupabase.from("article_lps")
        .select("id, lp_name, base_url, appeal_name, is_active")
        .eq("project_id", projectId)
        .eq("is_active", true),
      adOrchSupabase.from("cats_contents")
        .select("cats_content_id, name, redirect_url, transition_type, is_active, article_lp_id")
        .eq("project_id", projectId)
        .eq("is_active", true),
      adOrchSupabase.from("cats_project_config")
        .select("platform, click_type, default_article_lp_id, default_client_code_id")
        .eq("project_id", projectId),
      adOrchSupabase.from("submission_presets")
        .select("*")
        .eq("project_id", projectId),
      adOrchSupabase.from("geo_targeting_presets")
        .select("id, name, config"),
      adOrchSupabase.from("account_rules")
        .select("id, account_id, rule_type, rule_name, meta_rule_id")
        .eq("rule_type", "value_rule"),
      adOrchSupabase.from("placement_presets")
        .select("id, name, config, is_advantage_plus"),
    ]);

    const campaignMap = new Map<string, { name: string; accountId: string | null }>();
    const adsetMap = new Map<string, { name: string; campaignId: string }>();

    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const cpnId = r.campaign_id as string;
      const cpnName = r.campaign_name as string;
      const accountId = (r.account_id as string) ?? null;
      if (cpnId && !campaignMap.has(cpnId)) campaignMap.set(cpnId, { name: cpnName, accountId });
      const asId = (r[adsetCol] ?? r.adset_id ?? r.adgroup_id) as string;
      const asName = (r[adsetNameCol] ?? r.adset_name ?? r.adgroup_name) as string;
      if (asId && !adsetMap.has(asId)) adsetMap.set(asId, { name: asName, campaignId: cpnId });
    }

    // Campaign statuses (Meta only)
    const campaignIds = Array.from(campaignMap.keys());
    const statusMap = !isTiktok ? await fetchCampaignStatuses(campaignIds) : {};

    const campaigns = Array.from(campaignMap.entries())
      .map(([id, { name, accountId }]) => ({
        id,
        name,
        status: statusMap[id] ?? "UNKNOWN",
        accountId,
      }))
      .sort((a, b) => {
        const order = (s: string) => s === "ACTIVE" ? 0 : s === "PAUSED" ? 1 : 2;
        const diff = order(a.status) - order(b.status);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });

    const adsets = Array.from(adsetMap.entries())
      .map(([id, { name, campaignId }]) => ({ id, name, campaignId }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Ad accounts (already filtered by platform)
    const accounts = (accountsRes.data ?? []).map((a: Record<string, unknown>) => ({
      accountId: a.account_id as string,
      accountName: a.account_name as string,
      isTarget: a.is_target as boolean,
      operatorName: (a.operator_name as string) ?? null,
    }));

    // Article LPs
    const lps = (articleLpsRes.data ?? []).map((lp: Record<string, unknown>) => ({
      id: lp.id as number,
      name: (lp.lp_name as string) ?? "",
      url: (lp.base_url as string) ?? "",
      appealName: (lp.appeal_name as string) ?? "",
    }));

    // CATS click URLs (always use redirect_url, resolve article LP name)
    const lpById = new Map(lps.map((lp) => [lp.id, lp]));
    const catsClickUrls = (catsContentsRes.data ?? []).map((cc: Record<string, unknown>) => {
      const lpId = cc.article_lp_id as number | null;
      const lp = lpId ? lpById.get(lpId) : null;
      return {
        id: cc.cats_content_id as number,
        name: (cc.name as string) ?? "",
        url: (cc.redirect_url as string) ?? "",
        articleLpName: lp ? (lp.appealName || lp.name) : null,
      };
    }).filter((c) => c.url);

    // CATS config
    const catsConfig = (catsConfigRes.data ?? []).find(
      (c: Record<string, unknown>) => (c.platform as string)?.toLowerCase() === platform
    );
    const clickType = (catsConfig as Record<string, unknown>)?.click_type as string ?? "middle_click";

    // Placement presets lookup
    const placementPresetMap = new Map<number, Record<string, unknown>>();
    for (const pp of placementPresetsRes.data ?? []) {
      const r = pp as Record<string, unknown>;
      placementPresetMap.set(r.id as number, r.config as Record<string, unknown> ?? {});
    }

    // Presets (resolve placement_preset_id → config)
    const presets = (presetsRes.data ?? []).map((p: Record<string, unknown>) => {
      const ppId = p.placement_preset_id as number | null;
      const ppConfig = ppId ? placementPresetMap.get(ppId) : null;
      return {
        id: p.id as number,
        presetName: p.preset_name as string,
        gender: (p.gender as string) ?? "all",
        ageMin: (p.age_min as number) ?? 18,
        ageMax: (p.age_max as number) ?? 65,
        defaultTitle: p.default_title as string | null,
        defaultBody: p.default_body as string | null,
        defaultDescription: p.default_description as string | null,
        geoPresetId: p.geo_preset_id as number | null,
        valueRuleId: p.value_rule_id as number | null,
        placementPresetId: ppId,
        placementConfig: ppConfig,
      };
    });

    // Geo presets
    const geoPresets = (geoPresetsRes.data ?? []).map((g: Record<string, unknown>) => ({
      id: g.id as number,
      name: g.name as string,
      config: g.config as Record<string, unknown>,
    }));

    // Value rules (filtered by accounts in this project)
    const accountIds = new Set(accounts.map((a: { accountId: string }) => a.accountId));
    const valueRules = (rulesRes.data ?? [])
      .filter((r: Record<string, unknown>) => accountIds.has(r.account_id as string))
      .map((r: Record<string, unknown>) => ({
        id: r.id as number,
        accountId: r.account_id as string,
        ruleName: r.rule_name as string,
        metaRuleId: r.meta_rule_id as string,
      }));

    return NextResponse.json({
      campaigns,
      adsets,
      accounts,
      articleLps: lps,
      catsClickUrls,
      clickType,
      presets,
      geoPresets,
      valueRules,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
