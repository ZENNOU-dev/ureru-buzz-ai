import { NextRequest, NextResponse } from "next/server";
import { adOrchSupabase, fetchAllRows } from "@/lib/ad-orch-supabase";
import { extractDriveFileId, driveThumbnailUrl, drivePreviewUrl } from "@/lib/drive-utils";
import { resolveCreativeName } from "@/lib/extract-creative-name";
import { PLACEMENT_GROUPS, getPlacementGroup, type PlacementGroupKey } from "@/lib/placement-groups";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const fromDate = req.nextUrl.searchParams.get("from");
  const toDate = req.nextUrl.searchParams.get("to");
  const placement = req.nextUrl.searchParams.get("placement") as PlacementGroupKey | null; // e.g. "ig_reels"
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  if (!adOrchSupabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    // 1. Get creatives list
    const creativesResult = await adOrchSupabase
      .from("creatives")
      .select("id, creative_name, cr_url, thumbnail_url")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (creativesResult.error) {
      return NextResponse.json({ error: creativesResult.error.message }, { status: 500 });
    }

    const knownNames = new Set((creativesResult.data ?? []).map((c) => (c.creative_name as string).normalize("NFC")));

    // 2. Get metrics — either from placement table or daily conversions
    const todayStr = new Date().toISOString().slice(0, 10);
    interface Agg { cv: number; mcv: number; spend: number; impressions: number; clicks: number; firstDate: string; lastDate: string; todayImpressions: number }
    const metricsMap = new Map<string, Agg>();

    if (placement) {
      const group = PLACEMENT_GROUPS.find((g) => g.key === placement);
      if (!group) {
        return NextResponse.json({ error: `Unknown placement: ${placement}` }, { status: 400 });
      }

      // Get CV/MCV action type config from account_conversion_events
      const { data: convEvents } = await adOrchSupabase
        .from("account_conversion_events")
        .select("event_role, meta_action_type, account_id");
      const cvActionTypes = new Map<string, string>(); // account_id → action_type
      const mcvActionTypes = new Map<string, string>();
      for (const e of convEvents ?? []) {
        if (e.event_role === "cv") cvActionTypes.set(e.account_id, e.meta_action_type);
        if (e.event_role === "mcv") mcvActionTypes.set(e.account_id, e.meta_action_type);
      }

      // Build ad_id → { CR name, account_id } mapping
      const adInfoMap = new Map<string, { crName: string; accountId: string }>();
      const adConvData = await fetchAllRows((rangeFrom, rangeTo) =>
        adOrchSupabase!
          .from("ad_daily_conversions")
          .select("ad_id, ad_name, creative_name, account_id")
          .eq("project_id", projectId)
          .range(rangeFrom, rangeTo)
      );
      const projectAdIds = new Set<string>();
      for (const row of adConvData) {
        const r = row as Record<string, unknown>;
        const adId = r.ad_id as string;
        projectAdIds.add(adId);
        if (!adInfoMap.has(adId)) {
          const name = resolveCreativeName(r);
          if (name) adInfoMap.set(adId, { crName: name, accountId: r.account_id as string });
        }
      }

      // Fetch placement metrics
      const placementData = await fetchAllRows((rangeFrom, rangeTo) => {
        let q = adOrchSupabase!
          .from("meta_metrics_by_placement")
          .select("date, ad_id, spend, impressions, inline_link_clicks, publisher_platform, platform_position, actions");
        if (fromDate) q = q.gte("date", fromDate);
        if (toDate) q = q.lte("date", toDate);
        return q.range(rangeFrom, rangeTo);
      });

      // Filter by project ad_ids + placement group, then aggregate
      for (const row of placementData) {
        const r = row as Record<string, unknown>;
        const adId = r.ad_id as string;
        if (!projectAdIds.has(adId)) continue;

        const pg = getPlacementGroup(r.publisher_platform as string, r.platform_position as string);
        if (pg !== placement) continue;

        const info = adInfoMap.get(adId);
        if (!info || !knownNames.has(info.crName)) continue;

        const entry = metricsMap.get(info.crName) ?? { cv: 0, mcv: 0, spend: 0, impressions: 0, clicks: 0, firstDate: "9999-99-99", lastDate: "0000-00-00" };
        entry.spend += Number(r.spend) || 0;
        entry.impressions += Number(r.impressions) || 0;
        entry.clicks += Number(r.inline_link_clicks) || 0;

        // Extract CV/MCV using account-specific action types
        const cvType = cvActionTypes.get(info.accountId);
        const mcvType = mcvActionTypes.get(info.accountId);
        const actions = r.actions as { action_type: string; value: string }[] | null;
        if (actions) {
          for (const a of actions) {
            if (cvType && a.action_type === cvType) entry.cv += Number(a.value) || 0;
            if (mcvType && a.action_type === mcvType) entry.mcv += Number(a.value) || 0;
          }
        }

        const d = r.date as string;
        if (d < entry.firstDate) entry.firstDate = d;
        if (d > entry.lastDate) entry.lastDate = d;
        metricsMap.set(info.crName, entry);
      }
    } else {
      // Default: use ad_daily_conversions (all placements)
      const metrics = await fetchAllRows((rangeFrom, rangeTo) => {
        let q = adOrchSupabase!
          .from("ad_daily_conversions")
          .select("date, ad_name, creative_name, cv, mcv, spend, impressions, clicks")
          .eq("project_id", projectId);
        if (fromDate) q = q.gte("date", fromDate);
        if (toDate) q = q.lte("date", toDate);
        return q.range(rangeFrom, rangeTo);
      });

      for (const row of metrics) {
        const r = row as Record<string, unknown>;
        const name = resolveCreativeName(r);
        if (!name || !knownNames.has(name)) continue;
        const entry = metricsMap.get(name) ?? { cv: 0, mcv: 0, spend: 0, impressions: 0, clicks: 0, firstDate: "9999-99-99", lastDate: "0000-00-00", todayImpressions: 0 };
        entry.cv += Number(r.cv) || 0;
        entry.mcv += Number(r.mcv) || 0;
        entry.spend += Number(r.spend) || 0;
        const dayImp = Number(r.impressions) || 0;
        entry.impressions += dayImp;
        entry.clicks += Number(r.clicks) || 0;
        const d = r.date as string;
        if (d < entry.firstDate) entry.firstDate = d;
        if (d > entry.lastDate) entry.lastDate = d;
        if (d === todayStr) entry.todayImpressions += dayImp;
        metricsMap.set(name, entry);
      }
    }

    // 3. Deduplicate creatives by NFC name
    const seenNames = new Map<string, (typeof creativesResult.data)[number]>();
    for (const cr of creativesResult.data ?? []) {
      const nfcName = (cr.creative_name as string).normalize("NFC");
      const existing = seenNames.get(nfcName);
      if (!existing || (!existing.cr_url && cr.cr_url)) {
        seenNames.set(nfcName, cr);
      }
    }

    // 4. Build result
    const result = Array.from(seenNames.values()).map((cr) => {
      const nfcName = (cr.creative_name as string).normalize("NFC");
      const m = metricsMap.get(nfcName);
      const fileId = extractDriveFileId(cr.cr_url);
      const spend = m?.spend ?? 0;
      const cv = m?.cv ?? 0;
      const mcv = m?.mcv ?? 0;
      const imp = m?.impressions ?? 0;
      const clicks = m?.clicks ?? 0;

      // Determine delivery status
      const hasAds = !!m; // has matching rows in ad performance
      const todayImp = m?.todayImpressions ?? 0;
      let deliveryStatus: "active" | "paused" | "not_delivered" | "not_submitted";
      if (!hasAds) deliveryStatus = "not_submitted";
      else if (imp === 0) deliveryStatus = "not_delivered";
      else if (todayImp > 0) deliveryStatus = "active";
      else deliveryStatus = "paused";

      return {
        id: String(cr.id),
        name: nfcName,
        thumbnailUrl: cr.thumbnail_url || (fileId ? driveThumbnailUrl(fileId) : null),
        previewUrl: fileId ? drivePreviewUrl(fileId) : null,
        cost: spend,
        cv,
        cpa: cv > 0 ? Math.round(spend / cv) : null,
        ctr: imp > 0 ? Math.round((clicks / imp) * 10000) / 100 : null,
        cpc: clicks > 0 ? Math.round(spend / clicks) : null,
        mcvr: clicks > 0 ? Math.round((mcv / clicks) * 10000) / 100 : null,
        mcpa: mcv > 0 ? Math.round(spend / mcv) : null,
        lpcvr: mcv > 0 ? Math.round((cv / mcv) * 10000) / 100 : null,
        cvr: clicks > 0 ? Math.round((cv / clicks) * 10000) / 100 : null,
        firstDeliveryDate: m && m.firstDate !== "9999-99-99" ? m.firstDate : null,
        lastDeliveryDate: m && m.lastDate !== "0000-00-00" ? m.lastDate : null,
        deliveryStatus,
        platform: "meta" as const,
      };
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
