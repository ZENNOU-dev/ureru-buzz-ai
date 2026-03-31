-- 020: video_3s_viewsの修正
-- 既存のvideo_3s_viewsはThruPlay(完視 or 15秒)を格納していた。
-- 正しいvideo_3_sec_watched_actionsに差し替える。
-- ThruPlayは別カラムvideo_thruplay_viewsとして保持。

-- 1. ThruPlay用カラム追加（既存データを退避）
ALTER TABLE ad_daily_metrics
  ADD COLUMN IF NOT EXISTS video_thruplay_views integer DEFAULT 0;

-- 2. 既存の誤データをThruPlayカラムに退避
UPDATE ad_daily_metrics
  SET video_thruplay_views = video_3s_views
  WHERE video_3s_views > 0;

-- 3. video_3s_viewsをリセット（次回フェッチで正しい値が入る）
UPDATE ad_daily_metrics
  SET video_3s_views = 0;

-- 4. VIEWにThruPlayを追加（v_ad_performanceの再作成が必要な場合はここで）
COMMENT ON COLUMN ad_daily_metrics.video_3s_views IS 'Meta API: video_3_sec_watched_actions — 3秒以上視聴数';
COMMENT ON COLUMN ad_daily_metrics.video_thruplay_views IS 'Meta API: video_thruplay_watched_actions — ThruPlay(完視 or 15秒)';
COMMENT ON COLUMN ad_daily_metrics.video_plays IS 'Meta API: video_play_actions — 動画再生開始数';
COMMENT ON COLUMN ad_daily_metrics.video_p25_views IS 'Meta API: video_p25_watched_actions — 25%再生数';
COMMENT ON COLUMN ad_daily_metrics.video_p50_views IS 'Meta API: video_p50_watched_actions — 50%再生数';
COMMENT ON COLUMN ad_daily_metrics.video_p75_views IS 'Meta API: video_p75_watched_actions — 75%再生数';
COMMENT ON COLUMN ad_daily_metrics.video_p95_views IS 'Meta API: video_p95_watched_actions — 95%再生数';
COMMENT ON COLUMN ad_daily_metrics.video_p100_views IS 'Meta API: video_p100_watched_actions — 100%再生数';
