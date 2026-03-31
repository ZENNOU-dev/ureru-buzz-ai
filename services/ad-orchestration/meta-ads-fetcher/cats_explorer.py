"""CATS管理画面の構造調査スクリプト (Playwright)"""
import os
import json
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv()

CATS_URL = os.getenv("CATS_LOGIN_URL", "https://bonnou.admin01.l-ad.net/admin/")
CATS_USER = os.getenv("CATS_USERNAME")
CATS_PASS = os.getenv("CATS_PASSWORD")


def explore_cats():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. ログイン
        print("=== ログイン ===")
        page.goto(CATS_URL)
        page.wait_for_load_state("networkidle")
        print(f"URL: {page.url}")
        print(f"Title: {page.title()}")

        # ログインフォーム入力
        login_form = page.query_selector("form")
        if login_form:
            inputs = page.query_selector_all("input")
            for inp in inputs:
                inp_type = inp.get_attribute("type") or ""
                inp_name = inp.get_attribute("name") or ""
                print(f"  input: name={inp_name}, type={inp_type}")

        # ID/PASS入力
        page.fill('input[name="loginId"], input[type="text"]', CATS_USER)
        page.fill('input[name="password"], input[type="password"]', CATS_PASS)
        page.click('button[type="submit"], input[type="submit"]')
        page.wait_for_load_state("networkidle")
        print(f"ログイン後URL: {page.url}")

        # 2. ナビゲーション構造を取得
        print("\n=== ナビゲーション ===")
        nav_links = page.query_selector_all("nav a, .sidebar a, .menu a, a[href*='/admin/']")
        seen = set()
        for link in nav_links:
            href = link.get_attribute("href") or ""
            text = link.inner_text().strip()
            if href and href not in seen and text:
                seen.add(href)
                print(f"  [{text}] → {href}")

        # 3. 広告（コンテンツ）一覧ページを探す
        print("\n=== コンテンツ（広告）一覧を探索 ===")
        content_urls = [l for l in seen if "content" in l.lower() or "ad" in l.lower()]
        print(f"  候補URL: {content_urls}")

        # 全リンクからコンテンツ関連を探す
        all_links = page.query_selector_all("a")
        for link in all_links:
            href = link.get_attribute("href") or ""
            text = link.inner_text().strip()
            if any(kw in href.lower() for kw in ["content", "click", "redirect", "partner", "client", "group"]):
                if href not in seen:
                    seen.add(href)
                    print(f"  [{text}] → {href}")

        # 4. コンテンツ一覧にアクセス
        print("\n=== コンテンツ一覧ページ ===")
        for candidate in ["/admin/content/", "/admin/contents/", "/admin/ad/"]:
            full_url = f"https://bonnou.admin01.l-ad.net{candidate}"
            page.goto(full_url)
            page.wait_for_load_state("networkidle")
            if page.url != CATS_URL and "login" not in page.url.lower():
                print(f"  ✅ {full_url} → {page.url}")
                # テーブル構造を確認
                tables = page.query_selector_all("table")
                print(f"  テーブル数: {len(tables)}")
                if tables:
                    headers = tables[0].query_selector_all("th")
                    print(f"  ヘッダー: {[h.inner_text().strip() for h in headers]}")
                    # 最初の数行のデータ
                    rows = tables[0].query_selector_all("tbody tr")
                    print(f"  行数: {len(rows)}")
                    for row in rows[:3]:
                        cells = row.query_selector_all("td")
                        print(f"    → {[c.inner_text().strip()[:50] for c in cells]}")
                break
            else:
                print(f"  ❌ {full_url} → リダイレクト/404")

        # 5. APIエンドポイント調査 - ネットワークリクエストをキャプチャ
        print("\n=== API調査: ネットワークリクエスト ===")
        api_requests = []

        def capture_request(request):
            url = request.url
            if "api" in url.lower() or "json" in url.lower() or "ajax" in url.lower():
                api_requests.append({
                    "method": request.method,
                    "url": url,
                    "headers": dict(request.headers),
                })

        page.on("request", capture_request)

        # ダッシュボードに戻ってAPI呼び出しを観察
        page.goto(CATS_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)

        for req in api_requests:
            print(f"  {req['method']} {req['url']}")

        # 6. REST API エンドポイントを直接試す
        print("\n=== REST API直接アクセス ===")
        api_base_candidates = [
            "https://bonnou.admin01.l-ad.net/api/",
            "https://bonnou.admin01.l-ad.net/admin/api/",
            "https://bonnou.admin01.l-ad.net/rest/",
        ]
        for api_base in api_base_candidates:
            resp = page.goto(api_base)
            print(f"  {api_base} → status={resp.status if resp else 'None'}, url={page.url}")

        # 7. ページのHTML全体を保存（後で分析用）
        print("\n=== HTMLダンプ ===")
        page.goto(CATS_URL)
        page.wait_for_load_state("networkidle")
        html = page.content()
        dump_path = "/Users/yumhahada/ad-orchestration/meta-ads-fetcher/cats_dashboard.html"
        with open(dump_path, "w") as f:
            f.write(html)
        print(f"  ダッシュボードHTML保存: {dump_path} ({len(html)} bytes)")

        browser.close()


if __name__ == "__main__":
    explore_cats()
