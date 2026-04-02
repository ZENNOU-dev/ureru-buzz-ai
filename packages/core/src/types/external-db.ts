/**
 * 既存DB参照型（READ ONLY）
 *
 * Ad Orchestration (ozhldqebkxxkctmrfngq) と
 * video-material-selector (bjoeuyetksqnqnczpghz) から
 * 読み取るデータの型定義。
 *
 * 将来の統合時はこのファイルを修正するだけで済む。
 */

// ============================================================
// Ad Orchestration DB (READ ONLY)
// ============================================================

export interface AdOrchClient {
  id: string;
  company_name: string;
  notion_page_id?: string;
  industry?: string;
  status: "商談" | "進行中" | "停止";
  created_at: string;
  updated_at: string;
}

export interface AdOrchProject {
  id: string;
  client_id: string;
  name: string;
  notion_page_id?: string;
  genre?: string;
  industry?: string;
  status: "進行中" | "停止中";
  created_at: string;
  updated_at: string;
}

export interface AdOrchCreative {
  id: string;
  project_id: string;
  name: string;
  creative_url?: string;
  notion_page_id?: string;
  embedding?: number[];
  created_at: string;
}

export interface AdOrchAdDailyMetrics {
  id: string;
  ad_id: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  video_p25_watched_actions?: number;
  video_p50_watched_actions?: number;
  video_p75_watched_actions?: number;
  video_p100_watched_actions?: number;
  video_avg_time_watched_actions?: number;
  created_at: string;
}

export interface AdOrchAdActionStats {
  id: string;
  ad_id: string;
  date: string;
  action_type: string;
  value: number;
  created_at: string;
}

export interface AdOrchAd {
  id: string;
  adset_id: string;
  name: string;
  status: string;
  creative_id?: string;
  meta_ad_id?: string;
  created_at: string;
}

// ============================================================
// video-material-selector DB (READ ONLY)
// ============================================================

export interface VmsMaterialVector {
  id: string;
  notion_page_id: string;
  drive_file_id: string;
  content_text: string;
  embedding: number[];
  metadata: {
    name?: string;
    project?: string;
    tags?: {
      subject?: string;
      scene?: string;
      action?: string;
      mood?: string;
      color_tone?: string;
      gender?: string;
      age_group?: string;
    };
  };
  created_at: string;
  updated_at: string;
}

export interface VmsFeedbackPair {
  id: string;
  script_section_text: string;
  script_section_embedding: number[];
  rejected_material_id: string;
  accepted_material_id: string;
  rejection_reason?: string;
  created_at: string;
}
