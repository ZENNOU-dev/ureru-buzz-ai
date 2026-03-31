"""Fetch Squad Beyond folder structure and page parameter settings.

Logs in as ブリーチ team (ID: 499) to access ローコスト article LPs.
"""

import os
import time
import json
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()

SB_URL = os.getenv("SQUAD_BEYOND_URL", "https://app.squadbeyond.com/")
SB_EMAIL = os.getenv("SQUAD_BEYOND_EMAIL")
SB_PASS = os.getenv("SQUAD_BEYOND_PASSWORD")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Login
        page.goto(SB_URL + "sign_in")
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        email_input = page.query_selector("input[type='email']")
        pass_input = page.query_selector("input[type='password']")
        if email_input and pass_input:
            email_input.fill(SB_EMAIL)
            pass_input.fill(SB_PASS)
            time.sleep(0.5)
            submit = page.query_selector("button[type='submit'], button:has-text('ログイン')")
            if submit:
                submit.click()
            page.wait_for_load_state("networkidle")
            time.sleep(3)

        print(f"After login: {page.url}")

        # Team selection (ブリーチ)
        bleach = page.query_selector("text=ブリーチ")
        if bleach:
            print("Selecting ブリーチ team...")
            bleach.click()
            time.sleep(1)
            login_btn = page.query_selector("button:has-text('ログイン')")
            if login_btn:
                login_btn.click()
            page.wait_for_load_state("networkidle")
            time.sleep(3)

        print(f"After team select: {page.url}")

        # Navigate to beyondページ
        page.goto("https://app.squadbeyond.com/ab_tests")
        page.wait_for_load_state("networkidle")
        time.sleep(3)
        print(f"At ab_tests: {page.url}")

        # Call API via page.evaluate (no special chars)
        js_code = """
        () => {
            return fetch('/api/v1/folder_groups?include_folders=true')
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    return data.map(function(g) {
                        return {
                            id: g.id,
                            name: g.name,
                            folders: (g.folders || []).map(function(f) {
                                return {
                                    id: f.id,
                                    name: f.name,
                                    uid: f.uid,
                                    domain: f.domain ? f.domain.domain : null
                                };
                            })
                        };
                    });
                })
                .catch(function(e) { return {error: e.message}; });
        }
        """

        result = page.evaluate(js_code)

        if isinstance(result, dict) and "error" in result:
            print(f"API error: {result['error']}")
            browser.close()
            return

        print(f"\n=== {len(result)} groups ===")
        for g in result:
            print(f"\nGroup: {g['name']} (id={g['id']})")
            for f in g.get("folders", []):
                print(f"  {f['name'][:55]:55s}  domain={f.get('domain','')}")

        # Find ローコスト folder
        target_folders = []
        for g in result:
            for f in g.get("folders", []):
                fname = f.get("name", "")
                if "ローコスト" in fname or "lowc" in fname.lower():
                    target_folders.append(f)
                    print(f"\n*** Found target: {fname} uid={f['uid']}")

        # Fetch pages for each target folder
        all_page_data = {}
        for folder in target_folders:
            uid = folder["uid"]
            fname = folder["name"]
            js_pages = f"""
            () => {{
                return fetch('/api/v1/folders/{uid}/ab_tests')
                    .then(function(r) {{ return r.json(); }})
                    .catch(function(e) {{ return {{error: e.message}}; }});
            }}
            """
            pages_resp = page.evaluate(js_pages)

            if isinstance(pages_resp, list):
                print(f"\n=== {fname}: {len(pages_resp)} pages ===")
                for pg in pages_resp:
                    print(f"  id={pg.get('id')}  uid={pg.get('uid','')[:30]}  "
                          f"title={pg.get('title','')}  "
                          f"ad_status={pg.get('ad_status')}  "
                          f"published={pg.get('published')}")
                all_page_data[fname] = pages_resp
            else:
                print(f"  Error: {pages_resp}")

        # For delivered pages, fetch parameter settings
        for fname, pages in all_page_data.items():
            for pg in pages:
                uid = pg.get("uid", "")
                if not uid:
                    continue
                # Try to get split test / parameter settings
                js_detail = f"""
                () => {{
                    return fetch('/api/v1/ab_tests/{uid}')
                        .then(function(r) {{ return r.json(); }})
                        .catch(function(e) {{ return {{error: e.message}}; }});
                }}
                """
                detail = page.evaluate(js_detail)
                if isinstance(detail, dict) and "error" not in detail:
                    versions = detail.get("versions", [])
                    params = detail.get("split_test_settings", {})
                    print(f"\n--- {pg['title']} (uid={uid}) ---")
                    print(f"  published: {detail.get('published')}")
                    print(f"  ad_status: {detail.get('ad_status')}")
                    print(f"  versions: {len(versions)}")
                    for v in versions:
                        print(f"    version: {v.get('name','')}  weight={v.get('weight','')}  params={v.get('params',{})}")
                    if params:
                        print(f"  split_test_settings: {json.dumps(params, ensure_ascii=False)[:300]}")
                    # Save full detail
                    with open(f"/tmp/beyond_page_{uid[:20]}.json", "w") as fp:
                        json.dump(detail, fp, ensure_ascii=False, indent=2)

        # Save all results
        with open("/tmp/beyond_bleach_data.json", "w") as fp:
            json.dump({"groups": result, "pages": all_page_data}, fp, ensure_ascii=False, indent=2)

        browser.close()
        print("\n=== Done ===")


if __name__ == "__main__":
    main()
