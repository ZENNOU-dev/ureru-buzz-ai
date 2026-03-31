-- v8: CATSテーブル正規化 - updated_at/is_active追加、FK追加、INDEX追加

-- ============================================================
-- 1. cats_clients: updated_at, is_active 追加
-- ============================================================
ALTER TABLE cats_clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE cats_clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cats_clients_updated_at') THEN
        CREATE TRIGGER update_cats_clients_updated_at
            BEFORE UPDATE ON cats_clients FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- 2. cats_partners: updated_at, is_active, INDEX 追加
-- ============================================================
ALTER TABLE cats_partners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE cats_partners ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_cats_partners_client ON cats_partners(cats_client_id);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cats_partners_updated_at') THEN
        CREATE TRIGGER update_cats_partners_updated_at
            BEFORE UPDATE ON cats_partners FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- 3. cats_content_groups: updated_at, is_active, INDEX 追加
-- ============================================================
ALTER TABLE cats_content_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE cats_content_groups ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_cats_content_groups_client ON cats_content_groups(cats_client_id);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cats_content_groups_updated_at') THEN
        CREATE TRIGGER update_cats_content_groups_updated_at
            BEFORE UPDATE ON cats_content_groups FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- 4. cats_api_integrations: updated_at, is_active 追加
-- ============================================================
ALTER TABLE cats_api_integrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE cats_api_integrations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cats_api_integrations_updated_at') THEN
        CREATE TRIGGER update_cats_api_integrations_updated_at
            BEFORE UPDATE ON cats_api_integrations FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- 5. cats_contents: updated_at, is_active, INDEX 追加
-- ============================================================
ALTER TABLE cats_contents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- is_active は既に存在する可能性（statusカラムで代替してる）
ALTER TABLE cats_contents ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_cats_contents_client ON cats_contents(cats_client_id);
CREATE INDEX IF NOT EXISTS idx_cats_contents_group ON cats_contents(cats_group_id);
CREATE INDEX IF NOT EXISTS idx_cats_contents_partner ON cats_contents(cats_partner_id);
CREATE INDEX IF NOT EXISTS idx_cats_contents_project ON cats_contents(project_id);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cats_contents_updated_at') THEN
        CREATE TRIGGER update_cats_contents_updated_at
            BEFORE UPDATE ON cats_contents FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- 6. cats_project_config: FK追加（cats_*テーブルへの参照整合性）
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_project_config_client_fk') THEN
        ALTER TABLE cats_project_config
            ADD CONSTRAINT cats_project_config_client_fk
            FOREIGN KEY (cats_client_id) REFERENCES cats_clients(cats_client_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_project_config_partner_fk') THEN
        ALTER TABLE cats_project_config
            ADD CONSTRAINT cats_project_config_partner_fk
            FOREIGN KEY (cats_partner_id) REFERENCES cats_partners(cats_partner_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_project_config_group_fk') THEN
        ALTER TABLE cats_project_config
            ADD CONSTRAINT cats_project_config_group_fk
            FOREIGN KEY (cats_content_group_id) REFERENCES cats_content_groups(cats_group_id);
    END IF;
END $$;

-- ============================================================
-- 7. tracking_codes.cats_content_id FK
-- ============================================================
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tracking_codes' AND column_name = 'cats_content_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tracking_codes_cats_content_fk'
    ) THEN
        ALTER TABLE tracking_codes
            ADD CONSTRAINT tracking_codes_cats_content_fk
            FOREIGN KEY (cats_content_id) REFERENCES cats_contents(cats_content_id);
    END IF;
END $$;
