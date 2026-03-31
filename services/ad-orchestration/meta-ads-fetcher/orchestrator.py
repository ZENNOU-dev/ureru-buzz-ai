"""入稿オーケストレーター: CATS登録 → Beyond Version複製 → Meta入稿.

1LP=1クライアントコードの設計に基づき、以下を自動化:

1. CATS: 広告(コンテンツ)登録 → redirect_url / middle_click_url 取得
2. Beyond: ソースVersion複製 → sbv=cats_content_id パラメータ設定
3. DB: cats_contents, ads テーブル更新
4. Meta: submission_engine.py で Campaign→Adset→Ad 作成

E2Eフロー (submission_wizard.py → orchestrator.py → submission_engine.py):
    wiz = SubmissionWizard("ローコスト")
    data = wiz.build_submission(...)  # 対話フローの結果
    result = run_e2e(data)            # CATS→Beyond→Meta一括実行

CLI:
    python3 orchestrator.py register --project ローコスト --slug lowc-m3-02aq-bonfk00 --code fk_14
    python3 orchestrator.py beyond-only --slug lowc-m3-02aq-bonfk00 --cats-id 4483
    python3 orchestrator.py check --project ローコスト --code fk_14
"""
import os
import sys
import json
import argparse
import time
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))


# ============================================================
# DB helpers
# ============================================================

def get_config(project_name: str, platform: str = "Meta") -> dict:
    """cats_project_config + article_lps + client_codes をロード."""
    from cats_automation import get_cats_config
    return get_cats_config(project_name, platform)


def resolve_client_code_label(config: dict, short_code: str) -> str:
    """fk_14 → lowc_bon_dir_f_fk_14"""
    prefix = config.get("ad_name_prefix", "")
    if not prefix:
        return short_code
    return f"{prefix}_bon_dir_f_{short_code}"


def get_client_code_url(config: dict, code_label: str) -> str:
    """クライアントコードlabelからURLを取得."""
    code_map = config.get("client_code_map", {})
    return code_map.get(code_label, config.get("final_lp_url", ""))


def get_next_seq(code_label: str) -> int:
    """cats_contentsから既存の連番を調べて次の番号を返す.

    新命名: lowc_bon_dir_f_fk_14-01 → 次は 02
    旧命名: lowc_bon_dir_f_fk_14 (連番なし) → 1件目として扱い、次は 02
    """
    # 新命名 (code_label-XX)
    new_style = (supabase.table("cats_contents")
                 .select("name")
                 .like("name", f"{code_label}-%")
                 .execute())
    # 旧命名 (code_label そのもの)
    old_style = (supabase.table("cats_contents")
                 .select("name")
                 .eq("name", code_label)
                 .execute())

    max_seq = 0
    if old_style.data:
        max_seq = 1  # 旧命名が存在 = 1件目
    for row in new_style.data:
        parts = row["name"].rsplit("-", 1)
        if len(parts) == 2 and parts[1].isdigit():
            max_seq = max(max_seq, int(parts[1]))
    return max_seq + 1


def make_ad_name(code_label: str, seq: int) -> str:
    """lowc_bon_dir_f_fk_14 + 01 → lowc_bon_dir_f_fk_14-01"""
    return f"{code_label}-{seq:02d}"


def get_existing_cats_content(ad_name: str) -> dict | None:
    """既登録のcats_contentsを返す."""
    result = (supabase.table("cats_contents")
              .select("*")
              .eq("name", ad_name)
              .limit(1).execute())
    return result.data[0] if result.data else None


# ============================================================
# CATS登録
# ============================================================

def register_cats(config: dict, ad_names: list[str], headed: bool = False) -> list[dict]:
    """CATS広告登録 + URL取得."""
    from playwright.sync_api import sync_playwright
    from cats_automation import (
        cats_login, register_content, fetch_click_urls,
        fetch_middle_click_urls, save_cats_content, CATS_URL,
    )

    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headed)
        page = browser.new_page()
        cats_login(page)

        for ad_name in ad_names:
            # 既登録チェック
            existing = get_existing_cats_content(ad_name)
            if existing and existing.get("redirect_url"):
                print(f"  {ad_name}: already registered (cats_content_id={existing['cats_content_id']})")
                results.append(existing)
                continue

            print(f"\n--- Registering: {ad_name} ---")
            result = register_content(page, config, ad_name)
            results.append(result)

        # URL取得
        if any(r.get("content_id") and not r.get("redirect_url") for r in results):
            print("\n--- Fetching URLs ---")
            click_urls = fetch_click_urls(page, config)
            middle_urls = fetch_middle_click_urls(page, config) if config["click_type"] == "middle_click" else []

            for r in results:
                if not r.get("content_id") or r.get("redirect_url"):
                    continue
                ad_name = r.get("ad_name") or r.get("name", "")
                for cu in click_urls:
                    if ad_name in cu.get("text", "") or cu.get("ad_name") == ad_name:
                        r["redirect_url"] = cu.get("redirect_url", "")
                        r["direct_param"] = cu.get("direct_param", "")
                        break
                for mu in middle_urls:
                    if ad_name in mu.get("text", ""):
                        r["middle_redirect_url"] = mu.get("middle_redirect_url", "")
                        r["middle_direct_param"] = mu.get("middle_direct_param", "")
                        break

        browser.close()

    # DB保存
    for r in results:
        cid = r.get("cats_content_id") or r.get("content_id")
        if not cid:
            continue
        content_data = {
            "cats_content_id": cid,
            "name": r.get("name") or r.get("ad_name", ""),
            "cats_client_id": config["cats_client_id"],
            "cats_group_id": config["cats_content_group_id"],
            "cats_partner_id": config["cats_partner_id"],
            "transition_type": config["click_type"],
            "project_id": config["project_id"],
            "status": "使用中",
            "redirect_url": r.get("redirect_url", ""),
            "middle_redirect_url": r.get("middle_redirect_url", ""),
            "middle_direct_param": r.get("middle_direct_param", ""),
            "is_active": True,
        }
        if config.get("default_article_lp_id"):
            content_data["article_lp_id"] = config["default_article_lp_id"]
        if config.get("default_client_code_id"):
            content_data["client_code_id"] = config["default_client_code_id"]
        save_cats_content(content_data)
        print(f"  DB saved: {content_data['name']} (cats={cid})")

    return results


# ============================================================
# Beyond Version複製
# ============================================================

def duplicate_beyond(slug: str, cats_content_id: int, source_version: str = None) -> dict | None:
    """Beyond Version複製 + sbv パラメータ設定.

    Args:
        slug: Beyond page slug
        cats_content_id: CATS content ID (= sbv parameter value)
        source_version: ソースVersion名 (default: config.beyond_source_version)
    Returns:
        dict with version info or None
    """
    from beyond_session import BeyondSession
    from beyond_duplicate_version import duplicate_version, get_versions

    with BeyondSession() as session:
        page = session.page

        # ソースVersion確認
        session.navigate(f"/ab_tests/{slug}/articles", wait_sec=5)
        versions = get_versions(page, slug)
        active = [v for v in versions if not v.get("archived")]
        print(f"  Active versions: {[v.get('memo','') for v in active]}")

        if not source_version:
            # 最初のアクティブVersionをソースに
            source_version = active[0].get("memo", "") if active else ""

        if not source_version:
            print("  ERROR: no source version found")
            return None

        # 複製 + パラメータ設定
        result = duplicate_version(session, slug, source_version, parameter=str(cats_content_id))

        if result:
            print(f"  Beyond duplicated: uid={result['uid']} sbv={cats_content_id}")
        return result


# ============================================================
# 入稿コード生成
# ============================================================

def generate_submission_code(cats_content: dict, config: dict) -> dict:
    """入稿に必要な情報をまとめて返す.

    Returns:
        {
            "ad_name": "lowc_bon_dir_f_fk_15",
            "cats_content_id": 4483,
            "link_url": "https://bnn.ac01.l-ad.net/cl/...",  ← Meta広告のリンク先
            "middle_click_url": "https://bnn.ac01.l-ad.net/mcl/...",  ← Beyond記事LP内のCTAリンク先
            "article_lp_url": "https://mouthpiece-lowcost.com/lp-b/?sb_tracking=true",
            "client_code_url": "https://ac.ad-growth.jp/...",
        }
    """
    return {
        "ad_name": cats_content.get("name", ""),
        "cats_content_id": cats_content.get("cats_content_id"),
        "link_url": cats_content.get("redirect_url", ""),
        "middle_click_url": cats_content.get("middle_redirect_url", ""),
        "article_lp_url": config.get("article_lp_url", ""),
        "client_code_url": get_client_code_url(config),
    }


# ============================================================
# E2E: ウィザード結果 → CATS → Beyond → Meta
# ============================================================

def run_e2e(data: dict, headed: bool = False, skip_beyond: bool = False,
            dry_run: bool = False) -> dict:
    """ウィザードの build_submission() 出力を受け取り、一気通貫で入稿する.

    Steps:
        1. CATS登録 → redirect_url取得
        2. Beyond Version複製 → sbv パラメータ設定
        3. 広告のlink_urlを更新 (redirect_url)
        4. submission_* テーブル保存
        5. Meta API入稿 (submission_engine.submit)

    Args:
        data: submission_wizard.build_submission() の戻り値
        headed: True=ブラウザ表示あり
        skip_beyond: True=Beyond複製スキップ
        dry_run: True=Meta APIを呼ばない

    Returns:
        {"cats_content_id": int, "beyond_uid": str, "submission_id": int, ...}
    """
    cats_settings = data["cats_settings"]
    beyond_settings = data["beyond_settings"]
    result = {"steps": []}

    # ---- Step 1: CATS登録 ----
    print("\n=== Step 1: CATS登録 ===")
    cats_ad_name = cats_settings["cats_ad_name"]
    cats_config = {
        "cats_client_id": cats_settings["cats_config"]["client_id"],
        "cats_content_group_id": cats_settings["cats_config"]["group_id"],
        "cats_partner_id": cats_settings["cats_config"]["partner_id"],
        "click_type": cats_settings["cats_config"]["click_type"],
        "project_id": data["submission"]["project_id"],
    }

    cats_results = register_cats(cats_config, [cats_ad_name], headed=headed)
    if not cats_results:
        raise RuntimeError(f"CATS登録失敗: {cats_ad_name}")

    cats_result = cats_results[0]
    cats_content_id = cats_result.get("cats_content_id") or cats_result.get("content_id")
    redirect_url = cats_result.get("redirect_url", "")

    result["cats_content_id"] = cats_content_id
    result["redirect_url"] = redirect_url
    result["steps"].append(f"CATS: {cats_ad_name} (id={cats_content_id})")
    print(f"  cats_content_id={cats_content_id}, redirect_url={redirect_url[:60]}...")

    # cats_contentsにarticle_lp_id, client_code_idを紐付け
    supabase.table("cats_contents").update({
        "article_lp_id": cats_settings["article_lp"]["id"],
        "client_code_id": cats_settings["client_code"]["id"],
    }).eq("cats_content_id", cats_content_id).execute()

    # ---- Step 2: Beyond Version複製 ----
    beyond_uid = None
    if not skip_beyond and cats_content_id:
        print("\n=== Step 2: Beyond Version複製 ===")
        slug = beyond_settings["slug"]
        source = beyond_settings.get("source_version", "")
        beyond_result = duplicate_beyond(slug, cats_content_id, source)
        if beyond_result:
            beyond_uid = beyond_result.get("uid")
            result["beyond_uid"] = beyond_uid
            result["steps"].append(f"Beyond: uid={beyond_uid} sbv={cats_content_id}")
    else:
        result["steps"].append("Beyond: skipped")

    # ---- Step 3: link_url + cats_content_id 更新 ----
    if redirect_url:
        print("\n=== Step 3: link_url + cats_content_id 更新 ===")
        for ad in data["ads"]:
            ad["link_url"] = redirect_url
            ad["cats_content_id"] = cats_content_id
        print(f"  {len(data['ads'])}件の広告にredirect_url + cats_content_id={cats_content_id} 設定")

    # ---- Step 4: submission_*テーブル保存 ----
    print("\n=== Step 4: DB保存 ===")
    from submission_wizard import SubmissionWizard
    # save_submission は SubmissionWizard のインスタンスメソッドだが、
    # ここではDBに直接書く
    sub_row = supabase.table("ad_submissions").insert(data["submission"]).execute()
    submission_id = sub_row.data[0]["id"]

    camp_data = {**data["campaign"], "submission_id": submission_id}
    camp_row = supabase.table("submission_campaigns").insert(camp_data).execute()
    campaign_db_id = camp_row.data[0]["id"]

    adset_data = {**data["adset"], "campaign_id": campaign_db_id}
    adset_row = supabase.table("submission_adsets").insert(adset_data).execute()
    adset_db_id = adset_row.data[0]["id"]

    for ad in data["ads"]:
        ad_row = {
            "adset_id": adset_db_id,
            "ad_name": ad["ad_name"],
            "creative_id": ad.get("creative_id"),
            "link_url": ad.get("link_url", ""),
            "body": ad.get("body", ""),
            "title": ad.get("title", ""),
            "description": ad.get("description", ""),
            "drive_url": ad.get("drive_url", ""),
        }
        if ad.get("cats_content_id"):
            ad_row["cats_content_id"] = ad["cats_content_id"]
        supabase.table("submission_ads").insert(ad_row).execute()

    result["submission_id"] = submission_id
    result["steps"].append(f"DB: submission_id={submission_id}")
    print(f"  submission_id={submission_id}")

    # ---- Step 5: Meta API入稿 ----
    if not dry_run:
        print("\n=== Step 5: Meta API入稿 ===")
        from submission_engine import submit
        meta_result = submit(submission_id, dry_run=False)
        result["meta_result"] = meta_result
        result["steps"].append(f"Meta: {meta_result.get('ads_created', 0)}件作成")
    else:
        print("\n=== Step 5: Meta API (dry-run) ===")
        from submission_engine import submit
        meta_result = submit(submission_id, dry_run=True)
        result["meta_result"] = meta_result
        result["steps"].append(f"Meta: dry-run ({meta_result.get('ads_created', 0)}件)")

    # サマリー
    print(f"\n{'='*60}")
    print("E2E完了")
    for step in result["steps"]:
        print(f"  {step}")
    print(f"{'='*60}")

    return result


# ============================================================
# メインコマンド
# ============================================================

def cmd_register(args):
    """新規入稿コード作成: CATS → Beyond → DB."""
    config = get_config(args.project, args.platform)
    slug = args.slug
    source = args.source or config.get("beyond_source_version", "")

    # クライアントコード名を解決
    code_label = resolve_client_code_label(config, args.code)
    code_url = get_client_code_url(config, code_label)
    if not code_url:
        print(f"ERROR: クライアントコード '{code_label}' が client_codes に見つかりません")
        return

    # 連番決定
    count = args.count or 1
    next_seq = get_next_seq(code_label)
    ad_names = [make_ad_name(code_label, next_seq + i) for i in range(count)]

    print(f"\n{'='*60}")
    print(f"入稿オーケストレーター: {args.project} x {args.platform}")
    print(f"  記事LP slug:     {slug}")
    print(f"  クライアントコード: {code_label}")
    print(f"  コードURL:        {code_url}")
    print(f"  広告名:           {ad_names}")
    print(f"  ソースVersion:    {source}")
    print(f"  click_type:       {config['click_type']}")
    print(f"{'='*60}")

    # Step 1: CATS登録
    print(f"\n--- Step 1: CATS登録 ---")
    cats_results = register_cats(config, ad_names, headed=args.headed)

    # Step 2: Beyond Version複製 (各広告ごと)
    if not args.skip_beyond:
        print(f"\n--- Step 2: Beyond Version複製 ---")
        for r in cats_results:
            cid = r.get("cats_content_id") or r.get("content_id")
            if not cid:
                print(f"  SKIP: {r.get('ad_name','?')} (no cats_content_id)")
                continue
            print(f"\n  Duplicating for cats_content_id={cid}...")
            beyond_result = duplicate_beyond(slug, cid, source)
            if beyond_result:
                r["beyond_uid"] = beyond_result.get("uid")

    # Step 3: 入稿コードまとめ
    print(f"\n{'='*60}")
    print(f"入稿コード一覧")
    print(f"{'='*60}")
    for r in cats_results:
        cid = r.get("cats_content_id") or r.get("content_id")
        name = r.get("name") or r.get("ad_name", "")
        redirect = r.get("redirect_url", "")
        middle = r.get("middle_redirect_url", "")
        beyond_uid = r.get("beyond_uid", "N/A")
        print(f"\n  {name}:")
        print(f"    cats_content_id: {cid}")
        print(f"    Meta link_url:   {redirect}")
        print(f"    中間クリックURL:  {middle}")
        print(f"    Beyond uid:      {beyond_uid}")
        print(f"    記事LP:          {config.get('article_lp_url', 'N/A')}?sbv={cid}")


def cmd_beyond_only(args):
    """既存CATS広告のBeyond Version複製のみ."""
    result = duplicate_beyond(args.slug, args.cats_id, args.source)
    if result:
        print(f"\n  Done: uid={result['uid']}")


def cmd_check(args):
    """入稿コード確認 (dry-run)."""
    config = get_config(args.project, args.platform)
    code_label = resolve_client_code_label(config, args.code)
    code_url = get_client_code_url(config, code_label)

    # 既存の連番を調べる
    existing = (supabase.table("cats_contents")
                .select("*")
                .like("name", f"{code_label}-%")
                .order("name")
                .execute())

    print(f"\n=== 入稿コード確認: {args.project} ===")
    print(f"  クライアントコード: {code_label}")
    print(f"  コードURL: {code_url}")
    print(f"  既存CATS登録数: {len(existing.data)}")

    for row in existing.data:
        code = generate_submission_code(row, config)
        print(f"\n  {row['name']}: REGISTERED")
        for k, v in code.items():
            print(f"    {k}: {v}")

    next_seq = get_next_seq(code_label)
    next_name = make_ad_name(code_label, next_seq)
    print(f"\n  次の広告名: {next_name}")


def main():
    parser = argparse.ArgumentParser(description="入稿オーケストレーター")
    sub = parser.add_subparsers(dest="command")

    # register
    reg = sub.add_parser("register", help="CATS登録 + Beyond複製 + DB保存")
    reg.add_argument("--project", required=True)
    reg.add_argument("--platform", default="Meta")
    reg.add_argument("--slug", required=True, help="Beyond page slug")
    reg.add_argument("--code", required=True, help="クライアントコード短縮名 (例: fk_14)")
    reg.add_argument("--count", type=int, default=1, help="作成数 (default: 1)")
    reg.add_argument("--source", help="ソースVersion名 (default: config)")
    reg.add_argument("--skip-beyond", action="store_true")
    reg.add_argument("--headed", action="store_true")

    # beyond-only
    bey = sub.add_parser("beyond-only", help="Beyond Version複製のみ")
    bey.add_argument("--slug", required=True)
    bey.add_argument("--cats-id", type=int, required=True)
    bey.add_argument("--source", help="ソースVersion名")

    # check
    chk = sub.add_parser("check", help="入稿コード確認")
    chk.add_argument("--project", required=True)
    chk.add_argument("--platform", default="Meta")
    chk.add_argument("--code", required=True, help="クライアントコード短縮名 (例: fk_14)")

    args = parser.parse_args()
    if args.command == "register":
        cmd_register(args)
    elif args.command == "beyond-only":
        cmd_beyond_only(args)
    elif args.command == "check":
        cmd_check(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
