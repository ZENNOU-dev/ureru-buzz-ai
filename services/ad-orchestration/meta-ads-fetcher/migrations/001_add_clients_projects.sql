-- ============================================
-- Migration 001: 取引先DB・案件DB追加 + 既存テーブル更新
-- ============================================

-- 1. 取引先テーブル (Notion 取引先DB対応)
CREATE TABLE IF NOT EXISTS clients (
    id BIGSERIAL PRIMARY KEY,
    notion_page_id TEXT UNIQUE,
    company_name TEXT NOT NULL,
    industry TEXT,
    status TEXT DEFAULT '進行中',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_clients_updated
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. 案件テーブル (Notion 案件DB対応)
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
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TRIGGER trg_projects_updated
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. ad_accounts に project_id カラム追加
ALTER TABLE ad_accounts
    ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_project ON ad_accounts(project_id);

-- 4. creatives テーブル拡張 (Notion Creative Database対応)
ALTER TABLE creatives
    ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id),
    ADD COLUMN IF NOT EXISTS cr_url TEXT,
    ADD COLUMN IF NOT EXISTS person_in_charge TEXT,
    ADD COLUMN IF NOT EXISTS industry TEXT;

CREATE INDEX IF NOT EXISTS idx_creatives_project ON creatives(project_id);

-- 5. ad_insights に project_id 追加 (集計高速化)
ALTER TABLE ad_insights
    ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_ad_insights_project ON ad_insights(project_id);
