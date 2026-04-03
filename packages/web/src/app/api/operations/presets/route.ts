import { NextRequest, NextResponse } from "next/server";
import { adOrchSupabase } from "@/lib/ad-orch-supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  if (!adOrchSupabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const { data, error } = await adOrchSupabase
      .from("submission_presets")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Upsert placement_preset from placements array, return its id */
async function upsertPlacementPreset(
  name: string,
  placements: string[],
  existingId?: number | null
): Promise<number | null> {
  if (!adOrchSupabase || placements.length === 0) return null;

  // Map UI placement values to Meta API format
  const fbPositions: string[] = [];
  const igPositions: string[] = [];
  const publishers = new Set<string>();

  for (const p of placements) {
    if (p === "ig_reels") { igPositions.push("instagram_reels"); publishers.add("instagram"); }
    if (p === "ig_feed") { igPositions.push("feed"); publishers.add("instagram"); }
    if (p === "ig_stories") { igPositions.push("instagram_stories"); publishers.add("instagram"); }
    if (p === "ig_other") { igPositions.push("instagram_explore", "instagram_explore_grid_home"); publishers.add("instagram"); }
    if (p === "fb_reels") { fbPositions.push("facebook_reels", "facebook_reels_overlay"); publishers.add("facebook"); }
    if (p === "fb_feed") { fbPositions.push("feed"); publishers.add("facebook"); }
    if (p === "fb_stories") { fbPositions.push("facebook_stories"); publishers.add("facebook"); }
    if (p === "fb_other") { fbPositions.push("marketplace", "search", "instream_video"); publishers.add("facebook"); }
    if (p === "audience_network") { publishers.add("audience_network"); }
  }

  const config = {
    publisher_platforms: Array.from(publishers),
    ...(fbPositions.length > 0 ? { facebook_positions: fbPositions } : {}),
    ...(igPositions.length > 0 ? { instagram_positions: igPositions } : {}),
  };

  if (existingId) {
    const { data } = await adOrchSupabase
      .from("placement_presets")
      .update({ name, config, updated_at: new Date().toISOString() })
      .eq("id", existingId)
      .select("id")
      .single();
    return data?.id ?? existingId;
  }

  // Try insert, on conflict update by name
  const { data } = await adOrchSupabase
    .from("placement_presets")
    .upsert({ name, config }, { onConflict: "name" })
    .select("id")
    .single();
  return data?.id ?? null;
}

export async function POST(req: NextRequest) {
  if (!adOrchSupabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const body = await req.json();

    // Handle placements (skip for Advantage+)
    const isAdvantagePlacement = body.advantagePlacement === true;
    const placements = (body.placements as string[]) ?? [];
    let ppId: number | null = null;
    if (!isAdvantagePlacement && placements.length > 0) {
      ppId = await upsertPlacementPreset(
        `preset_${body.presetName ?? "unnamed"}`,
        placements
      );
    }

    const row = mapBodyToRow(body);
    row.placement_preset_id = ppId; // null = Advantage+

    const { data, error } = await adOrchSupabase
      .from("submission_presets")
      .insert(row)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!adOrchSupabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    // Get existing preset to find placement_preset_id
    const { data: existing } = await adOrchSupabase
      .from("submission_presets")
      .select("placement_preset_id")
      .eq("id", id)
      .single();

    // Handle placements (skip for Advantage+)
    const isAdvantagePlacement = body.advantagePlacement === true;
    const placements = (body.placements as string[]) ?? [];
    let ppId: number | null = null;
    if (!isAdvantagePlacement && placements.length > 0) {
      ppId = await upsertPlacementPreset(
        `preset_${body.presetName ?? "unnamed"}`,
        placements,
        (existing as Record<string, unknown>)?.placement_preset_id as number | null
      );
    }

    const row = mapBodyToRow(body);
    row.placement_preset_id = ppId; // null = Advantage+

    const { data, error } = await adOrchSupabase
      .from("submission_presets")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (!adOrchSupabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const { error } = await adOrchSupabase
      .from("submission_presets")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Map camelCase request body to snake_case DB columns. */
function mapBodyToRow(body: Record<string, unknown>): Record<string, unknown> {
  return {
    project_id: body.projectId ?? undefined,
    preset_name: body.presetName ?? undefined,
    campaign_objective: body.campaignObjective ?? undefined,
    optimization_goal: body.optimizationGoal ?? undefined,
    custom_event_type: body.customEventType ?? undefined,
    gender: body.gender ?? undefined,
    age_min: body.ageMin ?? undefined,
    age_max: body.ageMax ?? undefined,
    geo_preset_id: body.geoPresetId ?? undefined,
    value_rule_id: body.valueRuleId ?? undefined,
    default_title: body.defaultTitle ?? undefined,
    default_body: body.defaultBody ?? undefined,
    default_description: body.defaultDescription ?? undefined,
  };
}
