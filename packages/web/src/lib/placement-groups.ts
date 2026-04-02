/**
 * Meta配置グループ定義
 * publisher_platform/platform_position → グループ名
 */
export const PLACEMENT_GROUPS = [
  { key: "ig_reels", label: "IG Reels", match: ["instagram/instagram_reels"] },
  { key: "ig_feed", label: "IG Feed", match: ["instagram/feed"] },
  { key: "ig_stories", label: "IG Stories", match: ["instagram/instagram_stories"] },
  { key: "ig_other", label: "IG その他", match: ["instagram/instagram_explore", "instagram/instagram_explore_grid_home"] },
  { key: "fb_reels", label: "FB Reels", match: ["facebook/facebook_reels", "facebook/facebook_reels_overlay"] },
  { key: "fb_feed", label: "FB Feed", match: ["facebook/feed"] },
  { key: "fb_stories", label: "FB Stories", match: ["facebook/facebook_stories"] },
  { key: "fb_other", label: "FB その他", match: ["facebook/marketplace", "facebook/search", "facebook/instream_video"] },
  { key: "audience_network", label: "Audience Network", match: [] }, // catch-all
] as const;

export type PlacementGroupKey = (typeof PLACEMENT_GROUPS)[number]["key"];

const placementToGroup = new Map<string, PlacementGroupKey>();
for (const group of PLACEMENT_GROUPS) {
  for (const m of group.match) {
    placementToGroup.set(m, group.key);
  }
}

export function getPlacementGroup(publisherPlatform: string, platformPosition: string): PlacementGroupKey {
  return placementToGroup.get(`${publisherPlatform}/${platformPosition}`) ?? "audience_network";
}
