-- ============================================================
-- Supabase Schema v2: Notion 4DB構造に対応
-- 取引先DB → clients
-- 案件DB → projects
-- Meta広告アカウント管理 → ad_accounts (既存・FK追加)
-- Creative Database → creatives (既存・FK追加)
-- ad_insights (既存・FK追加)
-- ============================================================

-- 1. 取引先テーブル
CREATE TABLE IF NOT EXISTS clients (
    id BIGSERIAL PRIMARY KEY,
    notion_page_id TEXT UNIQUE,
    company_name TEXT NOT NULL,
    industry TEXT,
    status TEXT DEFAULT '進行中',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 案件テーブル
CREATE TABLE IF NOT EXISTS projects (
    id BIGSERIAL PRIMARY KEY,
    notion_page_id TEXT UNIQUE,
    name TEXT NOT NULL,
    genre TEXT,
    industry TEXT,
    status TEXT DEFAULT '進行中',
    client_id BIGINT REFERENCES clients(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);

-- 3. ad_accounts に project_id FK 追加
ALTER TABLE ad_accounts
    ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id);

ALTER TABLE ad_accounts
    ADD COLUMN IF NOT EXISTS notion_page_id TEXT UNIQUE;

-- 4. creatives に project_id FK 追加 + person_in_charge
ALTER TABLE creatives
    ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id);

ALTER TABLE creatives
    ADD COLUMN IF NOT EXISTS person_in_charge TEXT;

ALTER TABLE creatives
    ADD COLUMN IF NOT EXISTS notion_page_id TEXT UNIQUE;

ALTER TABLE creatives
    ADD COLUMN IF NOT EXISTS cr_url TEXT;

-- 5. ad_insights に project_id 追加（非正規化、集計高速化用）
ALTER TABLE ad_insights
    ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id);

-- 6. updated_at トリガーを新テーブルにも適用
DROP TRIGGER IF EXISTS trg_clients_updated ON clients;
CREATE TRIGGER trg_clients_updated
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. インデックス追加
CREATE INDEX IF NOT EXISTS idx_ad_accounts_project ON ad_accounts(project_id);
CREATE INDEX IF NOT EXISTS idx_creatives_project ON creatives(project_id);
CREATE INDEX IF NOT EXISTS idx_ad_insights_project ON ad_insights(project_id);
