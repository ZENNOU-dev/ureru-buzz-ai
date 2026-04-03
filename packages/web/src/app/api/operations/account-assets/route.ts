import { NextRequest, NextResponse } from "next/server";
import { adOrchSupabase } from "@/lib/ad-orch-supabase";

export const dynamic = "force-dynamic";

interface AssetRow {
  id: number;
  asset_type: string;
  asset_name: string;
  meta_asset_id: string;
  is_default: boolean;
}

interface AssetItem {
  id: number;
  assetName: string;
  metaAssetId: string;
  isDefault: boolean;
}

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("accountId");

  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }
  if (!adOrchSupabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const { data, error } = await adOrchSupabase
      .from("account_assets")
      .select("id, asset_type, asset_name, meta_asset_id, is_default")
      .eq("account_id", accountId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as AssetRow[];

    const toItem = (row: AssetRow): AssetItem => ({
      id: row.id,
      assetName: row.asset_name,
      metaAssetId: row.meta_asset_id,
      isDefault: row.is_default,
    });

    const facebookPages = rows.filter((r) => r.asset_type === "facebook_page").map(toItem);
    const pixels = rows.filter((r) => r.asset_type === "pixel").map(toItem);
    const instagramAccounts = rows.filter((r) => r.asset_type === "instagram_account").map(toItem);

    return NextResponse.json({ facebookPages, pixels, instagramAccounts });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
