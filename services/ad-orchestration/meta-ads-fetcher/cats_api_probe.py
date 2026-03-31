"""CATS REST API プローブ - POSTでエンドポイントを調査"""
import os
import json
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv()

CATS_BASE = "https://bonnou.admin01.l-ad.net"
CATS_USER = os.getenv("CATS_USERNAME")
CATS_PASS = os.getenv("CATS_PASSWORD")


def probe_api():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()

        # ログイン（Cookie取得）
        page.goto(f"{CATS_BASE}/admin/")
        page.fill('input[name="loginId"]', CATS_USER)
        page.fill('input[name="password"]', CATS_PASS)
        page.click('button[type="submit"], input[type="submit"]')
        page.wait_for_load_state("networkidle")
        print("ログイン完了\n")

        # Cookie取得
        cookies = ctx.cookies()
        cookie_str = "; ".join([f"{c['name']}={c['value']}" for c in cookies])
        print(f"Cookies: {len(cookies)} 件")
        for c in cookies:
            print(f"  {c['name']}: {c['value'][:30]}...")

        # ===== ネットワークリクエスト全キャプチャ =====
        print("\n=== 広告登録フォームのネットワーク監視 ===")
        all_reqs = []
        def capture_all(req):
            if CATS_BASE in req.url and not any(ext in req.url for ext in ['.css', '.js', '.png', '.jpg', '.gif', '.ico', '.woff', '.ttf', 'google']):
                all_reqs.append({
                    "method": req.method,
                    "url": req.url,
                    "post_data": req.post_data[:200] if req.post_data else None,
                })
        page.on("request", capture_all)

        # 広告登録フォームにアクセス
        page.goto(f"{CATS_BASE}/admin/content/register")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        print(f"\nリクエスト数: {len(all_reqs)}")
        for req in all_reqs:
            print(f"  {req['method']} {req['url']}")
            if req['post_data']:
                print(f"    POST: {req['post_data']}")

        # 広告登録フォームの全フィールドを取得
        print("\n=== 広告登録フォーム ===")
        forms = page.query_selector_all("form")
        for form in forms:
            action = form.get_attribute("action") or ""
            method = form.get_attribute("method") or ""
            if "content" in action or "register" in action:
                print(f"  form action={action} method={method}")

                # 全input/select/textarea
                elements = form.query_selector_all("input, select, textarea")
                for el in elements:
                    tag = el.evaluate("el => el.tagName")
                    name = el.get_attribute("name") or ""
                    el_type = el.get_attribute("type") or ""
                    el_id = el.get_attribute("id") or ""
                    value = el.get_attribute("value") or ""

                    if tag == "SELECT":
                        opts = el.query_selector_all("option")
                        opt_list = [(o.get_attribute("value") or "", o.inner_text().strip()[:40]) for o in opts[:15]]
                        print(f"  SELECT[{name}] id={el_id}: {opt_list}")
                    elif el_type == "radio":
                        checked = el.get_attribute("checked")
                        label = ""
                        label_el = page.query_selector(f'label[for="{el_id}"]')
                        if label_el:
                            label = label_el.inner_text().strip()
                        print(f"  RADIO[{name}] value={value} label={label} checked={checked is not None}")
                    elif el_type != "hidden" or name:
                        print(f"  {tag}[{name}] type={el_type} value={value[:50]}")

        # ===== フォームPOST先の調査 =====
        print("\n=== フォームPOST先の確認 ===")

        # 広告登録のPOST先
        all_reqs.clear()
        # ドロップダウン変更時のAjax呼び出しを確認
        selects = page.query_selector_all("select")
        for sel in selects:
            name = sel.get_attribute("name") or ""
            if "client" in name.lower() or "useClient" in name:
                # 広告主選択を変更してAjaxを監視
                opts = sel.query_selector_all("option")
                if len(opts) > 1:
                    val = opts[1].get_attribute("value")
                    print(f"\n  広告主セレクト変更: {name} → {val}")
                    sel.select_option(val)
                    page.wait_for_timeout(2000)
                    if all_reqs:
                        print(f"  Ajax呼び出し検出!")
                        for req in all_reqs:
                            print(f"    {req['method']} {req['url']}")
                            if req['post_data']:
                                print(f"    POST: {req['post_data']}")
                break

        # ===== /admin/api/ をPOSTで叩く =====
        print("\n=== /admin/api/ POST テスト ===")
        api_endpoints = [
            ("/admin/api/", "{}"),
            ("/admin/api/content/list", "{}"),
            ("/admin/api/clicktag/list", "{}"),
        ]

        for ep, body in api_endpoints:
            resp = page.evaluate(f"""
                async () => {{
                    const res = await fetch('{CATS_BASE}{ep}', {{
                        method: 'POST',
                        headers: {{'Content-Type': 'application/json'}},
                        body: '{body}',
                    }});
                    return {{
                        status: res.status,
                        headers: Object.fromEntries(res.headers.entries()),
                        body: await res.text().then(t => t.substring(0, 500))
                    }};
                }}
            """)
            print(f"  POST {ep} → {resp['status']}")
            if resp['body']:
                print(f"    Body: {resp['body'][:300]}")

        browser.close()
        print("\n完了!")


if __name__ == "__main__":
    probe_api()
