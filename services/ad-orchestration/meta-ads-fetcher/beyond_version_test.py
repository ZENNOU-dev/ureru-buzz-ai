"""Test Beyond Version duplication via page.evaluate + fetch API.

Based on beyond-duplication-guide.md reference.
"""

import os
import time
import json
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()
SB_EMAIL = os.getenv("SQUAD_BEYOND_EMAIL")
SB_PASS = os.getenv("SQUAD_BEYOND_PASSWORD")
BROWSER_DIR = os.path.expanduser("~/.squad-beyond-browser")


def api_fetch(page, method, endpoint, body=None):
    """Call Beyond API via page.evaluate + fetch (session cookie auto-sent)."""
    base = "https://api.squadbeyond.com/api/v1"
    url = f"{base}{endpoint}"

    if body:
        js = f"""
        async () => {{
            const resp = await fetch("{url}", {{
                method: "{method}",
                headers: {{"Content-Type": "application/json"}},
                credentials: "include",
                body: JSON.stringify({json.dumps(body, ensure_ascii=False)})
            }});
            const data = await resp.json();
            return {{status: resp.status, data: data}};
        }}
        """
    else:
        js = f"""
        async () => {{
            const resp = await fetch("{url}", {{
                method: "{method}",
                credentials: "include"
            }});
            const data = await resp.json();
            return {{status: resp.status, data: data}};
        }}
        """
    result = page.evaluate(js)
    return result


def login_bleach(page):
    """Login and select ブリーチ team."""
    page.goto("https://app.squadbeyond.com/sign_in")
    page.wait_for_load_state("networkidle")
    time.sleep(3)

    # Always go to sign_in page
    page.goto("https://app.squadbeyond.com/sign_in")
    page.wait_for_load_state("networkidle")
    time.sleep(3)

    # Check if login form exists
    has_password = page.locator('input[type="password"], input[name="password"]').count() > 0
    if not has_password:
        print("No login form - checking if already on team page")
        # Might be on team selection page already
        if page.locator('text=ブリーチ').count() > 0:
            pass  # Continue to team selection below
        else:
            print("Unknown state")
            return

    if has_password:
        page.fill('input[name="email"]', SB_EMAIL)
        page.fill('input[name="password"]', SB_PASS)
        time.sleep(1)
        page.click('button[type="submit"]')
        page.wait_for_load_state("networkidle")
        time.sleep(8)

    # Select ブリーチ team
    structure = page.evaluate("""() => {
        const btns = document.querySelectorAll('button');
        const results = [];
        let idx = 0;
        btns.forEach(btn => {
            if (btn.innerText.trim() === 'ログイン') {
                let el = btn;
                let parentTexts = [];
                for (let i = 0; i < 2; i++) {
                    el = el.parentElement;
                    if (!el) break;
                    parentTexts.push(el.innerText.replace(/\\n/g, ' | ').substring(0, 100));
                }
                results.push({idx: idx, parentTexts: parentTexts});
                idx++;
            }
        });
        return results;
    }""")

    bleach_idx = None
    for item in structure:
        for txt in item["parentTexts"]:
            if "ブリーチ" in txt and "BONNOU" not in txt:
                bleach_idx = item["idx"]
                break
        if bleach_idx is not None:
            break

    if bleach_idx is not None:
        page.evaluate(f"""() => {{
            const btns = document.querySelectorAll('button');
            let idx = 0;
            btns.forEach(btn => {{
                if (btn.innerText.trim() === 'ログイン') {{
                    if (idx === {bleach_idx}) btn.click();
                    idx++;
                }}
            }});
        }}""")
        page.wait_for_load_state("networkidle")
        time.sleep(8)
        print("login: ブリーチ OK")
    else:
        print("login: ブリーチ NOT FOUND")


def main():
    uid = "lowc-m3-02aq-bonfk00"

    with sync_playwright() as p:
        # Persistent context (session preserved across runs)
        context = p.chromium.launch_persistent_context(
            user_data_dir=BROWSER_DIR,
            channel="chrome",
            headless=False,
            viewport={"width": 1400, "height": 900},
            locale="ja-JP",
            args=["--disable-blink-features=AutomationControlled"],
            ignore_default_args=["--enable-automation"],
        )
        page = context.pages[0] if context.pages else context.new_page()

        # Login check
        page.goto("https://app.squadbeyond.com/ab_tests")
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        # Check session via API
        session_check = page.evaluate("""
        async () => {
            try {
                const resp = await fetch("https://api.squadbeyond.com/api/v1/users/teams", {credentials: "include"});
                if (resp.ok) return await resp.json();
                return {error: resp.status};
            } catch(e) { return {error: e.message}; }
        }
        """)

        if "error" in str(session_check):
            print("Session expired, logging in...")
            login_bleach(page)
        else:
            print(f"Session valid: {json.dumps(session_check, ensure_ascii=False)[:100]}")

        # Navigate to the page
        page.goto(f"https://app.squadbeyond.com/ab_tests/{uid}/articles")
        time.sleep(5)

        # === Step 1: Get Version list ===
        print("\n=== Step 1: Version一覧取得 ===")
        versions = api_fetch(page, "GET", f"/ab_tests/{uid}/articles")
        if versions["status"] == 200:
            articles = versions["data"]
            if isinstance(articles, list):
                for art in articles:
                    print(f"  id={art.get('id')} uid={art.get('uid','')[:20]} memo={art.get('memo','')}")
            elif isinstance(articles, dict):
                arts = articles.get("articles", articles.get("data", []))
                if isinstance(arts, list):
                    for art in arts:
                        print(f"  id={art.get('id')} uid={art.get('uid','')[:20]} memo={art.get('memo','')}")
                else:
                    print(f"  Response: {json.dumps(articles, ensure_ascii=False)[:200]}")
        else:
            print(f"  Error: {versions}")

        # === Step 2: Duplicate a version ===
        print("\n=== Step 2: Version複製 ===")
        # Get the source article ID (02aq)
        source_id = None
        if versions["status"] == 200:
            data = versions["data"]
            arts = data if isinstance(data, list) else data.get("articles", data.get("data", []))
            if isinstance(arts, list):
                for art in arts:
                    if art.get("memo") == "02aq":
                        source_id = art.get("id")
                        print(f"  Source: id={source_id} memo=02aq")
                        break

        if source_id:
            dup_result = api_fetch(page, "POST", f"/articles/{source_id}/duplications")
            print(f"  Duplication: status={dup_result['status']}")
            print(f"  Response: {json.dumps(dup_result['data'], ensure_ascii=False)[:300]}")

            if dup_result["status"] in (200, 201):
                new_article = dup_result["data"]
                new_id = new_article.get("id")
                new_uid = new_article.get("uid", "")
                print(f"  New article: id={new_id} uid={new_uid}")

                # === Step 3: Rename ===
                print("\n=== Step 3: Version名変更 ===")
                rename_result = api_fetch(page, "PATCH", f"/articles/{new_id}", {"memo": "test_sbv_auto"})
                print(f"  Rename: status={rename_result['status']}")

                # === Step 4: Set parameter ===
                print("\n=== Step 4: パラメータ設定 ===")
                param_result = api_fetch(page, "POST",
                    f"/ab_tests/{uid}/articles/{new_uid}/parameter_allowlists",
                    {"parameter": "sbv=test_auto_123"})
                print(f"  Parameter: status={param_result['status']}")
                print(f"  Response: {json.dumps(param_result['data'], ensure_ascii=False)[:200]}")

                # === Step 5: Set weight ===
                print("\n=== Step 5: 配信割合 ===")
                # Try via UI - go back to articles page
                page.goto(f"https://app.squadbeyond.com/ab_tests/{uid}/articles")
                time.sleep(5)

                # Find the new version in the UI and set weight
                # Use data-test selector
                new_memo = page.locator(f'span[data-test="ArticleList-Memo"]:text-is("test_sbv_auto")')
                if new_memo.count() > 0:
                    new_memo.first.click()
                    time.sleep(1)
                    # Now find weight input in current article container
                    weight = page.locator('[data-test="ArticleList-CurrentArticle"] input[type="number"]')
                    if weight.count() > 0:
                        weight.first.click(click_count=3)
                        weight.first.fill("1")
                        weight.first.press("Tab")
                        time.sleep(1)
                        print("  Weight set to 1")
                else:
                    print("  New version not found in UI for weight setting")

                # === Step 6: Update (save) ===
                print("\n=== Step 6: 更新 ===")
                update_btn = page.locator('button:has-text("更新")')
                if update_btn.count() > 0 and update_btn.first.is_visible():
                    update_btn.first.click()
                    time.sleep(5)
                    print("  Updated!")

                page.screenshot(path="/tmp/beyond_test_done.png")
        else:
            print("  Source version '02aq' not found")

        print("\n=== Done ===")
        context.close()


if __name__ == "__main__":
    main()
