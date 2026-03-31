-- Migration 004: link_urls テーブル追加 + submission_presets 修正
-- ========================================================================

-- 1. link_urls: プロジェクトごとのLP URL管理
-- ========================================================================
CREATE TABLE IF NOT EXISTS link_urls (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,                    -- 表示名 ("ローコスト_メインLP", "ローコスト_記事LP経由" 等)
    url TEXT NOT NULL,                     -- 実際のURL
    url_type TEXT NOT NULL DEFAULT 'direct' CHECK (url_type IN ('direct', 'article_lp')),
                                           -- direct=CR→LP直接, article_lp=CR→記事LP→LP
    description TEXT,                      -- 補足 (LPの内容メモ等)
    is_active BOOLEAN DEFAULT true,        -- 有効/無効
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (project_id, name)
);

CREATE INDEX idx_link_urls_project ON link_urls(project_id);

-- 2. submission_presets に custom_event_type カラム追加
-- ========================================================================
-- optimization_event は optimization_goal (OFFSITE_CONVERSIONS等) として使用中
-- custom_event_type は promoted_object.custom_event_type (PURCHASE, LEAD等)
ALTER TABLE submission_presets
    ADD COLUMN IF NOT EXISTS custom_event_type TEXT;

-- 3. submission_presets に default_link_url_id を追加 (link_urls FK)
-- ========================================================================
ALTER TABLE submission_presets
    ADD COLUMN IF NOT EXISTS default_link_url_id BIGINT REFERENCES link_urls(id);

-- 4. submission_presets の optimization_event を optimization_goal にリネーム
-- ========================================================================
ALTER TABLE submission_presets
    RENAME COLUMN optimization_event TO optimization_goal;

-- 5. submission_adsets に promoted_custom_event のデフォルト値を PURCHASE に設定
-- (既存NULLデータの修正は別途データパッチで対応)

-- 6. updated_at トリガー for link_urls
-- ========================================================================
CREATE OR REPLACE TRIGGER set_link_urls_updated_at
    BEFORE UPDATE ON link_urls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
