-- v10: 全システム接続 (CATS/Beyond/入稿/CR/配信数値)
--
-- 修正A: ads に cats_content_id 追加 → 配信数値からCATS直結
-- 修正C: cats_contents に article_lp_id / client_code_id 追加 → CATS→Beyond/コード直結
-- cleanup: lp_param_codes 経由の旧FK を残しつつ、新しい直接FKを追加

-- ============================================================
-- 1. ads テーブルに cats_content_id を追加
-- ============================================================
ALTER TABLE ads ADD COLUMN IF NOT EXISTS cats_content_id INT;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ads_cats_content_fk') THEN
        ALTER TABLE ads
            ADD CONSTRAINT ads_cats_content_fk
            FOREIGN KEY (cats_content_id) REFERENCES cats_contents(cats_content_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ads_cats_content ON ads(cats_content_id) WHERE cats_content_id IS NOT NULL;

-- ============================================================
-- 2. cats_contents に article_lp_id / client_code_id 追加 (lp_base_urls 直接FK)
-- ============================================================
ALTER TABLE cats_contents ADD COLUMN IF NOT EXISTS article_lp_id BIGINT;
ALTER TABLE cats_contents ADD COLUMN IF NOT EXISTS client_code_id BIGINT;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_contents_article_lp_base_fk') THEN
        ALTER TABLE cats_contents
            ADD CONSTRAINT cats_contents_article_lp_base_fk
            FOREIGN KEY (article_lp_id) REFERENCES lp_base_urls(id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_contents_client_code_base_fk') THEN
        ALTER TABLE cats_contents
            ADD CONSTRAINT cats_contents_client_code_base_fk
            FOREIGN KEY (client_code_id) REFERENCES lp_base_urls(id);
    END IF;
END $$;

-- ============================================================
-- 3. ローコストの既存cats_contents に article_lp_id / client_code_id を設定
--    cats_project_config の default_* を使って一括設定
-- ============================================================
-- ローコスト × Meta (project_id=18)
UPDATE cats_contents cc
SET article_lp_id = cp.default_article_lp_id,
    client_code_id = cp.default_client_code_id
FROM cats_project_config cp
WHERE cc.cats_client_id = cp.cats_client_id
  AND cc.cats_partner_id = cp.cats_partner_id
  AND cp.default_article_lp_id IS NOT NULL
  AND cc.article_lp_id IS NULL;
