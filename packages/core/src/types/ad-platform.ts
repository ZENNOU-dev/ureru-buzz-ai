import type { AdPlatform } from "../config/constants.js";

export interface AdPerformance {
  tenantId: string;
  platform: AdPlatform;
  date: string;
  adId: string;
  adName: string;
  impressions: number;
  clicks: number;
  costNet: number;
  costGross: number;
  cv: number;
  cvActual?: number;
  ctr: number;
  cvr: number;
  cpaNet: number;
  cpaGross: number;
  roi?: number;
  videoView2s?: number;
  videoView25?: number;
  videoView50?: number;
  videoView75?: number;
  videoView100?: number;
  avgWatchTime?: number;
}

export interface SubmissionInput {
  tenantId: string;
  platform: AdPlatform;
  videoName: string;
  videoUrl: string;
  creativeName: string;
  adText: string;
  lpUrl: string;
  adsetId?: string;
  adgroupId?: string;
  pageId?: string;
}

export interface SubmissionResult {
  platform: AdPlatform;
  adId: string;
  creativeId?: string;
  videoId?: string;
  status: "submitted" | "failed";
  error?: string;
}

export interface FeeConfig {
  tenantId: string;
  defaultFeeRate: number;
  platformOverrides?: Partial<Record<AdPlatform, number>>;
}
