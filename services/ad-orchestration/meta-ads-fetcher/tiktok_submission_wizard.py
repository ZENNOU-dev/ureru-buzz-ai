"""TikTok入稿ウィザード - 対話型でTikTok広告の入稿設定を構築する

Claude Code会話内で以下のように使う:
    from tiktok_submission_wizard import TikTokSubmissionWizard
    wiz = TikTokSubmissionWizard(project_name="ローコスト")

    # Step 1: CR選択 → get_creative_options()
    # Step 2: 記事LP選択 → get_article_lp_options()
    # Step 3: キャンペーンタイプ (手動/Smart+)
    # Step 4: アカウント選択 → get_tiktok_accounts()
    # Step 5-8: 入札/予算/オーディエンス
    # Step 9: build_submission() → DB保存 + サマリー

命名規則はMeta版と統一:
  CPN: {訴求}_{表現}/メイン/{日付}
  広告: {CATS名}/{CR名}/{記事名}/{運用担当}/{案件名}/{日付}
"""

import json
import logging
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

from submission_wizard import ensure_creatives_synced  # CR同期はMeta版と共有

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
JST = ZoneInfo("Asia/Tokyo")
logger = logging.getLogger(__name__)


class TikTokSubmissionWizard:
    """TikTok広告入稿の対話型ウィザード."""

    def __init__(self, project_name: str):
        # Project
        proj = supabase.table("projects").select("id,name").eq("name", project_name).limit(1).execute()
        if not proj.data:
            raise ValueError(f"Project '{project_name}' not found")
        self.project_id = proj.data[0]["id"]
        self.project_name = proj.data[0]["name"]

        # TikTok presets
        presets = (supabase.table("tiktok_submission_presets")
                   .select("*")
                   .eq("project_id", self.project_id)
                   .execute())
        self.presets = presets.data

        # TikTok accounts (platform='tiktok' のみ)
        accounts = (supabase.table("ad_accounts")
                    .select("*")
                    .eq("project_id", self.project_id)
                    .eq("platform", "tiktok")
                    .execute())
        self.accounts = accounts.data

        # Article LPs
        lps = (supabase.table("article_lps")
               .select("id,lp_name,base_url,appeal_name,expression_type,beyond_page_id")
               .eq("project_id", self.project_id)
               .execute())
        self.article_lps = lps.data

        # Client codes
        codes = (supabase.table("client_codes")
                 .select("*")
                 .eq("project_id", self.project_id)
                 .execute())
        self.client_codes = codes.data

        # Config cache
        self.config = {}

    # ============================================================
    # Step 1: CR選択
    # ============================================================

    def get_creative_options(self) -> list[dict]:
        """案件のCR一覧を取得."""
        crs = (supabase.table("creatives")
               .select("id,creative_name,cr_url,project_id")
               .eq("project_id", self.project_id)
               .order("creative_name")
               .execute())
        return crs.data

    # ============================================================
    # Step 2: 記事LP選択
    # ============================================================

    def get_article_lp_options(self) -> list[dict]:
        """案件の記事LP一覧を取得."""
        return self.article_lps

    # ============================================================
    # Step 3-4: アカウント / プリセット
    # ============================================================

    def get_tiktok_accounts(self) -> list[dict]:
        """TikTokアカウント一覧."""
        return self.accounts

    def get_preset_options(self) -> list[dict]:
        """TikTokプリセット一覧."""
        return self.presets

    def get_preset(self, campaign_type: str) -> dict | None:
        """campaign_type (manual/smart_plus) に合うプリセットを取得."""
        for p in self.presets:
            if p["campaign_type"] == campaign_type:
                return p
        return self.presets[0] if self.presets else None

    # ============================================================
    # Step 5: 既存キャンペーン取得
    # ============================================================

    def get_existing_campaigns(self, advertiser_id: str) -> list[dict]:
        """TikTok APIから既存キャンペーン一覧を取得."""
        from tiktok_ad_manager import get_campaigns
        try:
            campaigns = get_campaigns(advertiser_id)
            # ACTIVE/DISABLE のみ (DELETE除外)
            return [c for c in campaigns
                    if c.get("operation_status") not in ("DELETE",)
                    and c.get("secondary_status") != "CAMPAIGN_STATUS_DELETE"]
        except Exception as e:
            logger.warning(f"Failed to fetch TikTok campaigns: {e}")
            return []

    # ============================================================
    # 名前生成 (Meta版と統一フォーマット)
    # ============================================================

    def _format_start_date(self, start_date: str = None) -> str:
        """開始日をフォーマットする."""
        if start_date is None:
            tomorrow = datetime.now(JST) + timedelta(days=1)
            return tomorrow.strftime("%Y-%m-%d-00:00")
        if len(start_date) == 4 and start_date.isdigit():
            year = datetime.now(JST).year
            return f"{year}-{start_date[:2]}-{start_date[2:]}-00:00"
        if len(start_date) == 10:
            return f"{start_date}-00:00"
        return start_date

    def _format_schedule_time(self, start_date: str = None) -> str:
        """TikTok API用のスケジュール開始時刻 (YYYY-MM-DD HH:MM:SS)."""
        if start_date is None:
            tomorrow = datetime.now(JST) + timedelta(days=1)
            return tomorrow.strftime("%Y-%m-%d 00:00:00")
        if len(start_date) == 4 and start_date.isdigit():
            year = datetime.now(JST).year
            return f"{year}-{start_date[:2]}-{start_date[2:]} 00:00:00"
        if len(start_date) == 10:
            return f"{start_date} 00:00:00"
        return start_date

    def generate_campaign_name(
        self,
        appeal_name: str,
        expression_type: str,
        is_main: bool = True,
        test_content: str = "",
        start_date: str = None,
    ) -> str:
        """CPN名生成 (Meta版と同一フォーマット)."""
        start_date = self._format_start_date(start_date)
        if is_main:
            return f"{appeal_name}_{expression_type}/メイン/{start_date}"
        else:
            return f"{appeal_name}_{expression_type}/検証/{test_content}/{start_date}"

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
        """広告名生成 (Meta版と同一フォーマット)."""
        if operator_name is None and account_id:
            operator_name = self._resolve_operator(account_id)
        if operator_name is None:
            operator_name = ""
        if project_name is None:
            project_name = self.project_name
        start_date = self._format_start_date(start_date)
        return f"{cats_ad_name}/{creative_name}/{article_name}/{operator_name}/{project_name}/{start_date}"

    def _resolve_operator(self, account_id: str) -> str:
        """アカウントの運用担当者名を取得."""
        for a in self.accounts:
            if a["account_id"] == account_id:
                return a.get("operator_name", "")
        return ""

    # ============================================================
    # サブミッション構築
    # ============================================================

    def get_cats_urls(self, article_lp_id: int = None) -> list[dict]:
        """案件のCATS URL一覧を取得（landing_page_url選択用）."""
        query = (supabase.table("cats_contents")
                 .select("cats_content_id,name,redirect_url,transition_type")
                 .eq("project_id", self.project_id)
                 .eq("is_active", True))
        if article_lp_id:
            query = query.eq("article_lp_id", article_lp_id)
        result = query.order("cats_content_id", desc=True).execute()
        return result.data

    def build_submission(
        self,
        account_id: str,
        creative_ids: list[int],
        article_lp_id: int,
        campaign_type: str = "manual",
        bid_type: str = "BID_TYPE_NO_BID",
        bid_amount: int | None = None,
        daily_budget: int = 60000,
        is_new_campaign: bool = True,
        existing_campaign_id: str = None,
        is_main: bool = True,
        test_content: str = "",
        start_date: str = None,
        custom_audiences: list[dict] = None,
        audience_suggestion: dict = None,
        landing_page_url: str = None,
    ) -> dict:
        """ウィザードの全回答からTikTok入稿データ構造を構築する.

        Returns:
            {
                "submission": {...},
                "campaign": {...},
                "adgroup": {...},
                "ads": [{...}, ...],
                "cats_settings": {...},
                "beyond_settings": {...},
            }
        """
        preset = self.get_preset(campaign_type)
        if not preset:
            raise ValueError(f"No TikTok preset found for campaign_type={campaign_type}")

        # Article LP情報解決
        lp = next((l for l in self.article_lps if l["id"] == article_lp_id), None)
        if not lp:
            raise ValueError(f"Article LP id={article_lp_id} not found")

        appeal_name = lp.get("appeal_name", "")
        expression_type = lp.get("expression_type", "")
        lp_name = lp.get("lp_name", "")
        article_name = lp_name

        # Client code解決 (CATSで使用)
        client_code = None
        for cc in self.client_codes:
            if cc.get("article_lp_id") == article_lp_id:
                client_code = cc
                break

        # 名前生成
        campaign_name = self.generate_campaign_name(
            appeal_name, expression_type, is_main, test_content, start_date
        )
        schedule_start = self._format_schedule_time(start_date)

        # Creative情報取得
        crs = (supabase.table("creatives")
               .select("id,creative_name,cr_url")
               .in_("id", creative_ids)
               .execute())
        cr_map = {c["id"]: c for c in crs.data}

        # Smart+: 1広告に全CR | 手動: 1広告につき1CR
        if campaign_type == "smart_plus":
            ads = [
                {
                    "ad_name": self.generate_ad_name(
                        "", "Smart+",
                        article_name, account_id=account_id,
                        start_date=start_date,
                    ),
                    "creative_ids": creative_ids,
                    "ad_text": preset.get("default_ad_text", ""),
                    "display_name": preset.get("default_display_name", ""),
                    "call_to_action": preset.get("default_call_to_action", "LEARN_MORE"),
                    "identity_id": preset.get("identity_id"),
                    "identity_type": preset.get("identity_type"),
                    "auto_enhance_disabled": preset.get("auto_enhance_disabled", True),
                }
            ]
        else:  # manual: 1 ad per CR
            ads = []
            for cr_id in creative_ids:
                cr = cr_map.get(cr_id, {})
                ad_name = self.generate_ad_name(
                    "",  # CATS名はsetup-ad-pipeline実行後に設定
                    cr.get("creative_name", f"CR_{cr_id}"),
                    article_name, account_id=account_id,
                    start_date=start_date,
                )
                ads.append({
                    "ad_name": ad_name,
                    "creative_ids": [cr_id],
                    "ad_text": preset.get("default_ad_text", ""),
                    "display_name": preset.get("default_display_name", ""),
                    "call_to_action": preset.get("default_call_to_action", "LEARN_MORE"),
                    "identity_id": preset.get("identity_id"),
                    "identity_type": preset.get("identity_type"),
                    "auto_enhance_disabled": preset.get("auto_enhance_disabled", True),
                })

        # landing_page_url: CATS redirect URL (UTMなし)
        # 未指定の場合は、記事LPに紐づくCATS URLを自動取得
        if not landing_page_url:
            cats_urls = self.get_cats_urls(article_lp_id)
            if cats_urls:
                landing_page_url = cats_urls[0].get("redirect_url", "")

        # campaign_automation_type
        automation_type = "UPGRADED_SMART_PLUS" if campaign_type == "smart_plus" else "MANUAL"

        # landing_page_urlを各広告に設定
        for ad in ads:
            ad["landing_page_url"] = landing_page_url

        return {
            "submission": {
                "project_id": self.project_id,
                "account_id": account_id,
                "preset_id": preset["id"],
                "campaign_type": campaign_type,
                "status": "draft",
            },
            "campaign": {
                "campaign_name": campaign_name,
                "objective_type": preset.get("objective_type", "WEB_CONVERSIONS"),
                "budget_mode": preset.get("budget_mode", "BUDGET_MODE_DYNAMIC_DAILY_BUDGET"),
                "budget": daily_budget,
                "status": preset.get("campaign_status", "DISABLE"),
                "campaign_automation_type": automation_type,
            },
            "adgroup": {
                "adgroup_name": campaign_name,  # CPN名と同一
                "placement_type": preset.get("placement_type", "PLACEMENT_TYPE_NORMAL"),
                "placements": preset.get("placements", ["TIKTOK"]),
                "optimize_goal": preset.get("optimize_goal", "CONVERT"),
                "bid_type": bid_type,
                "bid_amount": bid_amount,
                "billing_event": preset.get("billing_event", "OCPM"),
                "pixel_id": preset.get("pixel_id"),
                "optimization_event": preset.get("optimization_event", "SHOPPING"),
                "location_ids": preset.get("location_ids", [1850144, 1860291, 2113014, 1853226]),
                "languages": preset.get("languages", ["ja"]),
                "gender": preset.get("gender"),
                "age_groups": preset.get("age_groups"),
                "schedule_type": preset.get("schedule_type", "SCHEDULE_FROM_NOW"),
                "attribution_click_window": preset.get("attribution_click_window", "ONE_DAY"),
                "attribution_view_window": preset.get("attribution_view_window", "DISABLED"),
                "event_counting": preset.get("event_counting", "UNIQUE"),
                "comment_disabled": preset.get("comment_disabled", True),
                "video_download_disabled": preset.get("video_download_disabled", True),
                "share_disabled": preset.get("share_disabled", True),
                "promotion_type": preset.get("promotion_type", "WEBSITE"),
                "search_result_enabled": preset.get("search_result_enabled", True),
                "skip_learning_phase": preset.get("skip_learning_phase", True),
                "custom_audiences": custom_audiences or [],
                "audience_suggestion": audience_suggestion,
                "status": preset.get("adgroup_status", "ENABLE"),
            },
            "ads": ads,
            "existing_campaign_id": existing_campaign_id if not is_new_campaign else None,
            "cats_settings": {
                "article_lp": lp,
                "client_code": client_code,
            },
            "beyond_settings": {
                "lp_name": lp_name,
                "beyond_page_id": lp.get("beyond_page_id"),
            },
        }

    # ============================================================
    # DB保存
    # ============================================================

    def save_submission(self, data: dict) -> int:
        """build_submission() の結果をDBに保存する.

        Returns: submission_id
        """
        # 1. tiktok_submissions
        sub_result = supabase.table("tiktok_submissions").insert(
            data["submission"]
        ).execute()
        submission_id = sub_result.data[0]["id"]
        logger.info(f"Created TikTok submission: {submission_id}")

        # 2. tiktok_sub_campaigns
        camp_data = {**data["campaign"], "submission_id": submission_id}
        camp_result = supabase.table("tiktok_sub_campaigns").insert(camp_data).execute()
        campaign_db_id = camp_result.data[0]["id"]

        # 既存CPN再利用の場合
        if data.get("existing_campaign_id"):
            supabase.table("tiktok_sub_campaigns").update(
                {"tiktok_campaign_id": data["existing_campaign_id"]}
            ).eq("id", campaign_db_id).execute()

        # 3. tiktok_sub_adgroups
        ag_data = {**data["adgroup"], "campaign_id": campaign_db_id}
        # JSONB fields need serialization
        for key in ["placements", "location_ids", "languages", "age_groups",
                     "custom_audiences", "audience_suggestion"]:
            if key in ag_data and ag_data[key] is not None:
                if isinstance(ag_data[key], (list, dict)):
                    ag_data[key] = json.dumps(ag_data[key])
        ag_result = supabase.table("tiktok_sub_adgroups").insert(ag_data).execute()
        adgroup_db_id = ag_result.data[0]["id"]

        # 4. tiktok_sub_ads
        for ad in data["ads"]:
            ad_data = {
                **ad,
                "adgroup_id": adgroup_db_id,
                "creative_ids": json.dumps(ad["creative_ids"]),
            }
            supabase.table("tiktok_sub_ads").insert(ad_data).execute()

        logger.info(f"Saved TikTok submission {submission_id}: "
                     f"1 campaign, 1 adgroup, {len(data['ads'])} ads")
        return submission_id

    # ============================================================
    # サマリー表示
    # ============================================================

    def full_summary(self, data: dict) -> str:
        """入稿データのサマリーを生成."""
        s = data["submission"]
        c = data["campaign"]
        ag = data["adgroup"]
        ads = data["ads"]

        lines = [
            "## TikTok入稿サマリー",
            "",
            f"**案件**: {self.project_name}",
            f"**アカウント**: {s['account_id']}",
            f"**キャンペーンタイプ**: {s['campaign_type']}",
            "",
            "### キャンペーン",
            f"- 名前: {c['campaign_name']}",
            f"- 目的: {c['objective_type']}",
            f"- 日予算: ¥{c['budget']:,}",
            "",
            "### 広告グループ",
            f"- 入札: {ag['bid_type']}" + (f" (CPA: ¥{ag['bid_amount']:,})" if ag.get('bid_amount') else ""),
            f"- 最適化: {ag['optimize_goal']} / {ag['optimization_event']}",
            f"- 配信面: {ag['placement_type']}",
            f"- ロケーション: {ag.get('location_ids', [392])}",
            f"- スケジュール: {ag.get('schedule_start_time', '-')}〜",
            "",
            "### 広告",
        ]

        for i, ad in enumerate(ads, 1):
            cr_count = len(ad.get("creative_ids", []))
            lines.append(f"  {i}. {ad['ad_name']} ({cr_count}CR)")

        lines.extend([
            "",
            f"**合計**: {len(ads)}広告",
        ])

        return "\n".join(lines)
