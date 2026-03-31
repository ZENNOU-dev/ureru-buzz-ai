-- Migration v6: CATS管理画面データのDB化
-- CATS広告主・媒体・広告グループ・API連携・広告（クリックURL/中間クリックURL含む）

-- 1. CATS広告主
CREATE TABLE IF NOT EXISTS cats_clients (
    cats_client_id  INT PRIMARY KEY,
    name            TEXT NOT NULL,
    project_id      BIGINT REFERENCES projects(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CATS媒体
CREATE TABLE IF NOT EXISTS cats_partners (
    cats_partner_id INT PRIMARY KEY,
    name            TEXT NOT NULL,
    platform        TEXT NOT NULL,
    cats_client_id  INT REFERENCES cats_clients(cats_client_id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CATS広告グループ
CREATE TABLE IF NOT EXISTS cats_content_groups (
    cats_group_id   INT PRIMARY KEY,
    name            TEXT NOT NULL,
    cats_client_id  INT REFERENCES cats_clients(cats_client_id),
    ad_count        INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CATS API連携
CREATE TABLE IF NOT EXISTS cats_api_integrations (
    cats_api_id     INT PRIMARY KEY,
    name            TEXT NOT NULL,
    platform        TEXT NOT NULL,
    cats_client_id  INT REFERENCES cats_clients(cats_client_id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CATS広告 (メインテーブル)
CREATE TABLE IF NOT EXISTS cats_contents (
    cats_content_id     INT PRIMARY KEY,
    name                TEXT NOT NULL,
    cats_client_id      INT REFERENCES cats_clients(cats_client_id),
    cats_group_id       INT REFERENCES cats_content_groups(cats_group_id),
    cats_partner_id     INT REFERENCES cats_partners(cats_partner_id),
    redirect_url        TEXT,
    direct_param        TEXT,
    middle_redirect_url TEXT,
    middle_direct_param TEXT,
    redirect_to_url     TEXT,
    middle_redirect_to  TEXT,
    transition_type     TEXT NOT NULL DEFAULT 'middle_click'
                        CHECK (transition_type IN ('middle_click', 'direct_click')),
    status              TEXT DEFAULT '使用中',
    project_id          BIGINT REFERENCES projects(id),
    registered_at       TIMESTAMPTZ,
    synced_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cats_contents_client ON cats_contents(cats_client_id);
CREATE INDEX IF NOT EXISTS idx_cats_contents_group ON cats_contents(cats_group_id);
CREATE INDEX IF NOT EXISTS idx_cats_contents_project ON cats_contents(project_id);

-- 6. tracking_codes に cats_content_id FK追加
ALTER TABLE tracking_codes ADD COLUMN IF NOT EXISTS cats_content_id INT REFERENCES cats_contents(cats_content_id);
