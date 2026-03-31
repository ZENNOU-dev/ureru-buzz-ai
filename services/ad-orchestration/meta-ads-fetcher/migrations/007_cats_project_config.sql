-- v7: cats_project_config (案件×プラットフォームごとのCATS設定マッピング)
-- 自動登録時に案件名だけでCATS全パラメータを解決するためのテーブル

CREATE TABLE IF NOT EXISTS cats_project_config (
    id                      BIGSERIAL PRIMARY KEY,
    project_id              BIGINT NOT NULL REFERENCES projects(id),
    platform                TEXT NOT NULL,  -- 'Meta' / 'TikTok' / 'LINE'

    -- CATS IDマッピング
    cats_client_id          INT NOT NULL,   -- CATS広告主ID
    cats_partner_id         INT NOT NULL,   -- CATS媒体ID
    cats_content_group_id   INT NOT NULL,   -- CATS広告グループID

    -- 遷移パターン
    click_type              TEXT NOT NULL DEFAULT 'middle_click'
                            CHECK (click_type IN ('middle_click', 'direct_click')),
    article_lp_url          TEXT,           -- 記事LP URL (middle_click時の遷移先)
    final_lp_url            TEXT,           -- 最終LP URL (クライアント発行コード)

    -- 広告名テンプレート
    ad_name_prefix          TEXT,           -- "lowc" / "reden" / "ansd"
    ad_name_template        TEXT,           -- "{prefix}_bon_dir_f_fk_{seq}" 等

    is_active               BOOLEAN DEFAULT true,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_cats_project_config_project ON cats_project_config(project_id);

-- updated_at トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cats_project_config_updated_at
    BEFORE UPDATE ON cats_project_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
