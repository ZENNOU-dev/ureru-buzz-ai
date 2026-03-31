"""入稿ウィザード - 対話型でCR入稿設定を構築する

Claude Code会話内で以下のように使う:
    from submission_wizard import SubmissionWizard
    wiz = SubmissionWizard(project_name="ローコスト")

    # Step 1: CR選択 → get_creative_options()
    # Step 2: 記事LP選択 → get_article_lp_options()
    # Step 3-7: 入札/予算/CPN設定 → 対話で収集
    # Step 8: build_submission() → DB保存 + サマリー
"""

import os
import json
import logging
import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
load_dotenv()
from supabase import create_client


supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
JST = ZoneInfo("Asia/Tokyo")
logger = logging.getLogger(__name__)



def ensure_creatives_synced(cr_names: list[str], project_name: str = None) -> dict[str, int]:
    """入稿対象のCR名がSupabaseに存在することを確認する。

    スプシ【制作DB】→ Supabase は cron (30分毎) で自動同期済み。
    この関数はSupabase確認のみ行い、見つからないCRを報告する。

    Returns: {cr_name: creatives.id} マッピング
    """
    project_id = None
    if project_name:
        proj = supabase.table("projects").select("id").eq("name", project_name).limit(1).execute()
        if proj.data:
            project_id = proj.data[0]["id"]

    result = {}
    missing = []

    for name in cr_names:
        # Supabase確認 (project_idでフィルタして同名CR誤取得を防止)
        query = supabase.table("creatives").select("id,project_id,cr_url,person_in_charge").eq("creative_name", name)
        if project_id:
            query = query.eq("project_id", project_id)
        row = query.limit(1).execute()

        # project_idフィルタで見つからない場合、フィルタなしで再検索
        if not row.data and project_id:
            row = supabase.table("creatives").select("id,project_id,cr_url,person_in_charge").eq("creative_name", name).limit(1).execute()
            if row.data and row.data[0].get("project_id") and row.data[0]["project_id"] != project_id:
                logger.warning(f"  CR '{name}' は別案件(project_id={row.data[0]['project_id']})に属しています。スキップします。")
                continue

        if row.data:
            result[name] = row.data[0]["id"]
            logger.info(f"  Found: {name} (id={row.data[0]['id']}, person={row.data[0].get('person_in_charge', '-')})")
        else:
            missing.append(name)
            logger.warning(f"  NOT FOUND: {name} — スプシ【制作DB】に未登録の可能性あり")

    if missing:
        logger.warning(f"  {len(missing)}件のCRが見つかりません: {missing}")
        logger.warning("  → スプシに行を追加して30分待つか、手動で sync_sheets_to_supabase.py を実行してください")

    return result


class SubmissionWizard:
    """入稿に必要な設定を収集・解決するクラス"""

    def __init__(self, project_name: str):
        # プロジェクト取得
        proj = supabase.table("projects").select("id").eq("name", project_name).single().execute()
        self.project_id = proj.data["id"]
        self.project_name = project_name

        # cats_project_config
        cfg = supabase.table("cats_project_config").select("*").eq("project_id", self.project_id).eq("platform", "Meta").single().execute()
        self.config = cfg.data

        # 記事LP一覧 (article_lps テーブル)
        lps = supabase.table("article_lps").select("*").eq("project_id", self.project_id).execute()
        self.article_lps = {lp["id"]: lp for lp in lps.data}

        # クライアントコード一覧 (client_codes テーブル)
        codes = supabase.table("client_codes").select("*").eq("project_id", self.project_id).execute()
        self.client_codes = {c["id"]: c for c in codes.data}

        # 既存CATS登録 (LP→コード マッピング)
        cats = supabase.table("cats_contents").select("*").eq("project_id", self.project_id).execute()
        self.cats_contents = cats.data
        self._build_lp_code_map()

        # 広告アカウント一覧
        accts = supabase.table("ad_accounts").select("*").eq("project_id", self.project_id).eq("is_target", True).execute()
        self.accounts = accts.data

        # 入稿プリセット
        presets = supabase.table("submission_presets").select("*").eq("project_id", self.project_id).execute()
        self.presets = {p["preset_name"]: p for p in presets.data}

    def _build_lp_code_map(self):
        """記事LP → クライアントコード のマッピングを構築"""
        self.lp_code_map = {}  # article_lp_id → client_code_id
        # article_lps テーブルに client_code_id が直接入っている
        for lp_id, lp in self.article_lps.items():
            code_id = lp.get("client_code_id")
            if code_id:
                self.lp_code_map[lp_id] = code_id

    # ============================================================
    # 選択肢取得メソッド
    # ============================================================

    def get_creative_options(self, limit: int = 20) -> list[dict]:
        """入稿可能なCRの選択肢を返す"""
        crs = (supabase.table("creatives")
               .select("id,creative_name,cr_url,person_in_charge")
               .eq("project_id", self.project_id)
               .order("id", desc=True)
               .limit(limit)
               .execute())
        return [
            {
                "id": c["id"],
                "name": c["creative_name"],
                "cr_url": c.get("cr_url", ""),
                "person": c.get("person_in_charge", ""),
            }
            for c in crs.data
        ]

    def get_article_lp_options(self) -> list[dict]:
        """記事LPの選択肢を返す (訴求名×表現パターン付き)"""
        options = []
        for lp_id, lp in self.article_lps.items():
            code_id = self.lp_code_map.get(lp_id)
            code_label = self.client_codes[code_id]["code_name"] if code_id and code_id in self.client_codes else None
            appeal = lp.get("appeal_name", "")
            expr = lp.get("expression_type", "")
            display = f"{appeal}×{expr}" if appeal and expr else lp["lp_name"]
            options.append({
                "lp_id": lp_id,
                "slug": lp["lp_name"],
                "url": lp["base_url"],
                "appeal_name": appeal,
                "expression_type": expr,
                "display": display,
                "client_code_id": code_id,
                "client_code_label": code_label,
            })
        return options

    def get_account_options(self) -> list[dict]:
        """広告アカウントの選択肢を返す"""
        return [
            {
                "account_id": a["account_id"],
                "name": a["account_name"],
            }
            for a in self.accounts
        ]

    def get_existing_campaigns(self, account_id: str) -> list[dict]:
        """Meta APIから既存CPN一覧を取得する。ACTIVE全件 + PAUSED直近20件。"""
        token = os.getenv("META_ACCESS_TOKEN")
        results = []

        # 1) ACTIVE全件（配信中は全部出す）
        resp = requests.get(
            f"https://graph.facebook.com/v22.0/{account_id}/campaigns",
            params={
                "access_token": token,
                "fields": "id,name,status,daily_budget",
                "filtering": json.dumps([{"field": "effective_status", "operator": "IN", "value": ["ACTIVE"]}]),
                "limit": 100,
            },
        )
        results.extend(resp.json().get("data", []))

        # 2) PAUSED直近20件（最近のもののみ）
        resp = requests.get(
            f"https://graph.facebook.com/v22.0/{account_id}/campaigns",
            params={
                "access_token": token,
                "fields": "id,name,status,daily_budget",
                "filtering": json.dumps([{"field": "effective_status", "operator": "IN", "value": ["PAUSED"]}]),
                "limit": 20,
            },
        )
        results.extend(resp.json().get("data", []))

        return [
            {
                "campaign_id": c["id"],
                "name": c["name"],
                "status": c["status"],
                "daily_budget": int(c.get("daily_budget", 0)),
            }
            for c in results
        ]

    def get_existing_adsets(self, campaign_id: str) -> list[dict]:
        """Meta APIから既存CPN内のadset一覧を取得する。ACTIVE全件 + PAUSED直近10件。"""
        token = os.getenv("META_ACCESS_TOKEN")
        results = []

        for status_filter, limit in [("ACTIVE", 50), ("PAUSED", 10)]:
            resp = requests.get(
                f"https://graph.facebook.com/v22.0/{campaign_id}/adsets",
                params={
                    "access_token": token,
                    "fields": "id,name,status,bid_amount,daily_budget",
                    "filtering": json.dumps([{"field": "effective_status", "operator": "IN", "value": [status_filter]}]),
                    "limit": limit,
                },
            )
            results.extend(resp.json().get("data", []))

        return [
            {
                "adset_id": a["id"],
                "name": a["name"],
                "status": a["status"],
                "bid_amount": int(a.get("bid_amount", 0)),
            }
            for a in results
        ]

    def get_custom_audiences(self, account_id: str) -> list[dict]:
        """Meta APIからカスタムオーディエンス一覧を取得する"""
        token = os.getenv("META_ACCESS_TOKEN")
        resp = requests.get(
            f"https://graph.facebook.com/v22.0/{account_id}/customaudiences",
            params={
                "access_token": token,
                "fields": "id,name,subtype,approximate_count_lower_bound",
                "limit": 50,
            },
        )
        data = resp.json().get("data", [])
        return [
            {
                "id": a["id"],
                "name": a["name"],
                "subtype": a.get("subtype", ""),
                "size": a.get("approximate_count_lower_bound", 0),
            }
            for a in data
        ]

    def get_unassigned_codes(self) -> list[dict]:
        """まだどのLPにも割り当てられていないコードを返す"""
        used_code_ids = set(self.lp_code_map.values())
        return [
            {"code_id": c["id"], "label": c["code_name"], "url": c["base_url"]}
            for c in self.client_codes.values()
            if c["id"] not in used_code_ids
        ]

    def get_next_seq(self, code_label: str) -> int:
        """同じコードで何件目のCATS登録かを返す"""
        count = 0
        for c in self.cats_contents:
            name = c["name"]
            if name == code_label:
                count = max(count, 1)  # 旧命名(連番なし)
            elif name.startswith(f"{code_label}-"):
                suffix = name.split("-")[-1]
                if suffix.isdigit():
                    count = max(count, int(suffix))
        return count + 1

    # ============================================================
    # 設定解決
    # ============================================================

    def resolve_settings(self, article_lp_id: int, client_code_id: int = None) -> dict:
        """記事LP選択からCATS/Beyond設定を自動解決する

        Returns:
            {
                "article_lp": {"id", "slug", "url", "appeal_name", "expression_type"},
                "client_code": {"id", "label", "url"},
                "cats_ad_name": "lowc_bon_dir_f_fk_15-02",
                "cats_config": {client_id, group_id, partner_id, click_type},
                "beyond_slug": "lowc-m3-02aq-bonfk00",
                "middle_click_url": "https://...",
            }
        """
        lp = self.article_lps[article_lp_id]

        # コード解決: 指定があればそれ、なければLP→コードマッピング
        if client_code_id is None:
            client_code_id = self.lp_code_map.get(article_lp_id)
        if client_code_id is None:
            raise ValueError(f"記事LP {lp['lp_name']} にコードが未割当。コードを指定してください。")

        code = self.client_codes[client_code_id]
        seq = self.get_next_seq(code["code_name"])
        cats_ad_name = f"{code['code_name']}-{seq:02d}"

        # click_type による分岐
        click_type = self.config.get("click_type", "middle_click")
        url_suffix = self.config.get("url_suffix", "")

        if click_type == "direct_click":
            # direct_click: Meta入稿URL = 記事LP URL、CATSは記事内CTA経由
            link_url = lp["base_url"]
            middle_click_url = None
        else:
            # middle_click: Meta入稿URL = CATSクリックURL
            middle_click_url = code["base_url"] + (url_suffix or "")
            # 既存CATS広告のredirect_urlを探す（既存CPNに追加する場合に必要）
            existing_cats = (supabase.table("cats_contents")
                             .select("cats_content_id,redirect_url")
                             .eq("client_code_id", client_code_id)
                             .eq("is_active", True)
                             .not_.is_("redirect_url", "null")
                             .order("cats_content_id", desc=True)
                             .limit(1).execute())
            if existing_cats.data:
                link_url = existing_cats.data[0]["redirect_url"]
            else:
                link_url = ""  # CATS登録後に確定

        return {
            "article_lp": {
                "id": article_lp_id,
                "slug": lp["lp_name"],
                "url": lp["base_url"],
                "appeal_name": lp.get("appeal_name", ""),
                "expression_type": lp.get("expression_type", ""),
            },
            "client_code": {
                "id": client_code_id,
                "label": code["code_name"],
                "url": code["base_url"],
            },
            "cats_ad_name": cats_ad_name,
            "cats_config": {
                "client_id": self.config["cats_client_id"],
                "group_id": self.config["cats_content_group_id"],
                "partner_id": self.config["cats_partner_id"],
                "click_type": click_type,
            },
            "beyond_slug": lp["lp_name"],
            "middle_click_url": middle_click_url,
            "link_url": link_url,
        }

    # ============================================================
    # 命名規則
    # ============================================================

    def _format_start_date(self, start_date: str = None) -> str:
        """開始日をYYYY-MM-DD-HH:MM形式にフォーマットする.

        None → 翌日 0:00 (例: 2026-03-21-00:00)
        MMDD → YYYY-MM-DD-00:00
        YYYY-MM-DD → YYYY-MM-DD-00:00
        既にYYYY-MM-DD-HH:MM → そのまま
        """
        if start_date is None:
            tomorrow = datetime.now(JST) + timedelta(days=1)
            return tomorrow.strftime("%Y-%m-%d-00:00")
        if len(start_date) == 4 and start_date.isdigit():
            # MMDD → YYYY-MM-DD-00:00
            year = datetime.now(JST).year
            return f"{year}-{start_date[:2]}-{start_date[2:]}-00:00"
        if len(start_date) == 10:
            # YYYY-MM-DD → YYYY-MM-DD-00:00
            return f"{start_date}-00:00"
        return start_date

    def generate_campaign_name(
        self,
        appeal_name: str,
        expression_type: str,
        is_main: bool = True,
        test_content: str = "",
        start_date: str = None,
    ) -> str:
        """CPN名を生成する

        命名規則:
          メイン: {訴求名}_{表現パターン}/メイン/{開始日}
          検証:   {訴求名}_{表現パターン}/検証/{検証内容}/{開始日}
        例: 男性ジェネリック_漫画/メイン/2026-03-21-00:00
        """
        start_date = self._format_start_date(start_date)
        main_or_test = "メイン" if is_main else "検証"

        if is_main:
            return f"{appeal_name}_{expression_type}/{main_or_test}/{start_date}"
        else:
            return f"{appeal_name}_{expression_type}/{main_or_test}/{test_content}/{start_date}"

    def generate_ad_name(
        self,
        cats_ad_name: str,
        creative_name: str,
        article_name: str = "",
        operator_name: str = None,
        account_id: str = None,
        project_name: str = None,
        start_date: str = None,
    ) -> str:
        """広告名を生成する

        命名規則: {CATS広告名}/{CR名}/{記事名}/{運用担当者}/{案件名}/{開始日}
        例: lowc_bon_dir_f_fk_15-02/奥山_美容ジェネリック_A/m3-02aq/羽田/ローコスト/2026-03-21-00:00
        """
        if operator_name is None and account_id:
            # ad_accounts.operator_name から解決
            operator_name = self._resolve_operator(account_id)
        if operator_name is None:
            operator_name = self.config.get("operator_name", "")
        if project_name is None:
            project_name = self.project_name
        start_date = self._format_start_date(start_date)

        return f"{cats_ad_name}/{creative_name}/{article_name}/{operator_name}/{project_name}/{start_date}"

    def _resolve_operator(self, account_id: str) -> str:
        """ad_accounts.operator_name からアカウントの運用担当者名を取得."""
        for a in self.accounts:
            if a["account_id"] == account_id:
                return a.get("operator_name", "")
        return ""

    # ============================================================
    # バリュールール推測
    # ============================================================

    def get_value_rules(self, account_id: str) -> list[dict]:
        """指定アカウントのバリュールール一覧を取得する."""
        rules = (supabase.table("account_rules")
                 .select("id,rule_name,meta_rule_id")
                 .eq("account_id", account_id)
                 .eq("rule_type", "value_rule")
                 .execute())
        return rules.data

    def suggest_value_rule(self, account_id: str, appeal_name: str) -> dict | None:
        """訴求名からバリュールールを推測する.

        マッチングロジック:
        - 訴求名に「男性」を含む → 「男性ジェネリック」ルール
        - 訴求名に「美容」「女性」を含む → 「美容ジェネリック」ルール
        - 完全一致 > 部分一致の順で探す
        """
        rules = self.get_value_rules(account_id)
        if not rules:
            return None

        # 1. ルール名と訴求名の完全一致
        for rule in rules:
            if rule["rule_name"] == appeal_name:
                return rule

        # 2. キーワードマッチ
        appeal_lower = appeal_name.lower()
        keyword_map = {
            "男性": ["男性"],
            "美容": ["美容", "女性"],
        }
        for rule in rules:
            rule_name = rule["rule_name"]
            for key, keywords in keyword_map.items():
                if key in rule_name and any(kw in appeal_lower for kw in keywords):
                    return rule

        # 3. 部分一致 (訴求名の一部がルール名に含まれる)
        for rule in rules:
            if any(word in rule["rule_name"] for word in appeal_name.split("_") if len(word) >= 2):
                return rule

        return None

    # ============================================================
    # サブミッション構築
    # ============================================================

    def build_submission(
        self,
        account_id: str,
        creative_ids: list[int],
        article_lp_id: int,
        bid_strategy: str = "LOWEST_COST_WITHOUT_CAP",
        bid_amount: int = None,
        daily_budget: int = 60000,
        is_new_campaign: bool = True,
        existing_campaign_id: str = None,
        existing_adset_id: str = None,
        is_main: bool = True,
        test_content: str = "",
        start_date: str = None,
        include_audiences: list[dict] = None,
        exclude_audiences: list[dict] = None,
        value_rule_id: str = None,
    ) -> dict:
        """ウィザードの全回答から入稿データ構造を構築する

        Returns:
            {
                "submission": {...},  # ad_submissions レコード
                "campaign": {...},    # submission_campaigns レコード
                "adset": {...},       # submission_adsets レコード
                "ads": [{...}, ...],  # submission_ads レコード群
                "cats_settings": {...},  # CATS登録用
                "beyond_settings": {...},  # Beyond複製用
            }
        """
        # 設定解決
        settings = self.resolve_settings(article_lp_id)
        lp = settings["article_lp"]
        code = settings["client_code"]

        # 開始日
        formatted_date = self._format_start_date(start_date)  # e.g. "2026-03-21-00:00"
        # ISO形式 for Meta API start_time
        if start_date is None:
            tomorrow = datetime.now(JST) + timedelta(days=1)
            start_time_iso = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        else:
            # Parse YYYY-MM-DD-HH:MM or YYYY-MM-DD
            date_part = formatted_date[:10]  # "2026-03-21"
            start_time_iso = datetime.fromisoformat(date_part).replace(tzinfo=JST).isoformat()

        # CPN名生成
        campaign_name = self.generate_campaign_name(
            appeal_name=lp["appeal_name"],
            expression_type=lp["expression_type"],
            is_main=is_main,
            test_content=test_content,
            start_date=formatted_date,
        )

        # CR情報取得
        crs = (supabase.table("creatives")
               .select("id,creative_name,cr_url")
               .in_("id", creative_ids)
               .execute())
        creatives = {c["id"]: c for c in crs.data}

        # アカウントのアセット情報
        pixel = (supabase.table("account_assets")
                 .select("meta_asset_id")
                 .eq("account_id", account_id)
                 .eq("asset_type", "pixel")
                 .eq("is_default", True)
                 .limit(1).execute())
        pixel_id = pixel.data[0]["meta_asset_id"] if pixel.data else None

        # CVイベント
        cv_event = (supabase.table("account_conversion_events")
                    .select("meta_action_type")
                    .eq("account_id", account_id)
                    .eq("event_role", "cv")
                    .limit(1).execute())
        custom_event = cv_event.data[0]["meta_action_type"] if cv_event.data else "PURCHASE"

        # プリセット取得
        preset = None
        for p in self.presets.values():
            if p.get("account_id") == account_id:
                preset = p
                break
        if preset is None:
            preset = next(iter(self.presets.values()), {}) if self.presets else {}

        # geo targeting: presetのgeo_preset_idから取得
        geo_preset_id = preset.get("geo_preset_id") if preset else None
        if geo_preset_id:
            geo_row = supabase.table("geo_targeting_presets").select("config").eq("id", geo_preset_id).single().execute()
            geo_locations = json.loads(geo_row.data["config"]) if geo_row.data else {"countries": ["JP"]}
        else:
            geo_locations = {"countries": ["JP"]}

        # placement config from preset
        placement_preset_id = preset.get("placement_preset_id") if preset else None
        if placement_preset_id:
            pl_row = supabase.table("placement_presets").select("config,is_advantage_plus").eq("id", placement_preset_id).single().execute()
            if pl_row.data:
                pl_config = json.loads(pl_row.data["config"]) if pl_row.data["config"] else {}
                pl_config["is_advantage_plus"] = pl_row.data.get("is_advantage_plus", False)
                placement_config = pl_config
            else:
                placement_config = None
        else:
            placement_config = None

        # gender / age from preset
        gender_map = {"male": 1, "female": 2}
        preset_gender = preset.get("gender", 0) if preset else 0
        if isinstance(preset_gender, str):
            preset_gender = gender_map.get(preset_gender, 0)
        preset_age_min = preset.get("age_min", 18) if preset else 18
        preset_age_max = preset.get("age_max", 65) if preset else 65

        # 広告テキスト
        ad_body = preset.get("default_body") or "詳しくはこちら"
        ad_title = preset.get("default_title") or "詳しくはこちら"

        # 広告群を構築
        ads = []
        for cr_id in creative_ids:
            cr = creatives.get(cr_id)
            if not cr:
                continue

            ad_name = self.generate_ad_name(
                cats_ad_name=settings["cats_ad_name"],
                creative_name=cr["creative_name"],
                article_name=lp["slug"].split("-")[1] if "-" in lp["slug"] else lp["slug"],
                account_id=account_id,
                start_date=formatted_date,
            )

            ads.append({
                "ad_name": ad_name,
                "creative_id": cr_id,
                "creative_name": cr["creative_name"],
                "drive_url": cr.get("cr_url", ""),
                "body": ad_body,
                "title": ad_title,
                "description": "",
                "link_url": settings.get("link_url", ""),  # direct_click: 記事LP URL, middle_click: CATS登録後に確定
            })

        result = {
            "submission": {
                "account_id": account_id,
                "project_id": self.project_id,
                "status": "draft",
            },
            "campaign": {
                "campaign_name": campaign_name,
                "objective": "OUTCOME_SALES",
                "is_cbo": True,
                "bid_strategy": bid_strategy,
                "daily_budget": daily_budget,
                "status": "PAUSED",
                "is_new": is_new_campaign,
                "existing_campaign_id": existing_campaign_id,
            },
            "adset": {
                "adset_name": campaign_name,  # 広告セット名 = CPN名
                "optimization_goal": "OFFSITE_CONVERSIONS",
                "promoted_pixel_id": pixel_id,
                "promoted_custom_event": custom_event,
                "gender": preset_gender,
                "age_min": preset_age_min,
                "age_max": preset_age_max,
                "geo_locations": json.dumps(geo_locations),
                "placement_config": json.dumps(placement_config) if placement_config else None,
                "start_time": start_time_iso,
                "bid_amount": bid_amount,
                "include_custom_audiences": json.dumps(include_audiences) if include_audiences else None,
                "exclude_custom_audiences": json.dumps(exclude_audiences) if exclude_audiences else None,
                "value_rule_id": value_rule_id,
                "is_new": existing_adset_id is None,
                "existing_adset_id": existing_adset_id,
            },
            "ads": ads,
            "cats_settings": settings,
            "beyond_settings": {
                "slug": lp["slug"],
                "source_version": self.config.get("beyond_source_version", ""),
            },
        }

        return result

    def save_submission(self, data: dict) -> int:
        """build_submission()の結果をDBに保存する。submission_idを返す。"""
        # ad_submissions
        sub = supabase.table("ad_submissions").insert(data["submission"]).execute()
        submission_id = sub.data[0]["id"]

        # submission_campaigns
        camp_data = {**data["campaign"], "submission_id": submission_id}
        # Handle existing campaign: set meta_campaign_id so submit() skips creation
        existing_id = camp_data.pop("existing_campaign_id", None)
        is_new = camp_data.pop("is_new", True)
        if not is_new and existing_id:
            camp_data["meta_campaign_id"] = existing_id
        camp = supabase.table("submission_campaigns").insert(camp_data).execute()
        campaign_id = camp.data[0]["id"]

        # submission_adsets
        adset_data = {**data["adset"], "campaign_id": campaign_id}
        # Handle existing adset: set meta_adset_id so submit() skips creation
        existing_adset = adset_data.pop("existing_adset_id", None)
        adset_is_new = adset_data.pop("is_new", True)
        if not adset_is_new and existing_adset:
            adset_data["meta_adset_id"] = existing_adset
        # Remove None values to avoid DB issues
        adset_data = {k: v for k, v in adset_data.items() if v is not None}
        adset = supabase.table("submission_adsets").insert(adset_data).execute()
        adset_id = adset.data[0]["id"]

        # submission_ads
        for ad in data["ads"]:
            ad_data = {**ad, "adset_id": adset_id}
            # Remove fields not in DB schema
            ad_data.pop("creative_name", None)
            supabase.table("submission_ads").insert(ad_data).execute()

        return submission_id

    # ============================================================
    # サマリー表示
    # ============================================================

    def summary(self, settings: dict) -> str:
        """resolve_settings()結果のサマリー"""
        return f"""=== 入稿設定 ===
記事LP:     {settings['article_lp']['slug']}
            {settings['article_lp']['url']}
コード:     {settings['client_code']['label']}
            {settings['client_code']['url']}
CATS広告名: {settings['cats_ad_name']}
中間クリック: {settings['middle_click_url']}
Beyond:     {settings['beyond_slug']}
CATS設定:   client={settings['cats_config']['client_id']} group={settings['cats_config']['group_id']} partner={settings['cats_config']['partner_id']}"""

    def full_summary(self, data: dict) -> str:
        """build_submission()結果のフルサマリー"""
        camp = data["campaign"]
        adset = data["adset"]
        ads = data["ads"]
        cats = data["cats_settings"]

        bid_info = camp["bid_strategy"]
        if adset.get("bid_amount"):
            bid_info += f" (目標CPA: {adset['bid_amount']:,}円)"

        # CPN情報
        if camp.get("is_new", True):
            cpn_line = f"CPN:         [新規] {camp['campaign_name']}"
        else:
            cpn_line = f"CPN:         [既存に追加] {camp.get('existing_campaign_id', '')}"

        lines = [
            "=" * 60,
            "入稿サマリー",
            "=" * 60,
            f"アカウント:  {data['submission']['account_id']}",
            cpn_line,
            f"目的:        {camp['objective']}",
            f"入札戦略:    {bid_info}",
            f"日予算:      {camp['daily_budget']:,}円",
            f"記事LP:      {cats['article_lp']['slug']}",
            f"コード:      {cats['client_code']['label']}",
            f"CATS広告名:  {cats['cats_ad_name']}",
            f"Beyond:      {data['beyond_settings']['slug']}",
            f"開始:        {adset['start_time']}",
        ]

        # オーディエンス
        inc = adset.get("include_custom_audiences")
        exc = adset.get("exclude_custom_audiences")
        if inc:
            aud_list = json.loads(inc) if isinstance(inc, str) else inc
            names = ", ".join(a.get("name", a["id"]) for a in aud_list)
            lines.append(f"オーディエンス(含む): {names}")
        if exc:
            aud_list = json.loads(exc) if isinstance(exc, str) else exc
            names = ", ".join(a.get("name", a["id"]) for a in aud_list)
            lines.append(f"オーディエンス(除外): {names}")

        lines.append("")
        lines.append(f"--- 広告 ({len(ads)}本) ---")
        for i, ad in enumerate(ads, 1):
            lines.append(f"  {i}. {ad['ad_name']}")
            if ad.get("drive_url"):
                lines.append(f"     Drive: {ad['drive_url'][:60]}...")

        lines.append("=" * 60)
        return "\n".join(lines)


if __name__ == "__main__":
    wiz = SubmissionWizard("ローコスト")

    print("=== 記事LP選択肢 ===")
    for opt in wiz.get_article_lp_options():
        code_info = f"-> {opt['client_code_label']}" if opt['client_code_label'] else "-> コード未割当"
        print(f"  {opt['display']} ({opt['slug']}) {code_info}")

    print("\n=== アカウント選択肢 ===")
    for a in wiz.get_account_options():
        print(f"  {a['account_id']}: {a['name']}")

    # m3-02aq で設定解決テスト
    settings = wiz.resolve_settings(article_lp_id=4)
    print(f"\n{wiz.summary(settings)}")

    # CPN名テスト
    cpn = wiz.generate_campaign_name("男性ジェネリック", "実写", is_main=True)
    print(f"\nCPN名: {cpn}")

    # 広告名テスト
    ad_name = wiz.generate_ad_name(
        cats_ad_name="lowc_bon_dir_f_fk_15-02",
        creative_name="奥山_美容ジェネリック_A",
        article_name="m3-02aq",
    )
    print(f"広告名: {ad_name}")
