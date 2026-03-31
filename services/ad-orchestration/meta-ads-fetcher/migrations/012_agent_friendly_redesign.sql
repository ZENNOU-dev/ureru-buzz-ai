-- v12: エージェント前提DB再設計
--
-- 1. FK付け替え: cats_contents/cats_project_config の article_lp_id/client_code_id を
--    lp_base_urls(DEPRECATED) → article_lps/client_codes に変更
-- 2. エージェント用VIEW 3つ作成 (v_submission_context, v_cats_full, v_ad_performance)
-- 3. agent_operations テーブル追加 (エージェント操作ログ)
-- 4. 全テーブル・全カラムにCOMMENT追加
-- 5. NOT NULL制約強化 (門番でクリア確認済みの箇所)
-- 6. DEPRECATED テーブルマーキング

-- ============================================================
-- 1. FK付け替え: cats_contents → article_lps / client_codes
-- ============================================================

-- 1a. 旧FK削除
ALTER TABLE cats_contents DROP CONSTRAINT IF EXISTS cats_contents_article_lp_base_fk;
ALTER TABLE cats_contents DROP CONSTRAINT IF EXISTS cats_contents_client_code_base_fk;

-- 1b. データremap: lp_base_urls ID → article_lps ID (base_url照合)
-- article_lp_id のremap
UPDATE cats_contents cc
SET article_lp_id = alp.id
FROM article_lps alp
WHERE cc.article_lp_id IS NOT NULL
  AND cc.article_lp_id NOT IN (SELECT id FROM article_lps)
  AND alp.project_id = cc.project_id
  AND EXISTS (
    SELECT 1 FROM lp_base_urls lb
    WHERE lb.id = cc.article_lp_id
    AND lb.base_url = alp.base_url
  );

-- client_code_id のremap
UPDATE cats_contents cc
SET client_code_id = ck.id
FROM client_codes ck
WHERE cc.client_code_id IS NOT NULL
  AND cc.client_code_id NOT IN (SELECT id FROM client_codes)
  AND ck.project_id = cc.project_id
  AND EXISTS (
    SELECT 1 FROM lp_base_urls lb
    WHERE lb.id = cc.client_code_id
    AND lb.base_url = ck.base_url
  );

-- 1c. 新FK追加: article_lps / client_codes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_contents_article_lp_fk') THEN
        ALTER TABLE cats_contents
            ADD CONSTRAINT cats_contents_article_lp_fk
            FOREIGN KEY (article_lp_id) REFERENCES article_lps(id)
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_contents_client_code_fk') THEN
        ALTER TABLE cats_contents
            ADD CONSTRAINT cats_contents_client_code_fk
            FOREIGN KEY (client_code_id) REFERENCES client_codes(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- 1d. cats_project_config の default_*_id も同様に付け替え
ALTER TABLE cats_project_config DROP CONSTRAINT IF EXISTS cats_project_config_article_lp_fk;
ALTER TABLE cats_project_config DROP CONSTRAINT IF EXISTS cats_project_config_client_code_fk;

-- remap (default_article_lp_id)
UPDATE cats_project_config cpc
SET default_article_lp_id = alp.id
FROM article_lps alp
WHERE cpc.default_article_lp_id IS NOT NULL
  AND cpc.default_article_lp_id NOT IN (SELECT id FROM article_lps)
  AND alp.project_id = cpc.project_id
  AND EXISTS (
    SELECT 1 FROM lp_base_urls lb
    WHERE lb.id = cpc.default_article_lp_id
    AND lb.base_url = alp.base_url
  );

-- remap (default_client_code_id)
UPDATE cats_project_config cpc
SET default_client_code_id = ck.id
FROM client_codes ck
WHERE cpc.default_client_code_id IS NOT NULL
  AND cpc.default_client_code_id NOT IN (SELECT id FROM client_codes)
  AND ck.project_id = cpc.project_id
  AND EXISTS (
    SELECT 1 FROM lp_base_urls lb
    WHERE lb.id = cpc.default_client_code_id
    AND lb.base_url = ck.base_url
  );

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_project_config_article_lp_new_fk') THEN
        ALTER TABLE cats_project_config
            ADD CONSTRAINT cats_project_config_article_lp_new_fk
            FOREIGN KEY (default_article_lp_id) REFERENCES article_lps(id)
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_project_config_client_code_new_fk') THEN
        ALTER TABLE cats_project_config
            ADD CONSTRAINT cats_project_config_client_code_new_fk
            FOREIGN KEY (default_client_code_id) REFERENCES client_codes(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- 2. エージェント用VIEW作成
-- ============================================================

-- VIEW 1: v_submission_context
-- 入稿タスクに必要な全情報を1クエリで取得
CREATE OR REPLACE VIEW v_submission_context AS
SELECT
    p.id AS project_id,
    p.name AS project_name,
    p.status AS project_status,
    c.company_name AS client_name,
    aa.account_id,
    aa.account_name,
    aa.operator_name,
    aa.is_target,
    sp.id AS preset_id,
    sp.preset_name,
    sp.campaign_objective,
    sp.bid_strategy,
    sp.optimization_goal,
    sp.custom_event_type,
    sp.default_body,
    sp.default_title,
    sp.default_description,
    sp.gender,
    sp.age_min,
    sp.age_max,
    sp.is_asc,
    sp.creative_type,
    sp.campaign_status,
    sp.adset_status,
    sp.ad_status,
    gtp.id AS geo_preset_id,
    gtp.name AS geo_name,
    gtp.config AS geo_config,
    pp.id AS placement_preset_id,
    pp.name AS placement_name,
    pp.config AS placement_config,
    pp.is_advantage_plus,
    cas.id AS audience_set_id,
    cas.name AS audience_set_name,
    cpc.id AS cats_config_id,
    cpc.click_type,
    cpc.ad_name_prefix,
    cpc.ad_name_template,
    cpc.cats_client_id,
    cpc.cats_partner_id,
    cpc.cats_content_group_id,
    cpc.default_article_lp_id,
    cpc.default_client_code_id,
    cpc.beyond_source_version
FROM projects p
JOIN clients c ON p.client_id = c.id
LEFT JOIN ad_accounts aa ON aa.project_id = p.id
LEFT JOIN submission_presets sp ON sp.project_id = p.id
LEFT JOIN geo_targeting_presets gtp ON sp.geo_preset_id = gtp.id
LEFT JOIN placement_presets pp ON sp.placement_preset_id = pp.id
LEFT JOIN custom_audience_sets cas ON sp.audience_set_id = cas.id
LEFT JOIN cats_project_config cpc ON cpc.project_id = p.id AND cpc.platform = 'Meta';

COMMENT ON VIEW v_submission_context IS 'エージェント用: 入稿タスクに必要な全情報（案件→アカウント→プリセット→配置→地域→CATS設定）を1クエリで取得。起点: project_id or project_name';

-- VIEW 2: v_cats_full
-- CATSコンテンツの全関連情報を1行で取得
CREATE OR REPLACE VIEW v_cats_full AS
SELECT
    cc.cats_content_id,
    cc.name AS cats_name,
    cc.transition_type,
    cc.redirect_url,
    cc.direct_param,
    cc.middle_redirect_url,
    cc.middle_direct_param,
    cc.redirect_to_url,
    cc.status AS cats_status,
    cc.is_active AS cats_is_active,
    alp.id AS article_lp_id,
    alp.lp_name,
    alp.base_url AS article_lp_url,
    alp.beyond_page_id,
    alp.appeal_name,
    alp.expression_type,
    ck.id AS client_code_id,
    ck.code_name,
    ck.base_url AS client_code_url,
    p.id AS project_id,
    p.name AS project_name,
    ccl.name AS cats_client_name,
    cg.name AS cats_group_name,
    cp.name AS cats_partner_name
FROM cats_contents cc
LEFT JOIN article_lps alp ON cc.article_lp_id = alp.id
LEFT JOIN client_codes ck ON cc.client_code_id = ck.id
LEFT JOIN projects p ON cc.project_id = p.id
LEFT JOIN cats_clients ccl ON cc.cats_client_id = ccl.cats_client_id
LEFT JOIN cats_content_groups cg ON cc.cats_group_id = cg.cats_group_id
LEFT JOIN cats_partners cp ON cc.cats_partner_id = cp.cats_partner_id;

COMMENT ON VIEW v_cats_full IS 'エージェント用: CATSコンテンツ+記事LP+クライアントコード+案件を1行で取得。起点: cats_content_id or project_id';

-- VIEW 3: v_ad_performance
-- 配信数値+CR+CATS+LP全結合
CREATE OR REPLACE VIEW v_ad_performance AS
SELECT
    m.date,
    m.ad_id,
    a.ad_name,
    a.creative_id,
    cr.creative_name,
    cr.cr_url AS creative_url,
    a.cats_content_id,
    cc.name AS cats_name,
    cc.transition_type,
    alp.lp_name AS article_lp_name,
    alp.appeal_name,
    ck.code_name AS client_code_name,
    ast.adset_id,
    ast.adset_name,
    camp.campaign_id,
    camp.campaign_name,
    camp.account_id,
    acc.account_name,
    acc.project_id,
    p.name AS project_name,
    m.spend,
    m.impressions,
    m.reach,
    m.clicks,
    m.cpc,
    m.cpm,
    m.ctr,
    m.video_plays,
    m.video_3s_views,
    m.video_p25_views,
    m.video_p50_views,
    m.video_p75_views,
    m.video_p100_views,
    cv_stats.value AS cv,
    mcv_stats.value AS mcv,
    cv_conf.display_name AS cv_name,
    mcv_conf.display_name AS mcv_name
FROM ad_daily_metrics m
JOIN ads a ON m.ad_id = a.ad_id
JOIN adsets ast ON a.adset_id = ast.adset_id
JOIN campaigns camp ON ast.campaign_id = camp.campaign_id
JOIN ad_accounts acc ON camp.account_id = acc.account_id
LEFT JOIN projects p ON acc.project_id = p.id
LEFT JOIN creatives cr ON a.creative_id = cr.id
LEFT JOIN cats_contents cc ON a.cats_content_id = cc.cats_content_id
LEFT JOIN article_lps alp ON cc.article_lp_id = alp.id
LEFT JOIN client_codes ck ON cc.client_code_id = ck.id
LEFT JOIN account_conversion_events cv_conf
    ON cv_conf.account_id = camp.account_id AND cv_conf.event_role = 'cv'
LEFT JOIN ad_action_stats cv_stats
    ON cv_stats.date = m.date AND cv_stats.ad_id = m.ad_id
    AND cv_stats.action_type = cv_conf.meta_action_type
LEFT JOIN account_conversion_events mcv_conf
    ON mcv_conf.account_id = camp.account_id AND mcv_conf.event_role = 'mcv'
LEFT JOIN ad_action_stats mcv_stats
    ON mcv_stats.date = m.date AND mcv_stats.ad_id = m.ad_id
    AND mcv_stats.action_type = mcv_conf.meta_action_type;

COMMENT ON VIEW v_ad_performance IS 'エージェント用: 配信数値+CR+CATS+記事LP+CV/MCVを全結合。起点: project_id, account_id, date範囲';

-- ============================================================
-- 3. agent_operations テーブル (エージェント操作ログ)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_operations (
    id BIGSERIAL PRIMARY KEY,
    operation_type TEXT NOT NULL,           -- insert / update / delete / api_call
    target_table TEXT,                      -- 操作対象テーブル
    target_id TEXT,                         -- 操作対象の主キー値
    operation_detail JSONB DEFAULT '{}',    -- 変更内容 {before: {...}, after: {...}}
    agent_session_id TEXT,                  -- エージェントセッション識別子
    status TEXT NOT NULL DEFAULT 'success', -- success / error / rolled_back
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_ops_created ON agent_operations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_ops_table ON agent_operations(target_table, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_ops_session ON agent_operations(agent_session_id) WHERE agent_session_id IS NOT NULL;

COMMENT ON TABLE agent_operations IS 'エージェント(Claude等)のDB操作ログ。全てのエージェント起因のDB変更をここに記録する。門番がチェックする。';
COMMENT ON COLUMN agent_operations.operation_type IS '操作種別: insert(新規作成), update(更新), delete(削除), api_call(外部API呼出)';
COMMENT ON COLUMN agent_operations.target_table IS '操作対象のテーブル名 (例: cats_contents, ads, submission_presets)';
COMMENT ON COLUMN agent_operations.target_id IS '操作対象の主キー値 (例: cats_content_id=4443, ad_id=123456)';
COMMENT ON COLUMN agent_operations.operation_detail IS '変更内容JSON。{before: {col: old_val}, after: {col: new_val}} 形式推奨';
COMMENT ON COLUMN agent_operations.agent_session_id IS 'エージェントのセッションID。同一セッション内の操作を追跡';
COMMENT ON COLUMN agent_operations.status IS '結果: success(成功), error(失敗), rolled_back(ロールバック済)';

-- ============================================================
-- 4. COMMENT ON: 主要テーブル・カラム（エージェントが理解できる説明）
-- ============================================================

-- clients
COMMENT ON TABLE clients IS '取引先マスター。Notionから同期。1取引先に複数案件(projects)が紐づく';
COMMENT ON COLUMN clients.notion_page_id IS 'Notion同期キー。ページIDで一意に特定';
COMMENT ON COLUMN clients.status IS '商談/進行中/停止 のいずれか';

-- projects
COMMENT ON TABLE projects IS '案件マスター。Notionから同期。広告運用の基本単位。client_id→clientsへFK';
COMMENT ON COLUMN projects.client_id IS '取引先FK。clients(id)を参照。1クライアントに複数案件';
COMMENT ON COLUMN projects.status IS '進行中/停止中 のいずれか。停止中の案件は入稿対象外';

-- ad_accounts
COMMENT ON TABLE ad_accounts IS 'Meta広告アカウント。PKはact_XXX形式のテキスト。project_id→projectsへFK';
COMMENT ON COLUMN ad_accounts.account_id IS 'Meta APIのアカウントID。act_XXXXXXXXXの形式';
COMMENT ON COLUMN ad_accounts.is_target IS 'データ取得対象フラグ。trueのアカウントのみfetcherが取得';
COMMENT ON COLUMN ad_accounts.operator_name IS '運用担当者名。Notion People型から姓を抽出';

-- creatives
COMMENT ON TABLE creatives IS 'クリエイティブ（動画/画像素材）。Notionから同期。creative_nameがUNIQUE';
COMMENT ON COLUMN creatives.cr_url IS 'Google Drive共有URL。入稿時にここからダウンロード';
COMMENT ON COLUMN creatives.meta_video_ids IS 'アカウント別Meta動画IDキャッシュ。{act_xxx: video_id}形式。再アップロード防止';

-- ads
COMMENT ON TABLE ads IS 'Meta広告。全システム接続ハブ。creative_id→CRへ、cats_content_id→CATSへリンク';
COMMENT ON COLUMN ads.creative_id IS 'creatives(id)へFK。入稿時に確定設定。既存広告はad_nameパースで推測(解決率29%)';
COMMENT ON COLUMN ads.cats_content_id IS 'cats_contents(cats_content_id)へFK。CATS広告との紐付け。配信数値→CATS→LP追跡の要';

-- cats_contents
COMMENT ON TABLE cats_contents IS 'CATSコンテンツ(トラッキング対象広告)。article_lp_id→記事LP、client_code_id→クライアントコードへリンク';
COMMENT ON COLUMN cats_contents.article_lp_id IS 'article_lps(id)へFK。この広告が使う記事LP';
COMMENT ON COLUMN cats_contents.client_code_id IS 'client_codes(id)へFK。この広告が使うクライアント発行コード';
COMMENT ON COLUMN cats_contents.redirect_url IS 'CATSリダイレクトURL。Meta広告のlink_urlに設定される';
COMMENT ON COLUMN cats_contents.transition_type IS '遷移タイプ: middle_click(記事LP経由) / direct_click(直接遷移)';

-- article_lps
COMMENT ON TABLE article_lps IS '記事LP。Notion記事LP管理DBから同期。Beyond記事LPのURL・訴求・表現パターンを管理';
COMMENT ON COLUMN article_lps.beyond_page_id IS 'Squad BeyondのページUID(URLパスから自動抽出)。リンク置換やバージョン複製に使用';
COMMENT ON COLUMN article_lps.client_code_id IS 'client_codes(id)へFK。1記事LP=1クライアントコードの1:1マッピング';
COMMENT ON COLUMN article_lps.appeal_name IS '訴求名(例: 男性ジェネリック)。CPN名やバリュールール提案に使用';

-- client_codes
COMMENT ON TABLE client_codes IS 'クライアント発行コード。Notionから同期。広告主が発行するトラッキングURL';
COMMENT ON COLUMN client_codes.code_name IS 'コード名(例: lowc_bon_dir_f_fk_11)。CATS広告名の生成に使用';
COMMENT ON COLUMN client_codes.base_url IS 'クライアント発行URL。最終的なCV計測URLとして使用';

-- cats_project_config
COMMENT ON TABLE cats_project_config IS '案件×プラットフォームごとのCATS設定。入稿時に案件名だけでCATS全パラメータを自動解決';
COMMENT ON COLUMN cats_project_config.click_type IS 'middle_click(記事LP経由) / direct_click(直接遷移)。URL構築ロジックが変わる';
COMMENT ON COLUMN cats_project_config.ad_name_template IS 'CATS広告名テンプレート。{prefix}_bon_dir_f_{seq}のような形式';

-- submission_presets
COMMENT ON TABLE submission_presets IS '入稿プリセット。案件ごとのデフォルト値。エージェントが自然言語入力から最適プリセットを自動選択';
COMMENT ON COLUMN submission_presets.campaign_objective IS 'Meta APIキャンペーン目的: OUTCOME_SALES / OUTCOME_LEADS / OUTCOME_TRAFFIC';
COMMENT ON COLUMN submission_presets.bid_strategy IS '入札戦略: LOWEST_COST_WITHOUT_CAP / COST_CAP';
COMMENT ON COLUMN submission_presets.optimization_goal IS 'Meta API最適化目標: OFFSITE_CONVERSIONS等';

-- ad_daily_metrics
COMMENT ON TABLE ad_daily_metrics IS '日次メトリクスファクトテーブル。PK=(date,ad_id)。CV/MCVはad_action_statsに分離';
COMMENT ON COLUMN ad_daily_metrics.spend IS '消化金額(JPY)。Meta APIからそのまま。絶対に*100しない';

-- ad_action_stats
COMMENT ON TABLE ad_action_stats IS 'CVアクション統計(EAV形式)。PK=(date,ad_id,action_type)。アカウントごとにCV定義が異なるためEAV方式';
COMMENT ON COLUMN ad_action_stats.action_type IS 'Meta APIのaction_typeそのまま。例: offsite_conversion.fb_pixel_purchase';

-- account_conversion_events
COMMENT ON TABLE account_conversion_events IS 'アカウントごとのCV/MCV定義。ad_daily_conversions VIEWとv_ad_performanceが参照';
COMMENT ON COLUMN account_conversion_events.event_role IS 'cv(コンバージョン)またはmcv(マイクロコンバージョン)';

-- ============================================================
-- 5. NOT NULL 制約強化
-- ============================================================
-- 門番で既にNULLがないことを確認済みのカラム
ALTER TABLE projects ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE creatives ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE cats_contents ALTER COLUMN project_id SET NOT NULL;
-- ad_accounts.project_id は36行中NULLなしだが、account_idがtext PKのため別途確認
-- ALTER TABLE ad_accounts ALTER COLUMN project_id SET NOT NULL; -- 次回

-- cats_contents.status にCHECK制約
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_contents_status_check') THEN
        ALTER TABLE cats_contents
            ADD CONSTRAINT cats_contents_status_check
            CHECK (status IN ('使用中', '停止中', 'テスト', 'duplicate'));
    END IF;
END $$;

-- ============================================================
-- 6. DEPRECATEDテーブルにCOMMENT
-- ============================================================
COMMENT ON TABLE lp_base_urls IS 'DEPRECATED (v12): article_lps + client_codes に分離済み。FKは全て移行完了。将来DROPする';
COMMENT ON TABLE lp_param_codes IS 'DEPRECATED (v12): 行数0。使用していない。将来DROPする';
COMMENT ON TABLE link_urls IS 'DEPRECATED (v12): 行数1。submission_presetsのdefault_link_url_idのみ使用。将来article_lps/client_codesに移行してDROP';
COMMENT ON TABLE tracking_codes IS 'DEPRECATED (v12): 行数0。cats_contentsが直接tracking情報を持つため不要。将来DROPする';

-- ============================================================
-- 7. レガシーカラムにCOMMENT (非推奨マーキング)
-- ============================================================
-- article_lp_param_id / client_code_param_id は既にDROPされている場合はスキップ
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cats_contents' AND column_name = 'article_lp_param_id') THEN
        COMMENT ON COLUMN cats_contents.article_lp_param_id IS 'DEPRECATED (v9レガシー): lp_param_codes経由。使用していない。将来DROP';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cats_contents' AND column_name = 'client_code_param_id') THEN
        COMMENT ON COLUMN cats_contents.client_code_param_id IS 'DEPRECATED (v9レガシー): lp_param_codes経由。使用していない。将来DROP';
    END IF;
END $$;
