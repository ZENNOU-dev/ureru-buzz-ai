"""CATS広告自動登録 + クリックURL取得.

Playwrightでl-ad.net管理画面を操作して:
1. 広告（コンテンツ）を登録
2. クリックURLの使用ステータスを「使用中」に変更
3. クリックURL / 中間クリックURL を取得
4. cats_contents + tracking_codes に保存

使い方:
    python cats_automation.py register --project ローコスト --platform Meta --names "fk_12,fk_13,fk_14"
    python cats_automation.py fetch-urls --project ローコスト --platform Meta
"""

import os
import sys
import json
import argparse
import time
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
from supabase import create_client

load_dotenv()

CATS_URL = os.getenv("CATS_LOGIN_URL", "https://bonnou.admin01.l-ad.net/admin/")
CATS_USER = os.getenv("CATS_USERNAME")
CATS_PASS = os.getenv("CATS_PASSWORD")

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))


# ============================================================
# DB helpers
# ============================================================

def get_cats_config(project_name: str, platform: str) -> dict:
    """cats_project_config から設定を取得。project名で自動解決。

    既存/新規の判断もここで行う:
    - cats_clients にproject_idが存在 → 既存クライアント
    - cats_project_config にレコード存在 → 設定済み
    """
    proj = supabase.table("projects").select("id").eq("name", project_name).limit(1).execute()
    if not proj.data:
        raise ValueError(f"Project '{project_name}' not found in projects table")
    project_id = proj.data[0]["id"]

    # cats_project_config を取得
    config = (supabase.table("cats_project_config")
              .select("*")
              .eq("project_id", project_id)
              .eq("platform", platform)
              .limit(1).execute())
    if not config.data:
        raise ValueError(
            f"CATS config not found for {project_name} x {platform}.\n"
            f"cats_project_config にレコードを追加してください。"
        )

    cfg = config.data[0]
    cfg["project_id"] = project_id
    cfg["project_name"] = project_name

    # 記事LP URL を article_lps から解決
    if not cfg.get("article_lp_url") and cfg.get("default_article_lp_id"):
        lp = (supabase.table("article_lps")
              .select("base_url")
              .eq("id", cfg["default_article_lp_id"])
              .limit(1).execute())
        if lp.data:
            cfg["article_lp_url"] = lp.data[0]["base_url"]

    # クライアント発行コードURL一覧をロード
    client_codes = (supabase.table("client_codes")
                    .select("id,code_name,base_url")
                    .eq("project_id", project_id)
                    .eq("is_active", True)
                    .execute())
    cfg["client_code_map"] = {
        row["code_name"]: row["base_url"] for row in client_codes.data
    }

    # デフォルトのfinal_lp_url (default_client_code_idがある場合)
    if not cfg.get("final_lp_url") and cfg.get("default_client_code_id"):
        match = next(
            (row for row in client_codes.data
             if row["id"] == cfg["default_client_code_id"]),
            None
        )
        if match:
            cfg["final_lp_url"] = match["base_url"]

    return cfg


def get_next_ad_names(config: dict, names: list[str]) -> list[str]:
    """広告名を生成。案件別テンプレートを使用。

    テンプレート例:
      - '{prefix}_bon_dir_f_{seq}' → lowc_bon_dir_f_fk_12
      - '{prefix}-{seq}'           → aht_lp_1f_new_bon001-01
    """
    prefix = config.get("ad_name_prefix", "")
    template = config.get("ad_name_template", "")
    if not prefix:
        return names
    if not template:
        # テンプレ未設定時はデフォルト (prefix-seq)
        template = "{prefix}-{seq}"
    return [template.format(prefix=prefix, seq=n) for n in names]


def save_cats_content(content_data: dict):
    """cats_contentsにUPSERT。"""
    supabase.table("cats_contents").upsert(
        content_data, on_conflict="cats_content_id"
    ).execute()


# ============================================================
# Playwright CATS操作
# ============================================================

def cats_login(page):
    """CATSにログイン。"""
    page.goto(CATS_URL)
    page.wait_for_load_state("networkidle")
    login_form = page.query_selector("input[name='loginId']")
    if login_form:
        page.fill("input[name='loginId']", CATS_USER)
        page.fill("input[name='password']", CATS_PASS)
        page.click("input[type='submit'], button[type='submit']")
        page.wait_for_load_state("networkidle")
    print(f"  Logged in: {page.url}")


def resolve_client_code_url(config: dict, ad_name: str) -> str:
    """広告名に対応するクライアントコードURLを解決する。"""
    code_map = config.get("client_code_map", {})
    # 完全一致
    if ad_name in code_map:
        return code_map[ad_name]
    # ad_name_prefix付き名前で検索 (e.g. "lowc_bon_dir_f_fk_12")
    for label, url in code_map.items():
        if label == ad_name:
            return url
    # フォールバック: デフォルト
    return config.get("final_lp_url", "")


def register_content(page, config: dict, ad_name: str,
                     article_lp_url: str = None, final_lp_url: str = None) -> dict:
    """CATS管理画面で広告（コンテンツ）を1件登録。

    別プロジェクトの実装ガイドに準拠:
    - iCheck: jQuery(el).iCheck('check') 必須
    - SumoSelect: 媒体選択はUIクリック + AJAX待機
    - 確認→登録の2段階フロー + SweetAlert2ダイアログ

    冪等性: 同名の広告が既に存在する場合はスキップしてcontent_idを返す。

    Returns: dict with content_id, redirect_url, direct_param, etc.
    """
    # --- 冪等性チェック: 同名のコンテンツが既に存在するかDB確認 ---
    try:
        from database import get_client as _get_sb
        sb = _get_sb()
        existing = sb.table("cats_contents").select(
            "cats_content_id,name,redirect_url,direct_param,middle_redirect_url,middle_direct_param"
        ).eq("name", ad_name).limit(1).execute()
        if existing.data:
            row = existing.data[0]
            print(f"  IDEMPOTENT SKIP: '{ad_name}' already exists (cats_content_id={row['cats_content_id']})")
            return {
                "ad_name": ad_name,
                "content_id": row["cats_content_id"],
                "redirect_url": row.get("redirect_url", ""),
                "direct_param": row.get("direct_param", ""),
                "middle_redirect_url": row.get("middle_redirect_url", ""),
                "middle_direct_param": row.get("middle_direct_param", ""),
                "skipped": True,
            }
    except Exception as e:
        print(f"  WARNING: Idempotency check failed ({e}), proceeding with registration")

    page.goto(CATS_URL + "content/register")
    page.wait_for_load_state("networkidle")
    time.sleep(1)

    click_type = config["click_type"]

    # --- 広告主 ---
    page.select_option("select[name='useClientId']", str(config["cats_client_id"]))
    time.sleep(0.5)

    # --- 広告グループ ---
    page.select_option("select[name='useGroupId']", str(config["cats_content_group_id"]))
    time.sleep(0.5)

    # --- 広告名 ---
    page.fill("input[name='name']", ad_name)

    # --- クリックURL同時発行: OFF (デフォルトのまま) ---
    # URLはclicktag/listから別途取得する

    # --- 媒体（パートナー）: SumoSelect ---
    # SumoSelectは通常のselect操作不可 → .CaptionContクリック → li.optクリック + AJAX待機
    partner_id = str(config["cats_partner_id"])
    page.evaluate(f"""() => {{
        const sumoContainers = document.querySelectorAll('.SumoSelect');
        for (const container of sumoContainers) {{
            const sel = container.querySelector('select');
            if (!sel) continue;
            const hasPartner = Array.from(sel.options).some(o => o.value === '{partner_id}');
            if (!hasPartner) continue;
            const caption = container.querySelector('.CaptionCont');
            if (caption) caption.click();
            return true;
        }}
        return false;
    }}""")
    time.sleep(0.5)

    page.evaluate(f"""() => {{
        const opts = document.querySelectorAll('.SumoSelect .optWrapper li.opt');
        for (const opt of opts) {{
            if (opt.getAttribute('data-val') === '{partner_id}'
                || opt.textContent.includes('{partner_id}:')) {{
                opt.click();
                return true;
            }}
        }}
        return false;
    }}""")
    time.sleep(2)  # AJAX発火待機
    print(f"  媒体: partner_id={partner_id}")

    # --- OS: 全て ---
    page.evaluate("""() => {
        document.querySelectorAll("input[name='os[]']").forEach(cb => {
            cb.checked = true;
        });
    }""")

    resolved_final_lp = final_lp_url or resolve_client_code_url(config, ad_name)
    article_lp = article_lp_url or config.get("article_lp_url", "")

    # --- 遷移広告URL ---
    # click_type によって遷移先が異なる:
    #   middle_click: 遷移広告URL = 記事LP → 中間クリックURL = クライアントコード
    #   direct_click: 遷移広告URL = クライアントコード（記事LPはMeta入稿で直接使う）
    if click_type == "direct_click":
        transition_url = resolved_final_lp
    else:
        transition_url = article_lp

    page.fill("input[name='url[url1][urlName]']", ad_name)
    page.fill("input[name='url[url1][iosUrl]']", transition_url)
    page.fill("input[name='url[url1][androidUrl]']", transition_url)
    page.fill("input[name='url[url1][otherUrl]']", transition_url)
    print(f"  遷移広告URL: {transition_url}")

    # --- 中間クリック ---
    if click_type == "middle_click":
        # まずONにする (iCheck) → disabled解除待ち
        page.evaluate("""() => {
            const el = document.querySelector("input[name='useMiddleClickStatus'][value='1']");
            if (el) $(el).iCheck('check');
        }""")
        time.sleep(1)

        # 中間クリックURL = クライアントコードURL + url_suffix (案件別)
        url_suffix = config.get("url_suffix", "")
        if url_suffix:
            sep = "&" if "?" in resolved_final_lp else "?"
            # url_suffix が & で始まる場合はsepを使う
            suffix = url_suffix.lstrip("&?")
            middle_url = f"{resolved_final_lp}{sep}{suffix}"
        else:
            middle_url = resolved_final_lp

        # disabled解除 + 値設定 (iCheckのifCheckedイベントで解除されるはずだがJSで確実に)
        page.evaluate(f"""() => {{
            ['useMiddleClickIosUrl', 'useMiddleClickAndroidUrl', 'useMiddleClickOtherUrl'].forEach(name => {{
                const inp = document.querySelector("input[name='" + name + "']");
                if (inp) {{ inp.disabled = false; inp.value = '{middle_url}'; }}
            }});
            const script = document.querySelector("textarea[name='middleClickExecScript']");
            if (script) script.disabled = false;
        }}""")
        print(f"  中間クリックURL: {middle_url}")
    else:
        page.evaluate("""() => {
            const el = document.querySelector("input[name='useMiddleClickStatus'][value='0']");
            if (el) $(el).iCheck('check');
        }""")

    # --- 成果地点のポストバックをON ---
    # 案件別: 購入=6, 登録完了=10, リード=5 等
    postback_point = config.get("cats_postback_point", 10)
    postback_labels = {6: "購入", 7: "支払い完了", 8: "ページビュー", 9: "コンテンツビュー", 10: "登録完了"}
    page.evaluate(f"""() => {{
        const pb = document.querySelector("input[name='catsPointBack[{postback_point}]']");
        if (pb && !pb.checked) {{
            if (typeof $ !== 'undefined' && $.fn.iCheck) {{
                $(pb).iCheck('check');
            }} else {{
                pb.checked = true;
            }}
        }}
    }}""")
    time.sleep(0.3)
    print(f"  成果地点: {postback_labels.get(postback_point, f'PointBack[{postback_point}]')}ポストバックON")

    # --- 確認ボタン → 確認ページ → 登録ボタン → SweetAlert2 ---
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    time.sleep(0.5)

    confirm_btn = page.locator("button:has-text('確認'):not(:has-text('CSV'))")
    if confirm_btn.count() > 0:
        confirm_btn.first.click()
    else:
        # Fallback: type=submit の確認ボタン
        page.locator("button[type='submit']:has-text('確認')").first.click()
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    print(f"  確認ページ: {page.url}")

    # バリデーションエラーチェック
    errors = page.evaluate("""() => {
        // 各種エラー表示パターンを探す
        const result = [];
        // .alert, .text-danger, .has-error
        document.querySelectorAll('.alert, .text-danger, .has-error, .error-message, .callout-danger').forEach(el => {
            const t = el.innerText.trim();
            if (t && t.length < 200) result.push(t);
        });
        // red colored text
        document.querySelectorAll('[style*="color: red"], [style*="color:red"]').forEach(el => {
            const t = el.innerText.trim();
            if (t) result.push(t);
        });
        return result;
    }""")
    if errors:
        print(f"  バリデーションエラー: {errors}")

    # 確認ページかフォームか判定（登録ボタンの有無で判断）
    has_register_btn = page.locator("button:has-text('登録')").count() > 0
    has_confirm_btn = page.locator("button[type='submit']:has-text('確認')").count() > 0

    if has_confirm_btn and not has_register_btn:
        # まだフォーム。確認ページに進めていない
        # フォームの入力状態をダンプ
        form_state = page.evaluate("""() => {
            const result = {};
            // 各inputの状態
            ['name', 'useClientId', 'useGroupId', 'clickUrlIssue',
             'redirectorUrl[ios]', 'useMiddleClickStatus',
             'useMiddleClickIosUrl'].forEach(name => {
                const el = document.querySelector(`[name='${name}']`);
                if (el) result[name] = {value: el.value, disabled: el.disabled, checked: el.checked, visible: el.offsetParent !== null};
            });
            // 成果地点の状態
            const seika = document.querySelectorAll('[name*="useMeasurement"]');
            result['成果地点count'] = seika.length;
            return result;
        }""")
        print(f"  フォーム状態: {json.dumps(form_state, ensure_ascii=False, indent=2)}")
        page.screenshot(path="/Users/yumhahada/ad-orchestration/debug_cats_validation_error.png",
                        full_page=True)
        print(f"  Screenshot: debug_cats_validation_error.png")
        return {"content_id": 0, "ad_name": ad_name, "error": f"validation failed: {errors}"}

    # 登録ボタンを探してクリック (type="button", not "submit")
    register_btn = None
    for selector in [
        "button.btn-primary[type='button']:has-text('登録')",
        "button[type='button']:has-text('登録')",
        "button:has-text('登録')",
    ]:
        loc = page.locator(selector)
        if loc.count() > 0:
            register_btn = loc.first
            break

    if register_btn:
        register_btn.scroll_into_view_if_needed()
        time.sleep(0.3)
        register_btn.click()
        print(f"  登録ボタンクリック")
    else:
        print(f"  WARNING: 登録ボタンが見つかりません")
        return {"content_id": 0, "ad_name": ad_name}

    # SweetAlert2 ダイアログ → 「はい」クリック
    time.sleep(1)
    for attempt in range(15):
        swal_btn = page.locator("button.swal2-confirm")
        if swal_btn.count() > 0 and swal_btn.first.is_visible():
            swal_btn.first.click()
            print(f"  SweetAlert2: confirmed (attempt {attempt+1})")
            break
        time.sleep(0.5)
    time.sleep(3)  # DB書込み待ち

    print(f"  登録完了: {page.url}")

    # --- content_idを取得 ---
    result = {"ad_name": ad_name, "content_id": 0}
    content_id = find_content_id_by_name(page, config["cats_client_id"], ad_name)
    result["content_id"] = content_id
    print(f"  content_id={content_id}")

    # --- クリックURL使用ステータスを「使用中」に変更 ---
    if content_id:
        activate_click_url(page, config, content_id, ad_name)

    return result


def find_content_id_by_name(page, cats_client_id: int, ad_name: str) -> int:
    """広告一覧から広告IDを取得。"""
    # 広告一覧ページで検索
    page.goto(CATS_URL + "content/list")
    page.wait_for_load_state("networkidle")
    time.sleep(1)

    # テーブルから広告名でマッチするIDを取得
    content_id = page.evaluate(f"""() => {{
        const rows = document.querySelectorAll('table tbody tr');
        for (const row of rows) {{
            const text = row.innerText;
            if (text.includes('{ad_name}')) {{
                // 広告IDはテーブルの2番目のセル (広告ID列)
                const cells = row.querySelectorAll('td');
                for (const cell of cells) {{
                    const t = cell.innerText.trim();
                    if (/^\\d+$/.test(t) && parseInt(t) > 1000) return parseInt(t);
                }}
            }}
        }}
        return 0;
    }}""")

    if content_id:
        return content_id

    # Fallback: clicktag/listのselectオプションから
    page.goto(CATS_URL + "clicktag/list")
    page.wait_for_load_state("networkidle")
    time.sleep(1)

    content_id = page.evaluate(f"""() => {{
        const options = document.querySelectorAll("select option");
        for (const opt of options) {{
            if (opt.text.includes('{ad_name}') && /^\\d+$/.test(opt.value)) {{
                return parseInt(opt.value);
            }}
        }}
        return 0;
    }}""")

    if not content_id:
        print(f"  WARNING: Could not find content_id for '{ad_name}'")
    return content_id


def _clicktag_search(page, config: dict, include_stopped: bool = True):
    """clicktag/listページで絞り込み検索を実行する共通関数。

    1. 「絞り込み検索」ボタンでフォーム展開
    2. 検索条件入力 (媒体/広告主/広告グループ)
    3. 使用ステータス設定
    4. 「検索」ボタンクリック
    """
    # 「絞り込み検索」ボタンをクリックしてフォームを展開
    page.evaluate("""() => {
        const btns = document.querySelectorAll('button, a');
        for (const btn of btns) {
            if (btn.innerText.trim() === '絞り込み検索') {
                btn.click();
                return true;
            }
        }
        return false;
    }""")
    time.sleep(1)

    # 検索条件入力 — selectはname=""でid属性で識別される
    partner_id = str(config["cats_partner_id"])
    client_id = str(config["cats_client_id"])
    group_id = str(config["cats_content_group_id"])

    # id指定でselect_option + changeイベント発火
    for sel_id, val in [
        ("searchPartnerIdList", partner_id),
        ("searchClientIdList", client_id),
        ("searchGroupIdList", group_id),
    ]:
        sel = page.locator(f"#{sel_id}")
        if sel.count() > 0:
            page.select_option(f"#{sel_id}", val)
            page.evaluate(f"""() => {{
                const s = document.getElementById('{sel_id}');
                if (s) s.dispatchEvent(new Event('change', {{bubbles: true}}));
            }}""")
            time.sleep(0.5)
    print(f"  検索条件: partner={partner_id} client={client_id} group={group_id}")
    time.sleep(0.5)

    # 使用ステータス: 停止中(value=0)も含める場合
    # searchAliveStatus[] の value=0 checkbox をONにする (iCheck管理)
    if include_stopped:
        page.evaluate("""() => {
            const cbs = document.querySelectorAll('input[name="searchAliveStatus[]"]');
            cbs.forEach(cb => {
                if (!cb.checked) {
                    if (typeof $ !== 'undefined' && $.fn.iCheck) {
                        $(cb).iCheck('check');
                    } else {
                        cb.checked = true;
                    }
                }
            });
        }""")
        time.sleep(0.3)

    # 検索ボタンクリック (#searchFormSubmitBtn)
    search_btn = page.locator("#searchFormSubmitBtn")
    if search_btn.count() > 0:
        search_btn.first.click()
        print("  検索ボタン: clicked")
    else:
        # Fallback
        page.evaluate("""() => {
            const btn = document.querySelector('button[type="submit"]');
            if (btn) btn.click();
        }""")
        print("  検索ボタン: fallback")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    # 検索結果件数を確認
    count_text = page.evaluate("""() => {
        const el = document.querySelector('.dataTables_info, [id*="info"]');
        return el ? el.innerText.trim() : 'count unknown';
    }""")
    print(f"  検索結果: {count_text}")


def activate_click_url(page, config: dict, content_id: int, ad_name: str):
    """クリックURL一覧で使用ステータスを「停止中」→「使用中」に変更。"""
    page.goto(CATS_URL + "clicktag/list")
    page.wait_for_load_state("networkidle")
    time.sleep(1)

    _clicktag_search(page, config, include_stopped=True)

    # テーブルから該当行を見つけて使用ステータスを変更
    # Bootstrap Toggle: checkbox.clickTagStatus — checked=true=使用中, checked=false=停止中
    activated = page.evaluate(f"""() => {{
        const rows = document.querySelectorAll('table tbody tr');
        for (const row of rows) {{
            const text = row.innerText;
            if (!text.includes('{ad_name}') && !text.includes('{content_id}')) continue;

            const toggle = row.querySelector('input.clickTagStatus');
            if (toggle) {{
                if (!toggle.checked) {{
                    // 停止中 → .toggleのdivをクリックして使用中に変更
                    const toggleDiv = toggle.closest('.toggle');
                    if (toggleDiv) {{ toggleDiv.click(); return 'toggled'; }}
                    return 'toggle_not_clickable';
                }} else {{
                    return 'already_active';
                }}
            }}
        }}
        return 'not_found';
    }}""")
    print(f"  使用ステータス: {activated}")

    if activated in ("toggled", "toggled_label", "clicked_停止中"):
        time.sleep(2)
        # 確認ダイアログがある場合
        swal_btn = page.locator("button.swal2-confirm")
        if swal_btn.count() > 0 and swal_btn.first.is_visible():
            swal_btn.first.click()
            time.sleep(1)
        # ページをリロードして反映を確認
        page.reload()
        page.wait_for_load_state("networkidle")
        time.sleep(1)
        print(f"  使用中に変更完了")


def fetch_click_urls(page, config: dict, content_id: int = None) -> list[dict]:
    """クリックURL一覧からリダイレクトURL情報を取得。

    clicktag/listで検索条件を絞り、テーブルからURL抽出。
    スクリーンショットの通り: 媒体/広告主/広告グループで絞り込み → 検索 → リダイレクトURLカラムから取得。
    """
    page.goto(CATS_URL + "clicktag/list")
    page.wait_for_load_state("networkidle")
    time.sleep(1)

    _clicktag_search(page, config, include_stopped=True)

    # テーブルからデータ抽出
    # リダイレクトURLカラム + 広告名を取得
    data = page.evaluate("""() => {
        const rows = document.querySelectorAll('table tbody tr');
        const results = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;
            const text = row.innerText.substring(0, 400);
            const result = {text};

            // 広告名を抽出 (4479:lowc_bon_dir_f_fk_11 のような形式)
            // 4桁以上のID + : + 広告名(lowc_等で始まる)
            const nameMatch = text.match(/(\\d{4,}):(\\w+_bon_\\w+)/);
            if (nameMatch) { result.content_id_str = nameMatch[1]; result.ad_name = nameMatch[2]; }

            // リダイレクトURL: input[type="text"] or コピーボタンのonclick
            const inputs = row.querySelectorAll('input[type="text"].form-control');
            inputs.forEach(inp => {
                const v = inp.value || '';
                if (v.includes('l-ad.net/cl/')) result.redirect_url = v;
                if (v.includes('uqid=') || v.includes('bid=')) result.direct_param = v;
            });

            // コピーボタンからも取得
            const copyBtns = row.querySelectorAll('[onclick*="urlCopy"]');
            copyBtns.forEach(btn => {
                const match = btn.getAttribute('onclick')?.match(/urlCopy\\(['"]([^'"]+)['"]/);
                if (match) {
                    const url = match[1];
                    if (url.includes('/cl/') && !result.redirect_url) result.redirect_url = url;
                    if ((url.includes('uqid=') || url.includes('bid=')) && !result.direct_param)
                        result.direct_param = url;
                }
            });

            if (result.redirect_url || result.ad_name) results.push(result);
        });
        return results;
    }""")

    print(f"  Found {len(data)} click URLs")
    return data


def fetch_middle_click_urls(page, config: dict) -> list[dict]:
    """中間クリックURL一覧からURL情報を取得。"""
    if config["click_type"] != "middle_click":
        return []

    page.goto(CATS_URL + "middleclicktag/list")
    page.wait_for_load_state("networkidle")
    time.sleep(1)

    # 検索条件を設定 (select名を自動検出)
    selects_data = page.evaluate("""() => {
        return Array.from(document.querySelectorAll('select')).map(s => ({
            name: s.name, options: Array.from(s.options).slice(0,3).map(o => ({v: o.value, t: o.text}))
        })).filter(s => s.name);
    }""")
    print(f"  Middle click page selects: {[s['name'] for s in selects_data]}")

    # 広告主で絞り込み
    client_id = str(config["cats_client_id"])
    for sel_info in selects_data:
        name = sel_info["name"]
        has_client = any(o["v"] == client_id for o in sel_info["options"])
        if has_client or "client" in name.lower():
            try:
                page.select_option(f"select[name='{name}']", client_id)
                time.sleep(0.3)
            except Exception:
                pass

    # 検索
    search_btn = page.locator("button:has-text('検索'), input[value='検索']")
    if search_btn.count() > 0:
        search_btn.first.click()
    page.wait_for_load_state("networkidle")
    time.sleep(1)

    # テーブルからデータ抽出
    data = page.evaluate("""() => {
        const rows = document.querySelectorAll('table tbody tr');
        const results = [];
        rows.forEach(row => {
            const text = row.innerText.substring(0, 400);
            const result = {text};
            // 広告名抽出
            const nameMatch = text.match(/\\d+:([\\w_]+)/);
            if (nameMatch) result.ad_name = nameMatch[1];
            // 中間クリックURL: input[type="text"].form-control のvalue (cell 5)
            const inputs = row.querySelectorAll('input[type="text"].form-control');
            inputs.forEach(inp => {
                const v = inp.value || '';
                if (v.includes('l-ad.net/mcl/') || v.includes('l-ad.net/md/')) result.middle_redirect_url = v;
                if (v.includes('mbid=')) result.middle_direct_param = v;
            });
            // コピーボタンからも
            row.querySelectorAll('[onclick*="urlCopy"]').forEach(btn => {
                const m = btn.getAttribute('onclick')?.match(/urlCopy\\(['"]([^'"]+)['"]/);
                if (m) {
                    const url = m[1];
                    if ((url.includes('/mcl/') || url.includes('/md/')) && !result.middle_redirect_url)
                        result.middle_redirect_url = url;
                    if (url.includes('mbid=') && !result.middle_direct_param)
                        result.middle_direct_param = url;
                }
            });
            if (result.middle_redirect_url || result.ad_name) results.push(result);
        });
        return results;
    }""")

    print(f"  Found {len(data)} middle click URLs")
    return data


# ============================================================
# メインコマンド
# ============================================================

def cmd_register(args):
    """広告登録コマンド。"""
    config = get_cats_config(args.project, args.platform)
    names = [n.strip() for n in args.names.split(",")]
    ad_names = get_next_ad_names(config, names)

    print(f"\n=== CATS広告登録 ===")
    print(f"  案件: {args.project} (project_id={config['project_id']})")
    print(f"  Platform: {args.platform}")
    print(f"  CATS Client: {config['cats_client_id']}")
    print(f"  CATS Partner: {config['cats_partner_id']}")
    print(f"  CATS Group: {config['cats_content_group_id']}")
    print(f"  Click type: {config['click_type']}")
    print(f"  Article LP: {config.get('article_lp_url', 'N/A')}")
    print(f"  Final LP: {config.get('final_lp_url', 'N/A')}")
    print(f"  広告名: {ad_names}")

    article_lp = args.article_lp or config.get("article_lp_url")
    # final_lp: CLI引数で明示された場合のみ使う。
    # 未指定時はNone → register_content内で広告名ごとにclient_code_mapから解決
    final_lp = args.final_lp  # config.get("final_lp_url") は使わない

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        page = browser.new_page()
        cats_login(page)

        registered = []
        for ad_name in ad_names:
            print(f"\n--- Registering: {ad_name} ---")
            try:
                result = register_content(page, config, ad_name, article_lp, final_lp)
                registered.append(result)
            except Exception as e:
                print(f"  ERROR: {e}")
                registered.append({"ad_name": ad_name, "content_id": 0, "error": str(e)})

        # クリックURL取得 (clicktag/listから検索)
        print(f"\n--- Fetching click URLs ---")
        click_urls = fetch_click_urls(page, config)

        # 中間クリックURL取得 (middle_clickの場合)
        middle_urls = []
        if config["click_type"] == "middle_click":
            print(f"\n--- Fetching middle click URLs ---")
            middle_urls = fetch_middle_click_urls(page, config)

        browser.close()

    # DB保存
    print(f"\n=== Saving to DB ===")
    for reg in registered:
        if not reg.get("content_id"):
            print(f"  SKIP: {reg['ad_name']} (no content_id)")
            continue

        content_data = {
            "cats_content_id": reg["content_id"],
            "name": reg["ad_name"],
            "cats_client_id": config["cats_client_id"],
            "cats_group_id": config["cats_content_group_id"],
            "cats_partner_id": config["cats_partner_id"],
            "transition_type": config["click_type"],
            "project_id": config["project_id"],
            "status": "使用中",
        }

        # クリックURLはfetch_click_urlsの結果から名前マッチ
        for cu in click_urls:
            if reg["ad_name"] in cu.get("text", "") or cu.get("ad_name") == reg["ad_name"]:
                if cu.get("redirect_url"):
                    content_data["redirect_url"] = cu["redirect_url"]
                if cu.get("direct_param"):
                    content_data["direct_param"] = cu["direct_param"]
                break

        # 中間クリックURLはfetch_middle_click_urlsから
        for mu in middle_urls:
            if reg["ad_name"] in mu.get("text", ""):
                content_data["middle_redirect_url"] = mu.get("middle_redirect_url")
                content_data["middle_direct_param"] = mu.get("middle_direct_param")
                break

        # article_lp_id, client_code_id を設定
        if config.get("default_article_lp_id"):
            content_data["article_lp_id"] = config["default_article_lp_id"]
        # client_code_idはclient_codesのcode_name→id解決
        for row in (supabase.table("client_codes")
                    .select("id,code_name")
                    .eq("code_name", reg["ad_name"])
                    .limit(1).execute()).data:
            content_data["client_code_id"] = row["id"]

        save_cats_content(content_data)
        print(f"  Saved: {reg['ad_name']} (cats_content_id={reg['content_id']})")
        if content_data.get("redirect_url"):
            print(f"    Click URL: {content_data['redirect_url']}")
        if content_data.get("middle_redirect_url"):
            print(f"    Middle URL: {content_data['middle_redirect_url']}")

    print(f"\n=== Done: {len(registered)} contents registered ===")


def cmd_fetch_urls(args):
    """既存広告のクリックURL取得コマンド。"""
    config = get_cats_config(args.project, args.platform)

    print(f"\n=== Fetching URLs: {args.project} x {args.platform} ===")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        page = browser.new_page()
        cats_login(page)

        click_urls = fetch_click_urls(page, config)
        middle_urls = fetch_middle_click_urls(page, config)

        browser.close()

    for cu in click_urls:
        print(f"  Click: {cu.get('redirect_url', 'N/A')}")
    for mu in middle_urls:
        print(f"  Middle: {mu.get('middle_redirect_url', 'N/A')}")


def main():
    parser = argparse.ArgumentParser(description="CATS広告自動登録")
    sub = parser.add_subparsers(dest="command")

    reg = sub.add_parser("register", help="広告登録+クリックURL取得")
    reg.add_argument("--project", required=True, help="案件名")
    reg.add_argument("--platform", default="Meta")
    reg.add_argument("--names", required=True, help="広告名カンマ区切り (例: fk_12,fk_13)")
    reg.add_argument("--article-lp", help="記事LP URL (上書き)")
    reg.add_argument("--final-lp", help="クライアント発行コード (上書き)")
    reg.add_argument("--headed", action="store_true", help="ブラウザ表示")

    fetch = sub.add_parser("fetch-urls", help="既存広告のURL取得")
    fetch.add_argument("--project", required=True)
    fetch.add_argument("--platform", default="Meta")
    fetch.add_argument("--headed", action="store_true")

    args = parser.parse_args()
    if args.command == "register":
        cmd_register(args)
    elif args.command == "fetch-urls":
        cmd_fetch_urls(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
