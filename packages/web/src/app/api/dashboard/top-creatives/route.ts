import { NextRequest, NextResponse } from "next/server";
import { adOrchSupabase, fetchAllRows } from "@/lib/ad-orch-supabase";
import { extractDriveFileId, driveThumbnailUrl, drivePreviewUrl } from "@/lib/drive-utils";
import { resolveCreativeName } from "@/lib/extract-creative-name";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const month = req.nextUrl.searchParams.get("month");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  if (!adOrchSupabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let startDate: string, endDate: string;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    startDate = `${month}-01`;
    endDate = new Date(y, m, 0).toISOString().slice(0, 10);
  } else {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    endDate = now.toISOString().slice(0, 10);
  }

  let data: unknown[];
  try {
    data = await fetchAllRows((from, to) =>
      adOrchSupabase!.from("ad_daily_conversions")
        .select("ad_name, creative_name, cv, spend")
        .eq("project_id", projectId)
        .gte("date", startDate).lte("date", endDate)
        .range(from, to)
    );
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const map = new Map<string, { cv: number; spend: number }>();
  for (const row of data) {
    const r = row as Record<string, unknown>;
    const name = resolveCreativeName(r);
    if (!name) continue;
    const entry = map.get(name) ?? { cv: 0, spend: 0 };
    entry.cv += Number(r.cv) || 0;
    entry.spend += Number(r.spend) || 0;
    map.set(name, entry);
  }

  const names = Array.from(map.keys());

  const driveMap = new Map<string, { thumbnailUrl: string; previewUrl: string }>();
  if (names.length > 0) {
    // Supabase IN filter has limits, batch if needed
    const batchSize = 100;
    for (let i = 0; i < names.length; i += batchSize) {
      const batch = names.slice(i, i + batchSize);
      const { data: creatives } = await adOrchSupabase
        .from("creatives")
        .select("creative_name, cr_url, thumbnail_url")
        .in("creative_name", batch);
      for (const cr of creatives ?? []) {
        const fileId = extractDriveFileId(cr.cr_url);
        if (fileId) {
          driveMap.set(cr.creative_name, {
            thumbnailUrl: cr.thumbnail_url || driveThumbnailUrl(fileId),
            previewUrl: drivePreviewUrl(fileId),
          });
        } else if (cr.thumbnail_url) {
          driveMap.set(cr.creative_name, { thumbnailUrl: cr.thumbnail_url, previewUrl: "" });
        }
      }
    }
  }

  const result = Array.from(map.entries())
    .map(([name, { cv, spend }]) => ({
      creativeName: name,
      cv,
      cpa: cv > 0 ? `¥${Math.round(spend / cv).toLocaleString()}` : "-",
      thumbnailUrl: driveMap.get(name)?.thumbnailUrl ?? null,
      previewUrl: driveMap.get(name)?.previewUrl ?? null,
    }))
    .sort((a, b) => b.cv - a.cv)
    .slice(0, 10);

  return NextResponse.json(result);
}
