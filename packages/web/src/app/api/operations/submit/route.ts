import { NextRequest, NextResponse } from "next/server";
import { adOrchSupabase } from "@/lib/ad-orch-supabase";
import { extractDriveFileId } from "@/lib/drive-utils";

export const dynamic = "force-dynamic";

const META_API_BASE = "https://graph.facebook.com/v22.0";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Creative {
  creativeName: string;
  creativeUrl: string;
  thumbnailUrl: string | null;
}

interface SubmitAdFormData {
  mode: "existing" | "new";
  presetId: string;
  accountId: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  creatives: Creative[];
  urlType: "articleLp" | "clickUrl";
  articleLpUrl: string;
  articleLpName?: string;
  clickUrl: string;
  advantageAudience: boolean;
  gender: string;
  ageMin: string;
  ageMax: string;
  geoPresetId: string;
  valueRuleId: string;
  advantagePlacement: boolean;
  placements: string[];
  bidStrategy: "lowest_cost" | "cost_cap";
  bidAmount: string;
  budget: string;
  startDate: string;
  endDate: string;
  defaultTitle: string;
  defaultBody: string;
  defaultDescription: string;
  operator?: string;
  memo: string;
}

interface AdResult {
  creativeName: string;
  videoId?: string;
  creativeId?: string;
  adId?: string;
  error?: string;
}

interface SubmitResult {
  campaignId?: string;
  adsetId?: string;
  ads: AdResult[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Creative enhancements: ALL OFF (mirrors submission_engine.py)
// ---------------------------------------------------------------------------

const CREATIVE_ENHANCEMENTS_OFF = {
  degrees_of_freedom_spec: {
    creative_features_spec: {
      adapt_to_placement: { enroll_status: "OPT_OUT" },
      add_text_overlay: { enroll_status: "OPT_OUT" },
      creative_stickers: { enroll_status: "OPT_OUT" },
      description_automation: { enroll_status: "OPT_OUT" },
      enhance_cta: { enroll_status: "OPT_OUT" },
      image_brightness_and_contrast: { enroll_status: "OPT_OUT" },
      image_background_gen: { enroll_status: "OPT_OUT" },
      image_templates: { enroll_status: "OPT_OUT" },
      image_touchups: { enroll_status: "OPT_OUT" },
      image_uncrop: { enroll_status: "OPT_OUT" },
      inline_comment: { enroll_status: "OPT_OUT" },
      media_type_automation: { enroll_status: "OPT_OUT" },
      product_extensions: { enroll_status: "OPT_OUT" },
      reveal_details_over_time: { enroll_status: "OPT_OUT" },
      text_optimizations: { enroll_status: "OPT_OUT" },
      text_translation: { enroll_status: "OPT_OUT" },
      video_auto_crop: { enroll_status: "OPT_OUT" },
      standard_enhancements_catalog: { enroll_status: "OPT_OUT" },
      ig_video_native_subtitle: { enroll_status: "OPT_OUT" },
      product_metadata_automation: { enroll_status: "OPT_OUT" },
      profile_card: { enroll_status: "OPT_OUT" },
    },
  },
  contextual_multi_ads: { enroll_status: "OPT_OUT" },
};

// ---------------------------------------------------------------------------
// Placement mapping (UI value -> Meta API publisher + positions)
// ---------------------------------------------------------------------------

function buildPlacementTargeting(placements: string[]): {
  publisher_platforms: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
} {
  const fbPositions: string[] = [];
  const igPositions: string[] = [];
  const publishers = new Set<string>();

  for (const p of placements) {
    switch (p) {
      case "ig_reels":
        igPositions.push("instagram_reels");
        publishers.add("instagram");
        break;
      case "ig_feed":
        igPositions.push("feed");
        publishers.add("instagram");
        break;
      case "ig_stories":
        igPositions.push("instagram_stories");
        publishers.add("instagram");
        break;
      case "ig_other":
        igPositions.push("instagram_explore", "instagram_explore_grid_home");
        publishers.add("instagram");
        break;
      case "fb_reels":
        fbPositions.push("facebook_reels", "facebook_reels_overlay");
        publishers.add("facebook");
        break;
      case "fb_feed":
        fbPositions.push("feed");
        publishers.add("facebook");
        break;
      case "fb_stories":
        fbPositions.push("facebook_stories");
        publishers.add("facebook");
        break;
      case "fb_other":
        fbPositions.push("marketplace", "search", "instream_video");
        publishers.add("facebook");
        break;
      case "audience_network":
        publishers.add("audience_network");
        break;
    }
  }

  const result: {
    publisher_platforms: string[];
    facebook_positions?: string[];
    instagram_positions?: string[];
  } = { publisher_platforms: Array.from(publishers) };

  if (fbPositions.length > 0) result.facebook_positions = fbPositions;
  if (igPositions.length > 0) result.instagram_positions = igPositions;

  return result;
}

// ---------------------------------------------------------------------------
// Meta API helpers
// ---------------------------------------------------------------------------

function getAccessToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN is not configured");
  return token;
}

async function metaPost(
  endpoint: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const token = getAccessToken();
  const body = new URLSearchParams({ ...params, access_token: token });

  const resp = await fetch(`${META_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await resp.json()) as Record<string, unknown>;

  if (data.error) {
    const err = data.error as Record<string, unknown>;
    const msg = err.message ?? "Unknown Meta API error";
    const userTitle = err.error_user_title ?? "";
    const userMsg = err.error_user_msg ?? "";
    let detail = String(msg);
    if (userTitle) detail += ` | ${userTitle}`;
    if (userMsg) detail += ` | ${userMsg}`;
    throw new Error(
      `Meta API error: ${detail} (code=${err.code}, subcode=${err.error_subcode})`,
    );
  }

  return data;
}

async function metaGet(
  endpoint: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const token = getAccessToken();
  const qs = new URLSearchParams({ ...params, access_token: token });

  const resp = await fetch(`${META_API_BASE}/${endpoint}?${qs.toString()}`, {
    method: "GET",
  });

  return (await resp.json()) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Account assets (page, pixel)
// ---------------------------------------------------------------------------

interface AccountAssets {
  pageId: string | null;
  pixelId: string | null;
  igActorId: string | null;
}

async function resolveAccountAssets(
  accountId: string,
): Promise<AccountAssets> {
  if (!adOrchSupabase) {
    return { pageId: null, pixelId: null, igActorId: null };
  }

  const { data } = await adOrchSupabase
    .from("account_assets")
    .select("asset_type, meta_asset_id, is_default")
    .eq("account_id", accountId)
    .eq("is_default", true);

  const rows = (data ?? []) as {
    asset_type: string;
    meta_asset_id: string;
    is_default: boolean;
  }[];

  const page = rows.find((r) => r.asset_type === "facebook_page");
  const pixel = rows.find((r) => r.asset_type === "pixel");
  const ig = rows.find((r) => r.asset_type === "instagram_account");

  return {
    pageId: page?.meta_asset_id ?? null,
    pixelId: pixel?.meta_asset_id ?? null,
    igActorId: ig?.meta_asset_id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Geo preset lookup
// ---------------------------------------------------------------------------

async function resolveGeoLocations(
  geoPresetId: string | null,
): Promise<Record<string, unknown>> {
  if (!geoPresetId || !adOrchSupabase) {
    return { countries: ["JP"] };
  }

  const { data } = await adOrchSupabase
    .from("geo_presets")
    .select("config")
    .eq("id", geoPresetId)
    .single();

  if (data?.config) {
    return data.config as Record<string, unknown>;
  }
  return { countries: ["JP"] };
}

// ---------------------------------------------------------------------------
// Video upload + poll (3-step fallback: file_url → source → resumable)
// ---------------------------------------------------------------------------

/**
 * Download from Google Drive, handling the large-file confirmation page.
 * Returns the raw video bytes.
 */
async function downloadFromDrive(driveUrl: string): Promise<Buffer> {
  const fileId = extractDriveFileId(driveUrl);
  if (!fileId) throw new Error(`Invalid Drive URL: ${driveUrl}`);

  // Step 1: initial request
  const dlUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  let resp = await fetch(dlUrl, { redirect: "follow" });
  const contentType = resp.headers.get("content-type") ?? "";

  if (contentType.includes("text/html")) {
    // Large file: parse confirmation page for uuid
    const html = await resp.text();
    const uuidMatch = html.match(/name="uuid"\s+value="([^"]*)"/);
    const confirmUrl = uuidMatch
      ? `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&uuid=${uuidMatch[1]}`
      : `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    resp = await fetch(confirmUrl, { redirect: "follow" });
  }

  if (!resp.ok) throw new Error(`Drive download failed: HTTP ${resp.status}`);

  const arrayBuf = await resp.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  if (buf.length < 100_000) {
    throw new Error(`Downloaded file too small (${buf.length} bytes) — likely HTML, not video`);
  }
  return buf;
}

/**
 * Resumable (chunked) upload to Meta — works for any file size.
 */
async function resumableUploadToMeta(
  accountId: string,
  videoData: Buffer,
  token: string,
  chunkSize = 4 * 1024 * 1024,
): Promise<string> {
  const fileSize = videoData.length;

  // Phase 1: start
  const startBody = new URLSearchParams({
    upload_phase: "start",
    file_size: String(fileSize),
    access_token: token,
  });
  const startResp = await fetch(`${META_API_BASE}/${accountId}/advideos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: startBody.toString(),
  });
  const startData = (await startResp.json()) as Record<string, unknown>;
  if (startData.error) throw new Error(`Resumable start: ${(startData.error as Record<string, unknown>).message}`);

  const sessionId = startData.upload_session_id as string;
  const videoId = startData.video_id as string;
  let startOffset = Number(startData.start_offset);
  let endOffset = Number(startData.end_offset);

  // Phase 2: transfer chunks
  while (startOffset < fileSize) {
    const chunk = videoData.subarray(startOffset, endOffset);
    const form = new FormData();
    form.append("upload_phase", "transfer");
    form.append("upload_session_id", sessionId);
    form.append("start_offset", String(startOffset));
    form.append("access_token", token);
    form.append("video_file_chunk", new Blob([chunk]), "chunk.mp4");

    const chunkResp = await fetch(`${META_API_BASE}/${accountId}/advideos`, {
      method: "POST",
      body: form,
    });
    const chunkData = (await chunkResp.json()) as Record<string, unknown>;
    if (chunkData.error) throw new Error(`Resumable transfer: ${(chunkData.error as Record<string, unknown>).message}`);

    startOffset = Number(chunkData.start_offset);
    endOffset = Number(chunkData.end_offset);
    if (startOffset >= fileSize || startOffset === endOffset) break;
  }

  // Phase 3: finish
  const finishBody = new URLSearchParams({
    upload_phase: "finish",
    upload_session_id: sessionId,
    access_token: token,
  });
  await fetch(`${META_API_BASE}/${accountId}/advideos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: finishBody.toString(),
  });

  return videoId;
}

/**
 * Upload video to Meta with 3-step fallback:
 * 1. file_url (Meta downloads from URL — instant if URL is accessible)
 * 2. Download from Drive + resumable upload (handles large files)
 *
 * Also checks creatives.meta_video_ids cache first.
 */
async function uploadVideoToMeta(
  accountId: string,
  driveUrl: string,
  creativeName?: string,
): Promise<string> {
  const fileId = extractDriveFileId(driveUrl);
  if (!fileId) throw new Error(`Invalid Drive URL: ${driveUrl}`);

  // Check cache: creatives.meta_video_ids
  if (creativeName && adOrchSupabase) {
    const { data: crRow } = await adOrchSupabase
      .from("creatives")
      .select("meta_video_ids")
      .eq("creative_name", creativeName)
      .limit(1)
      .single();
    const cached = (crRow?.meta_video_ids as Record<string, string> | null)?.[accountId];
    if (cached) {
      console.log(`Using cached video_id ${cached} for ${creativeName}`);
      return cached;
    }
  }

  const token = getAccessToken();
  let videoId: string | undefined;

  // Step 1: Try file_url (Meta server-side fetch — fast for small/public files)
  try {
    const fileUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    const result = await metaPost(`${accountId}/advideos`, { file_url: fileUrl });
    videoId = result.id as string;
  } catch (e) {
    const msg = String(e);
    // code 389 = unable to fetch, 351 = problem with video file (got HTML)
    if (msg.includes("389") || msg.includes("351") || msg.includes("413")) {
      console.log(`file_url failed for ${creativeName ?? fileId}, falling back to resumable upload`);
    } else {
      throw e; // unexpected error, don't swallow
    }
  }

  // Step 2: Download from Drive + resumable upload
  if (!videoId) {
    const videoData = await downloadFromDrive(driveUrl);
    console.log(`Downloaded ${(videoData.length / 1024 / 1024).toFixed(0)}MB, starting resumable upload`);
    videoId = await resumableUploadToMeta(accountId, videoData, token);
  }

  if (!videoId) throw new Error("Video upload returned no ID");

  // Cache video_id in creatives.meta_video_ids
  if (creativeName && adOrchSupabase) {
    try {
      const { data: crRow } = await adOrchSupabase
        .from("creatives")
        .select("id, meta_video_ids")
        .eq("creative_name", creativeName)
        .limit(1)
        .single();
      if (crRow) {
        const existing = (crRow.meta_video_ids as Record<string, string>) ?? {};
        existing[accountId] = videoId;
        await adOrchSupabase.from("creatives").update({ meta_video_ids: existing }).eq("id", crRow.id).execute();
      }
    } catch { /* cache write failure is non-critical */ }
  }

  return videoId;
}

async function waitForVideoReady(
  videoId: string,
  maxAttempts = 8,
  intervalMs = 3000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await metaGet(videoId, { fields: "status" });
    const status = data.status as Record<string, unknown> | undefined;

    if (status) {
      const phase = status.processing_phase as string | undefined;
      if (phase === "complete") return;

      const videoStatus = status.video_status as string | undefined;
      if (videoStatus === "ready") return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  // Don't fail hard -- video might still be usable
  console.warn(`Video ${videoId} did not reach 'complete' after polling`);
}

// ---------------------------------------------------------------------------
// Get video thumbnail
// ---------------------------------------------------------------------------

async function getVideoThumbnail(videoId: string): Promise<string> {
  const data = await metaGet(videoId, { fields: "status,picture,thumbnails" });

  const thumbnails = data.thumbnails as
    | { data: { uri: string }[] }
    | undefined;
  if (thumbnails?.data?.[0]?.uri) return thumbnails.data[0].uri;

  return (data.picture as string) ?? "";
}

// ---------------------------------------------------------------------------
// Campaign creation
// ---------------------------------------------------------------------------

async function createCampaign(
  accountId: string,
  name: string,
  body: SubmitAdFormData,
): Promise<string> {
  const params: Record<string, string> = {
    name,
    objective: "OUTCOME_SALES",
    status: "PAUSED",
    special_ad_categories: "[]",
  };

  // Campaign-level budget (CBO)
  if (body.budget) {
    params.daily_budget = String(Math.floor(Number(body.budget)));
  }

  // Bid strategy at campaign level
  if (body.bidStrategy === "cost_cap") {
    params.bid_strategy = "COST_CAP";
    if (body.bidAmount) {
      params.bid_amount = String(Math.floor(Number(body.bidAmount)));
    }
  } else {
    params.bid_strategy = "LOWEST_COST_WITHOUT_CAP";
  }

  const result = await metaPost(`${accountId}/campaigns`, params);
  return result.id as string;
}

// ---------------------------------------------------------------------------
// Adset creation
// ---------------------------------------------------------------------------

async function createAdset(
  accountId: string,
  body: SubmitAdFormData,
  campaignId: string,
  assets: AccountAssets,
): Promise<string> {
  // -- Targeting --
  const geoLocations = await resolveGeoLocations(body.geoPresetId || null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targeting: Record<string, any> = {
    geo_locations: geoLocations,
    locales: [11], // Japanese
  };

  if (body.advantageAudience) {
    // Advantage+ audience with suggestions enabled
    targeting.targeting_automation = { advantage_audience: 1 };
    // Custom audiences as suggestions (included even with Advantage+)
    // These become "提案を含めるカスタムオーディエンス"
  } else {
    // Manual audience
    targeting.targeting_automation = { advantage_audience: 0 };

    if (body.gender === "male") {
      targeting.genders = [1];
    } else if (body.gender === "female") {
      targeting.genders = [2];
    }

    if (body.ageMin) targeting.age_min = Number(body.ageMin);
    if (body.ageMax) targeting.age_max = Number(body.ageMax);
  }

  // -- Placements --
  if (!body.advantagePlacement && body.placements.length > 0) {
    const placementConfig = buildPlacementTargeting(body.placements);
    targeting.publisher_platforms = placementConfig.publisher_platforms;
    if (placementConfig.facebook_positions) {
      targeting.facebook_positions = placementConfig.facebook_positions;
    }
    if (placementConfig.instagram_positions) {
      targeting.instagram_positions = placementConfig.instagram_positions;
    }
  }

  // -- Params --
  const params: Record<string, string> = {
    campaign_id: campaignId,
    name: body.adsetName || body.campaignName + "_adset",
    optimization_goal: "OFFSITE_CONVERSIONS",
    billing_event: "IMPRESSIONS",
    status: "ACTIVE",
    targeting: JSON.stringify(targeting),
    attribution_spec: JSON.stringify([
      { event_type: "CLICK_THROUGH", window_days: 1 },
    ]),
  };

  // Start / end time (JST midnight = UTC 15:00 previous day)
  if (body.startDate) {
    params.start_time = `${body.startDate}T00:00:00+0900`;
  }
  if (body.endDate) {
    params.end_time = `${body.endDate}T23:59:59+0900`;
  }

  // Promoted object (pixel + custom event type from account_conversion_events)
  if (assets.pixelId && adOrchSupabase) {
    let customEventType = "PURCHASE"; // fallback
    const { data: convEvent } = await adOrchSupabase
      .from("account_conversion_events")
      .select("meta_action_type")
      .eq("account_id", accountId)
      .eq("event_role", "cv")
      .single();
    if (convEvent?.meta_action_type) {
      // Extract event type: "offsite_conversion.fb_pixel_purchase" → "PURCHASE"
      const parts = (convEvent.meta_action_type as string).split(".");
      const lastPart = parts[parts.length - 1].replace("fb_pixel_", "").toUpperCase();
      customEventType = lastPart;
    }
    params.promoted_object = JSON.stringify({
      pixel_id: assets.pixelId,
      custom_event_type: customEventType,
    });
  }

  // Value rule (resolve DB id → Meta rule ID)
  if (body.valueRuleId && body.bidStrategy !== "cost_cap" && adOrchSupabase) {
    const { data: ruleData } = await adOrchSupabase
      .from("account_rules")
      .select("meta_rule_id")
      .eq("id", body.valueRuleId)
      .single();
    if (ruleData?.meta_rule_id) {
      params.value_rule_set_id = ruleData.meta_rule_id as string;
    }
  }

  const result = await metaPost(`${accountId}/adsets`, params);
  return result.id as string;
}

// ---------------------------------------------------------------------------
// Ad creative creation
// ---------------------------------------------------------------------------

async function createAdCreative(
  accountId: string,
  creativeName: string,
  videoId: string,
  linkUrl: string,
  title: string,
  bodyText: string,
  description: string,
  assets: AccountAssets,
): Promise<string> {
  if (!assets.pageId) {
    throw new Error("No Facebook page found for this account");
  }

  // Get thumbnail from video
  const thumbnailUrl = await getVideoThumbnail(videoId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoData: Record<string, any> = {
    video_id: videoId,
    title: title || "",
    message: bodyText || "",
    link_description: description || "",
    call_to_action: {
      type: "LEARN_MORE",
      value: { link: linkUrl },
    },
  };

  if (thumbnailUrl) {
    videoData.image_url = thumbnailUrl;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objectStorySpec: Record<string, any> = {
    page_id: assets.pageId,
    video_data: videoData,
  };

  const params: Record<string, string> = {
    name: `CR_${creativeName}`,
    object_story_spec: JSON.stringify(objectStorySpec),
    degrees_of_freedom_spec: JSON.stringify(
      CREATIVE_ENHANCEMENTS_OFF.degrees_of_freedom_spec,
    ),
    contextual_multi_ads: JSON.stringify(
      CREATIVE_ENHANCEMENTS_OFF.contextual_multi_ads,
    ),
  };

  // Try with IG actor first, fall back without
  if (assets.igActorId) {
    objectStorySpec.instagram_actor_id = assets.igActorId;
    params.object_story_spec = JSON.stringify(objectStorySpec);

    try {
      const result = await metaPost(`${accountId}/adcreatives`, params);
      return result.id as string;
    } catch (e) {
      const msg = String(e).toLowerCase();
      if (msg.includes("instagram")) {
        // Retry without IG actor
        delete objectStorySpec.instagram_actor_id;
        params.object_story_spec = JSON.stringify(objectStorySpec);
      } else {
        throw e;
      }
    }
  }

  const result = await metaPost(`${accountId}/adcreatives`, params);
  return result.id as string;
}

// ---------------------------------------------------------------------------
// Ad creation
// ---------------------------------------------------------------------------

function buildAdName(
  catsCode: string,
  creativeName: string,
  articleLpName: string,
  operator: string,
): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${catsCode}/${creativeName}/${articleLpName}/${operator}/${dateStr}`;
}

async function createAd(
  accountId: string,
  adName: string,
  adsetId: string,
  creativeId: string,
): Promise<string> {
  const result = await metaPost(`${accountId}/ads`, {
    name: adName,
    adset_id: adsetId,
    creative: JSON.stringify({ creative_id: creativeId }),
    status: "ACTIVE",
    is_advantaged_destination_enabled: "false",
  });

  return result.id as string;
}

// ---------------------------------------------------------------------------
// Operation logging
// ---------------------------------------------------------------------------

async function logOperation(
  accountId: string,
  targetTable: string,
  targetId: string,
  status: "success" | "error",
  detail: Record<string, unknown>,
  errorMessage?: string,
): Promise<void> {
  if (!adOrchSupabase) return;

  try {
    await adOrchSupabase.from("agent_operations").insert({
      operation_type: "ad_submission",
      target_table: targetTable,
      target_id: targetId,
      status,
      operation_detail: {
        account_id: accountId,
        ...detail,
      },
      error_message: errorMessage ?? null,
    });
  } catch (e) {
    console.error("Failed to log operation:", e);
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!adOrchSupabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 },
    );
  }

  let body: SubmitAdFormData;
  try {
    body = (await req.json()) as SubmitAdFormData;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // -- Validation --
  if (!body.mode || !body.accountId || !body.creatives?.length) {
    return NextResponse.json(
      { error: "mode, accountId, and creatives are required" },
      { status: 400 },
    );
  }

  if (body.mode === "existing" && (!body.campaignId || !body.adsetId)) {
    return NextResponse.json(
      { error: "campaignId and adsetId are required for existing mode" },
      { status: 400 },
    );
  }

  if (body.mode === "new" && !body.campaignName) {
    return NextResponse.json(
      { error: "campaignName is required for new mode" },
      { status: 400 },
    );
  }

  // Determine link URL
  const linkUrl =
    body.urlType === "articleLp" ? body.articleLpUrl : body.clickUrl;

  if (!linkUrl) {
    return NextResponse.json(
      { error: "A destination URL (articleLpUrl or clickUrl) is required" },
      { status: 400 },
    );
  }

  // -- Resolve account assets --
  let assets: AccountAssets;
  try {
    assets = await resolveAccountAssets(body.accountId);
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to resolve account assets: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  if (!assets.pageId) {
    return NextResponse.json(
      { error: "No default Facebook page found for this account" },
      { status: 400 },
    );
  }

  const result: SubmitResult = { ads: [] };

  try {
    // -- Campaign --
    let campaignId: string;
    if (body.mode === "existing") {
      campaignId = body.campaignId;
    } else {
      campaignId = await createCampaign(body.accountId, body.campaignName, body);
      result.campaignId = campaignId;

      await logOperation(body.accountId, "campaigns", campaignId, "success", {
        target_name: body.campaignName,
        action: "create_campaign",
      });
    }

    // -- Adset --
    let adsetId: string;
    if (body.mode === "existing") {
      adsetId = body.adsetId;
    } else {
      adsetId = await createAdset(
        body.accountId,
        body,
        campaignId,
        assets,
      );
      result.adsetId = adsetId;

      await logOperation(body.accountId, "adsets", adsetId, "success", {
        target_name: body.adsetName || body.campaignName + "_adset",
        action: "create_adset",
        campaign_id: campaignId,
      });
    }

    // -- Resolve article LP name for ad naming --
    // For articleLp: use body.articleLpName if provided, otherwise query DB
    // For clickUrl: use body.articleLpName (set from CATS option in form), otherwise query via CATS content
    let articleLpLabel = body.articleLpName || "";
    if (!articleLpLabel && body.urlType === "articleLp" && body.articleLpUrl && adOrchSupabase) {
      const { data: lpData } = await adOrchSupabase
        .from("article_lps")
        .select("lp_name, appeal_name")
        .eq("base_url", body.articleLpUrl)
        .limit(1)
        .single();
      articleLpLabel = (lpData?.appeal_name as string) || (lpData?.lp_name as string) || "";
    }
    if (!articleLpLabel && body.urlType === "clickUrl" && body.clickUrl && adOrchSupabase) {
      const { data: catsData } = await adOrchSupabase
        .from("cats_contents")
        .select("name, article_lp_id")
        .eq("redirect_url", body.clickUrl)
        .limit(1)
        .single();
      if (catsData?.article_lp_id) {
        const { data: lpData } = await adOrchSupabase
          .from("article_lps")
          .select("lp_name, appeal_name")
          .eq("id", catsData.article_lp_id)
          .limit(1)
          .single();
        articleLpLabel = (lpData?.appeal_name as string) || (lpData?.lp_name as string) || "";
      }
    }
    // Resolve CATS code name for ad naming
    let catsCodeName = "";
    if (body.urlType === "clickUrl" && body.clickUrl && adOrchSupabase) {
      const { data: catsData } = await adOrchSupabase
        .from("cats_contents")
        .select("name")
        .eq("redirect_url", body.clickUrl)
        .limit(1)
        .single();
      catsCodeName = (catsData?.name as string) || "";
    }
    const adNamePrefix = catsCodeName || articleLpLabel || "ad";
    const operatorName = body.operator || "";

    // -- Parallel video upload (all CRs at once, with cache + fallback) --
    const videoIds: (string | null)[] = await Promise.all(
      body.creatives.map(async (cr) => {
        try {
          return await uploadVideoToMeta(body.accountId, cr.creativeUrl, cr.creativeName);
        } catch { return null; }
      })
    );

    // -- Creatives + Ads --
    for (let i = 0; i < body.creatives.length; i++) {
      const cr = body.creatives[i];
      const adResult: AdResult = { creativeName: cr.creativeName };

      try {
        const videoId = videoIds[i];
        if (!videoId) throw new Error("Video upload failed");
        adResult.videoId = videoId;

        // Wait briefly (video may already be ready from parallel upload time)
        await waitForVideoReady(videoId, 5, 3000);

        // Create ad creative
        const creativeId = await createAdCreative(
          body.accountId,
          cr.creativeName,
          videoId,
          linkUrl,
          body.defaultTitle,
          body.defaultBody,
          body.defaultDescription,
          assets,
        );
        adResult.creativeId = creativeId;

        // Create ad with proper naming: パラメータ/CR名/記事名/運用担当/入稿日時
        const adName = buildAdName(adNamePrefix, cr.creativeName, articleLpLabel, operatorName);
        const adId = await createAd(
          body.accountId,
          adName,
          adsetId,
          creativeId,
        );
        adResult.adId = adId;

        await logOperation(body.accountId, "ads", adId, "success", {
          target_name: cr.creativeName,
          action: "create_ad",
          adset_id: adsetId,
          creative_id: creativeId,
          video_id: videoId,
        });
      } catch (e) {
        const errMsg = (e as Error).message;
        adResult.error = errMsg;

        await logOperation(
          body.accountId,
          "ads",
          "failed",
          "error",
          {
            target_name: cr.creativeName,
            action: "create_ad",
            adset_id: adsetId,
          },
          errMsg,
        );
      }

      result.ads.push(adResult);
    }

    // Check if all failed
    const allFailed = result.ads.every((a) => !!a.error);
    const anyFailed = result.ads.some((a) => !!a.error);

    if (allFailed) {
      return NextResponse.json(
        {
          error: "All ad creations failed",
          ...result,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      partialError: anyFailed,
      ...result,
    });
  } catch (e) {
    const errMsg = (e as Error).message;
    result.error = errMsg;

    await logOperation(
      body.accountId,
      "campaigns",
      "failed",
      "error",
      {
        action: body.mode === "new" ? "create_campaign" : "submit_to_existing",
        mode: body.mode,
      },
      errMsg,
    );

    return NextResponse.json(
      { error: errMsg, ...result },
      { status: 500 },
    );
  }
}
