"""CATS管理画面にログインしてREST APIエンドポイントを調査するスクリプト"""
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

        # ネットワークリクエストを記録
        api_requests = []

        def on_request(request):
            url = request.url
            # API系のリクエストを記録
            if any(kw in url for kw in ['/api/', '/rest/', '/v1/', '/v2/', '.json', 'ajax']):
                api_requests.append({
                    "method": request.method,
                    "url": url,
                    "headers": dict(request.headers),
                    "post_data": request.post_data,
                })

        def on_response(response):
            url = response.url
            if any(kw in url for kw in ['/api/', '/rest/', '/v1/', '/v2/', '.json', 'ajax']):
                api_requests.append({
                    "type": "response",
                    "url": url,
                    "status": response.status,
                    "headers": dict(response.headers),
                })

        page = await context.new_page()
        page.on("request", on_request)
        page.on("response", on_response)

        # Step 1: ログインページにアクセス
        print(f"[1] Navigating to {CATS_LOGIN_URL}")
        await page.goto(CATS_LOGIN_URL, wait_until="networkidle")
        print(f"    Current URL: {page.url}")
        print(f"    Title: {await page.title()}")

        # スクリーンショット
        await page.screenshot(path="/tmp/cats_01_login.png")
        print("    Screenshot: /tmp/cats_01_login.png")

        # ページ内容を確認
        content = await page.content()
        print(f"    Page length: {len(content)} chars")

        # フォーム要素を探す
        inputs = await page.query_selector_all("input")
        for inp in inputs:
            inp_type = await inp.get_attribute("type") or "text"
            inp_name = await inp.get_attribute("name") or ""
            inp_id = await inp.get_attribute("id") or ""
            print(f"    Input: type={inp_type}, name={inp_name}, id={inp_id}")

        # Step 2: ログイン
        print(f"\n[2] Attempting login...")

        # ユーザー名/パスワードフィールドを探す
        username_selectors = ['input[name="username"]', 'input[name="login"]', 'input[name="email"]',
                              'input[name="user"]', 'input[name="id"]', 'input[type="text"]',
                              'input[name="login_id"]', '#username', '#login']
        password_selectors = ['input[name="password"]', 'input[name="pass"]', 'input[type="password"]',
                              '#password', '#pass']

        username_input = None
        for sel in username_selectors:
            username_input = await page.query_selector(sel)
            if username_input:
                print(f"    Found username field: {sel}")
                break

        password_input = None
        for sel in password_selectors:
            password_input = await page.query_selector(sel)
            if password_input:
                print(f"    Found password field: {sel}")
                break

        if username_input and password_input:
            await username_input.fill(CATS_USERNAME)
            await password_input.fill(CATS_PASSWORD)

            # ログインボタンを探す
            submit_selectors = ['button[type="submit"]', 'input[type="submit"]',
                                'button:has-text("ログイン")', 'button:has-text("Login")',
                                'a:has-text("ログイン")', '.login-btn', '#login-btn']

            for sel in submit_selectors:
                submit_btn = await page.query_selector(sel)
                if submit_btn:
                    print(f"    Found submit button: {sel}")
                    await submit_btn.click()
                    break

            await page.wait_for_load_state("networkidle")
            print(f"    After login URL: {page.url}")
            print(f"    After login Title: {await page.title()}")
            await page.screenshot(path="/tmp/cats_02_after_login.png")
            print("    Screenshot: /tmp/cats_02_after_login.png")
        else:
            print("    Could not find login form fields!")
            # HTMLの一部を出力して確認
            body_text = await page.inner_text("body")
            print(f"    Body text (first 500 chars): {body_text[:500]}")

        # Step 3: ダッシュボード/メインページを探索
        print(f"\n[3] Exploring main page...")

        # ナビゲーションリンクを取得
        links = await page.query_selector_all("a[href]")
        seen_urls = set()
        for link in links:
            href = await link.get_attribute("href") or ""
            text = (await link.inner_text()).strip()
            if href and href not in seen_urls and not href.startswith("#") and not href.startswith("javascript"):
                seen_urls.add(href)
                if text:
                    print(f"    Link: {text} → {href}")

        # Step 4: API関連のページを探す
        print(f"\n[4] Looking for API-related pages...")
        api_keywords = ["api", "rest", "token", "key", "設定", "setting", "連携", "integration"]
        for link in links:
            href = await link.get_attribute("href") or ""
            text = (await link.inner_text()).strip().lower()
            if any(kw in text or kw in href.lower() for kw in api_keywords):
                print(f"    API-related: {text} → {href}")

        # Step 5: 記録されたAPIリクエストを出力
        print(f"\n[5] Captured API requests: {len(api_requests)}")
        for req in api_requests:
            print(f"    {json.dumps(req, ensure_ascii=False, indent=2)}")

        # Step 6: ページのJavaScript変数を確認
        print(f"\n[6] Checking JS variables...")
        js_vars = await page.evaluate("""() => {
            const vars = {};
            // グローバル変数をチェック
            for (const key of Object.keys(window)) {
                if (key.toLowerCase().includes('api') ||
                    key.toLowerCase().includes('token') ||
                    key.toLowerCase().includes('config') ||
                    key.toLowerCase().includes('cats')) {
                    try {
                        vars[key] = typeof window[key] === 'object' ?
                            JSON.stringify(window[key]).substring(0, 200) :
                            String(window[key]).substring(0, 200);
                    } catch(e) {}
                }
            }
            return vars;
        }""")
        for k, v in js_vars.items():
            print(f"    {k}: {v}")

        await browser.close()

asyncio.run(investigate())
