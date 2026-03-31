"""CATS クリックURL/中間クリックURL/API詳細調査"""
import os
import json
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv()

CATS_BASE = "https://bonnou.admin01.l-ad.net"
CATS_USER = os.getenv("CATS_USERNAME")
CATS_PASS = os.getenv("CATS_PASSWORD")


def explore():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # ログイン
        page.goto(f"{CATS_BASE}/admin/")
        page.fill('input[name="loginId"]', CATS_USER)
        page.fill('input[name="password"]', CATS_PASS)
        page.click('button[type="submit"], input[type="submit"]')
        page.wait_for_load_state("networkidle")
        print(f"ログイン完了: {page.url}\n")

        # ===== 1. クリックURL一覧 =====
        print("=" * 60)
        print("1. クリックURL一覧 (/admin/clicktag/list)")
        print("=" * 60)
        page.goto(f"{CATS_BASE}/admin/clicktag/list")
        page.wait_for_load_state("networkidle")

        # テーブル構造
        tables = page.query_selector_all("table")
        print(f"テーブル数: {len(tables)}")
        for i, table in enumerate(tables):
            headers = table.query_selector_all("th")
            if headers:
                print(f"\nテーブル{i} ヘッダー:")
                for h in headers:
                    print(f"  - {h.inner_text().strip()}")
            rows = table.query_selector_all("tbody tr")
            print(f"行数: {len(rows)}")
            for row in rows[:5]:
                cells = row.query_selector_all("td")
                cell_texts = []
                for c in cells:
                    text = c.inner_text().strip()[:80]
                    cell_texts.append(text)
                print(f"  → {cell_texts}")

        # フォーム/フィルター
        forms = page.query_selector_all("form")
        print(f"\nフォーム数: {len(forms)}")
        for form in forms:
            action = form.get_attribute("action") or ""
            method = form.get_attribute("method") or ""
            print(f"  action={action}, method={method}")
            selects = form.query_selector_all("select")
            for sel in selects:
                name = sel.get_attribute("name") or ""
                options = sel.query_selector_all("option")
                opt_texts = [f"{o.get_attribute('value')}:{o.inner_text().strip()[:30]}" for o in options[:10]]
                print(f"    select[{name}]: {opt_texts}")

        # HTML保存
        with open("/Users/yumhahada/ad-orchestration/meta-ads-fetcher/cats_clicktag_list.html", "w") as f:
            f.write(page.content())

        # ===== 2. 中間クリックURL一覧 =====
        print("\n" + "=" * 60)
        print("2. 中間クリックURL一覧 (/admin/middleclicktag/list)")
        print("=" * 60)
        page.goto(f"{CATS_BASE}/admin/middleclicktag/list")
        page.wait_for_load_state("networkidle")

        tables = page.query_selector_all("table")
        print(f"テーブル数: {len(tables)}")
        for i, table in enumerate(tables):
            headers = table.query_selector_all("th")
            if headers:
                print(f"\nテーブル{i} ヘッダー:")
                for h in headers:
                    print(f"  - {h.inner_text().strip()}")
            rows = table.query_selector_all("tbody tr")
            print(f"行数: {len(rows)}")
            for row in rows[:5]:
                cells = row.query_selector_all("td")
                cell_texts = []
                for c in cells:
                    text = c.inner_text().strip()[:80]
                    cell_texts.append(text)
                print(f"  → {cell_texts}")

        with open("/Users/yumhahada/ad-orchestration/meta-ads-fetcher/cats_middleclicktag_list.html", "w") as f:
            f.write(page.content())

        # ===== 3. REST API調査 =====
        print("\n" + "=" * 60)
        print("3. REST API調査")
        print("=" * 60)

        # /api/ のレスポンス内容を確認
        api_endpoints = [
            "/api/",
            "/api/v1/",
            "/api/v2/",
            "/api/content/",
            "/api/contents/",
            "/api/client/",
            "/api/partner/",
            "/api/clicktag/",
            "/admin/api/",
            "/admin/api/content/",
            "/admin/api/clicktag/",
        ]

        for ep in api_endpoints:
            resp = page.goto(f"{CATS_BASE}{ep}")
            status = resp.status if resp else "None"
            content_type = resp.headers.get("content-type", "") if resp else ""
            body = ""
            if resp and status == 200:
                body = page.content()[:500]
            print(f"  {ep} → {status} [{content_type[:30]}]")
            if body and ("json" in content_type or body.strip().startswith("{")):
                print(f"    Body: {body[:200]}")

        # ===== 4. 広告一覧ページ（コンテンツ）=====
        print("\n" + "=" * 60)
        print("4. 広告一覧 (/admin/content/list)")
        print("=" * 60)

        # ネットワークキャプチャ
        api_reqs = []
        def capture(req):
            if any(kw in req.url for kw in ["/api/", "/ajax/", ".json"]):
                api_reqs.append({"method": req.method, "url": req.url})
        page.on("request", capture)

        page.goto(f"{CATS_BASE}/admin/content/list")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        tables = page.query_selector_all("table")
        print(f"テーブル数: {len(tables)}")
        for i, table in enumerate(tables):
            headers = table.query_selector_all("th")
            if headers:
                print(f"\nテーブル{i} ヘッダー:")
                for h in headers:
                    print(f"  - {h.inner_text().strip()}")
            rows = table.query_selector_all("tbody tr")
            print(f"行数: {len(rows)}")
            for row in rows[:3]:
                cells = row.query_selector_all("td")
                cell_texts = [c.inner_text().strip()[:60] for c in cells]
                print(f"  → {cell_texts}")

        if api_reqs:
            print(f"\nAPI呼び出し検出: {len(api_reqs)}")
            for req in api_reqs:
                print(f"  {req['method']} {req['url']}")

        with open("/Users/yumhahada/ad-orchestration/meta-ads-fetcher/cats_content_list.html", "w") as f:
            f.write(page.content())

        # ===== 5. 広告詳細ページ (最初の広告) =====
        print("\n" + "=" * 60)
        print("5. 広告詳細/編集ページ")
        print("=" * 60)

        # 編集リンクを探す
        edit_links = page.query_selector_all("a[href*='content/update'], a[href*='content/detail']")
        if edit_links:
            href = edit_links[0].get_attribute("href")
            print(f"最初の広告リンク: {href}")
            if not href.startswith("http"):
                href = f"{CATS_BASE}{href}"
            page.goto(href)
            page.wait_for_load_state("networkidle")

            # フォームフィールドを全取得
            inputs = page.query_selector_all("input, select, textarea")
            print(f"\nフォーム要素数: {len(inputs)}")
            for inp in inputs:
                tag = inp.evaluate("el => el.tagName")
                name = inp.get_attribute("name") or ""
                inp_type = inp.get_attribute("type") or ""
                value = inp.get_attribute("value") or ""
                if tag == "SELECT":
                    selected = inp.query_selector("option[selected]")
                    value = selected.inner_text().strip() if selected else ""
                if name:
                    print(f"  {tag}[{name}] type={inp_type} value={value[:60]}")

            with open("/Users/yumhahada/ad-orchestration/meta-ads-fetcher/cats_content_detail.html", "w") as f:
                f.write(page.content())
        else:
            print("編集リンクが見つかりません")

        browser.close()
        print("\n完了!")


if __name__ == "__main__":
    explore()
