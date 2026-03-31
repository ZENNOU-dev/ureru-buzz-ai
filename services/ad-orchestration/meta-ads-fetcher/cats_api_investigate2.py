"""CATS API連携ページとREST APIエンドポイントを調査"""
import asyncio
import json
import os
from dotenv import load_dotenv
from playwright.async_api import async_playwright

load_dotenv()

CATS_LOGIN_URL = os.getenv("CATS_LOGIN_URL")
CATS_USERNAME = os.getenv("CATS_USERNAME")
CATS_PASSWORD = os.getenv("CATS_PASSWORD")

async def investigate():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

        # 全ネットワークリクエストを記録
        all_requests = []

        def on_request(request):
            all_requests.append({
                "type": "req",
                "method": request.method,
                "url": request.url,
                "post_data": request.post_data[:500] if request.post_data else None,
            })

        def on_response(response):
            all_requests.append({
                "type": "res",
                "url": response.url,
                "status": response.status,
            })

        page = await context.new_page()
        page.on("request", on_request)
        page.on("response", on_response)

        # ログイン
        print("[1] Logging in...")
        await page.goto(CATS_LOGIN_URL, wait_until="networkidle")
        await page.fill('input[name="loginId"]', CATS_USERNAME)
        await page.fill('input[name="password"]', CATS_PASSWORD)
        await page.click('button[type="submit"]')
        await page.wait_for_load_state("networkidle")
        print(f"    Logged in: {page.url}")

        # API連携一覧を確認
        print("\n[2] Checking API連携一覧...")
        await page.goto("https://bonnou.admin01.l-ad.net/admin/setting/conversions/list/index", wait_until="networkidle")
        await page.screenshot(path="/tmp/cats_03_api_list.png")
        body_text = await page.inner_text("body")
        print(f"    Title: {await page.title()}")
        print(f"    Body (first 2000 chars):\n{body_text[:2000]}")

        # API連携登録ページを確認
        print("\n[3] Checking API連携登録...")
        await page.goto("https://bonnou.admin01.l-ad.net/admin/setting/conversions/register/index", wait_until="networkidle")
        await page.screenshot(path="/tmp/cats_04_api_register.png")
        body_text = await page.inner_text("body")
        print(f"    Title: {await page.title()}")
        print(f"    Body (first 2000 chars):\n{body_text[:2000]}")

        # 連携ツールページを確認
        print("\n[4] Checking 連携ツール...")
        await page.goto("https://tool.catsys.jp/approval", wait_until="networkidle")
        await page.screenshot(path="/tmp/cats_05_tool.png")
        print(f"    Title: {await page.title()}")
        print(f"    URL: {page.url}")

        # 広告一覧を確認（広告登録のREST APIを探す）
        print("\n[5] Checking 広告一覧...")
        all_requests.clear()
        await page.goto("https://bonnou.admin01.l-ad.net/admin/content/list", wait_until="networkidle")
        await page.screenshot(path="/tmp/cats_06_content_list.png")
        body_text = await page.inner_text("body")
        print(f"    Title: {await page.title()}")
        print(f"    Body (first 2000 chars):\n{body_text[:2000]}")

        # フィルタしてAPIリクエストを確認
        api_reqs = [r for r in all_requests if '/api/' in r['url'] or '/rest/' in r['url'] or '.json' in r['url']]
        print(f"    API requests found: {len(api_reqs)}")
        for r in api_reqs:
            print(f"    {json.dumps(r, ensure_ascii=False)}")

        # クリックURL一覧（これがCATS URLの管理画面）
        print("\n[6] Checking クリックURL一覧...")
        all_requests.clear()
        await page.goto("https://bonnou.admin01.l-ad.net/admin/clicktag/list", wait_until="networkidle")
        await page.screenshot(path="/tmp/cats_07_clicktag_list.png")
        body_text = await page.inner_text("body")
        print(f"    Title: {await page.title()}")
        print(f"    Body (first 3000 chars):\n{body_text[:3000]}")

        # 広告登録ページのフォーム構造を確認
        print("\n[7] Checking 広告登録フォーム...")
        all_requests.clear()
        await page.goto("https://bonnou.admin01.l-ad.net/admin/content/register", wait_until="networkidle")
        await page.screenshot(path="/tmp/cats_08_content_register.png")

        # フォーム要素を全取得
        inputs = await page.query_selector_all("input, select, textarea")
        for inp in inputs:
            tag = await inp.evaluate("el => el.tagName")
            inp_type = await inp.get_attribute("type") or ""
            inp_name = await inp.get_attribute("name") or ""
            inp_id = await inp.get_attribute("id") or ""
            print(f"    {tag}: type={inp_type}, name={inp_name}, id={inp_id}")

        # ページソースからAPIエンドポイントを抽出
        print("\n[8] Searching page source for API endpoints...")
        all_pages = [
            "https://bonnou.admin01.l-ad.net/admin/",
            "https://bonnou.admin01.l-ad.net/admin/content/list",
        ]
        for page_url in all_pages:
            await page.goto(page_url, wait_until="networkidle")
            source = await page.content()
            # fetch/axios/XMLHttpRequest/apiなどのパターンを探す
            import re
            api_patterns = re.findall(r'(?:fetch|axios|XMLHttpRequest|api|endpoint|baseUrl|apiUrl|restUrl)[^"\']*["\']([^"\']+)["\']', source, re.IGNORECASE)
            url_patterns = re.findall(r'["\'](/(?:api|rest|v[12])/[^"\']+)["\']', source)
            if api_patterns:
                print(f"    [{page_url}] API patterns: {api_patterns[:10]}")
            if url_patterns:
                print(f"    [{page_url}] URL patterns: {url_patterns[:10]}")

        # 全JSファイルのURLを取得
        print("\n[9] Checking loaded JS files...")
        await page.goto("https://bonnou.admin01.l-ad.net/admin/", wait_until="networkidle")
        scripts = await page.query_selector_all("script[src]")
        for s in scripts:
            src = await s.get_attribute("src")
            print(f"    JS: {src}")

        # 全ネットワークリクエストのうちXHR/fetchを確認
        print(f"\n[10] All captured requests ({len(all_requests)}):")
        for r in all_requests[:50]:
            if r.get("type") == "req" and r["method"] != "GET":
                print(f"    {r['method']} {r['url']}")
            elif "api" in r.get("url", "").lower() or "rest" in r.get("url", "").lower():
                print(f"    {r.get('type','?')} {r.get('method','')} {r['url']}")

        await browser.close()

asyncio.run(investigate())
