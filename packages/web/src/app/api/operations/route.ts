import { NextRequest, NextResponse } from "next/server";
import { adOrchSupabase, fetchAllRows } from "@/lib/ad-orch-supabase";
import { resolveCreativeName } from "@/lib/extract-creative-name";
import { extractDriveFileId, driveThumbnailUrl, drivePreviewUrl } from "@/lib/drive-utils";

export const dynamic = "force-dynamic";

interface Agg {
  spend: number; cv: number; mcv: number; impressions: number; clicks: number;
}

function emptyAgg(): Agg {
  return { spend: 0, cv: 0, mcv: 0, impressions: 0, clicks: 0 };
}

function addAgg(a: Agg, r: Record<string, unknown>) {
  a.spend += Number(r.spend) || 0;
  a.cv += Number(r.cv) || 0;
  a.mcv += Number(r.mcv) || 0;
  a.impressions += Number(r.impressions) || 0;
  a.clicks += Number(r.clicks) || 0;
}

function buildMetrics(a: Agg) {
  return {
    cost: a.spend,
    cv: a.cv,
    cpa: a.cv > 0 ? Math.round(a.spend / a.cv) : null,
    ctr: a.impressions > 0 ? Math.round((a.clicks / a.impressions) * 10000) / 100 : null,
    cpc: a.clicks > 0 ? Math.round(a.spend / a.clicks) : null,
    mcvr: a.clicks > 0 ? Math.round((a.mcv / a.clicks) * 10000) / 100 : null,
    mcpa: a.mcv > 0 ? Math.round(a.spend / a.mcv) : null,
    lpcvr: a.mcv > 0 ? Math.round((a.cv / a.mcv) * 10000) / 100 : null,
    cvr: a.clicks > 0 ? Math.round((a.cv / a.clicks) * 10000) / 100 : null,
  };
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const platform = req.nextUrl.searchParams.get("platform") ?? "meta";
  const level = req.nextUrl.searchParams.get("level") ?? "campaign";
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  const adsetId = req.nextUrl.searchParams.get("adsetId");
  const fromDate = req.nextUrl.searchParams.get("from");
  const toDate = req.nextUrl.searchParams.get("to");

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  if (!adOrchSupabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const viewName = platform === "tiktok" ? "v_tiktok_performance" : "v_ad_performance";

    // Fetch all performance rows for this project
    const rows = await fetchAllRows((rangeFrom, rangeTo) => {
      let q = adOrchSupabase!
        .from(viewName)
        .select("date, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, creative_name, creative_url, spend, impressions, clicks, cv, mcv")
        .eq("project_id", projectId);
      if (fromDate) q = q.gte("date", fromDate);
      if (toDate) q = q.lte("date", toDate);
      if (campaignId) q = q.eq("campaign_id", campaignId);
      if (adsetId) q = q.eq("adset_id", adsetId);
      return q.range(rangeFrom, rangeTo);
    });

    if (level === "campaign") {
      const map = new Map<string, { name: string; agg: Agg }>();
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        const id = r.campaign_id as string;
        const entry = map.get(id) ?? { name: r.campaign_name as string, agg: emptyAgg() };
        addAgg(entry.agg, r);
        map.set(id, entry);
      }
      const result = Array.from(map.entries()).map(([id, { name, agg }]) => ({
        id, name, ...buildMetrics(agg),
      })).sort((a, b) => b.cost - a.cost);
      return NextResponse.json(result);
    }

    if (level === "adset") {
      const map = new Map<string, { name: string; campaignName: string; agg: Agg }>();
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        const id = r.adset_id as string;
        const entry = map.get(id) ?? { name: r.adset_name as string, campaignName: r.campaign_name as string, agg: emptyAgg() };
        addAgg(entry.agg, r);
        map.set(id, entry);
      }
      const result = Array.from(map.entries()).map(([id, { name, campaignName, agg }]) => ({
        id, name, campaignName, ...buildMetrics(agg),
      })).sort((a, b) => b.cost - a.cost);
      return NextResponse.json(result);
    }

    if (level === "ad") {
      // Build CR name → Drive URL fallback from creatives table
      const crDriveMap = new Map<string, string>();
      const { data: creatives } = await adOrchSupabase
        .from("creatives")
        .select("creative_name, cr_url")
        .eq("project_id", projectId);
      for (const cr of creatives ?? []) {
        if (cr.cr_url) crDriveMap.set((cr.creative_name as string).normalize("NFC"), cr.cr_url);
      }

      const map = new Map<string, { name: string; adsetName: string; creativeName: string | null; creativeUrl: string | null; agg: Agg }>();
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        const id = r.ad_id as string;
        if (!map.has(id)) {
          const crName = resolveCreativeName(r);
          map.set(id, {
            name: r.ad_name as string,
            adsetName: r.adset_name as string,
            creativeName: crName,
            creativeUrl: r.creative_url as string | null,
            agg: emptyAgg(),
          });
        }
        addAgg(map.get(id)!.agg, r);
      }

      const result = Array.from(map.entries()).map(([id, { name, adsetName, creativeName, creativeUrl, agg }]) => {
        const nfcCrName = creativeName?.normalize("NFC") ?? null;
        // Use creative_url from view, fallback to creatives table by CR name
        const driveUrl = creativeUrl || (nfcCrName ? crDriveMap.get(nfcCrName) : null) || null;
        const fileId = extractDriveFileId(driveUrl);
        return {
          id, name, adsetName, creativeName: nfcCrName,
          thumbnailUrl: fileId ? driveThumbnailUrl(fileId) : null,
          previewUrl: fileId ? drivePreviewUrl(fileId) : null,
          ...buildMetrics(agg),
        };
      }).sort((a, b) => b.cost - a.cost);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
