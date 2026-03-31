"""Quick test: Beyond Version duplication API."""

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
    base = "https://api.squadbeyond.com/api/v1"
    url = f"{base}{endpoint}"
    body_str = json.dumps(body, ensure_ascii=False) if body else "null"
    js = f"""
    async () => {{
        const opts = {{method: "{method}", credentials: "include"}};
        if ({json.dumps(body is not None)}) {{
            opts.headers = {{"Content-Type": "application/json"}};
            opts.body = JSON.stringify({body_str});
        }}
        const resp = await fetch("{url}", opts);
        const text = await resp.text();
        try {{ return {{status: resp.status, data: JSON.parse(text)}}; }}
        catch(e) {{ return {{status: resp.status, text: text.substring(0, 500)}}; }}
    }}
    """
    return page.evaluate(js)


def login_bleach(page):
    page.goto("https://app.squadbeyond.com/sign_in")
    page.wait_for_load_state("networkidle")
    time.sleep(3)

    has_pw = page.locator('input[name="password"]').count() > 0
    if has_pw:
        page.fill('input[name="email"]', SB_EMAIL)
        page.fill('input[name="password"]', SB_PASS)
        time.sleep(1)
        page.click('button[type="submit"]')
        page.wait_for_load_state("networkidle")
        time.sleep(8)

    # Team select
    structure = page.evaluate("""() => {
        const btns = document.querySelectorAll('button');
        const r = []; let idx = 0;
        btns.forEach(b => {
            if (b.innerText.trim() === 'ログイン') {
                let el = b; let pt = [];
                for (let i=0;i<2;i++) { el=el.parentElement; if(!el)break; pt.push(el.innerText.replace(/\\n/g,' | ').substring(0,100)); }
                r.push({idx:idx, pt:pt}); idx++;
            }
        });
        return r;
    }""")

    bleach_idx = None
    for item in structure:
        for txt in item["pt"]:
            if "ブリーチ" in txt and "BONNOU" not in txt:
                bleach_idx = item["idx"]
                break
        if bleach_idx is not None:
            break

    if bleach_idx is not None:
        page.evaluate(f"""() => {{
            const btns = document.querySelectorAll('button');
            let idx = 0;
            btns.forEach(b => {{ if(b.innerText.trim()==='ログイン'){{ if(idx==={bleach_idx})b.click(); idx++; }} }});
        }}""")
        page.wait_for_load_state("networkidle")
        time.sleep(8)
        print("login: bleach OK")


def main():
    uid = "lowc-m3-02aq-bonfk00"

    with sync_playwright() as p:
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

        login_bleach(page)

        page.goto(f"https://app.squadbeyond.com/ab_tests/{uid}/articles")
        time.sleep(5)

        # Get versions
        print("\n=== Version一覧 ===")
        r = api_fetch(page, "GET", f"/ab_tests/{uid}/articles")
        print(f"Status: {r['status']}")

        if r["status"] != 200:
            print(f"Error: {r}")
            context.close()
            return

        arts = r["data"] if isinstance(r.get("data"), list) else []
        source = None
        for a in arts:
            memo = a.get("memo", "")
            print(f"  id={a['id']} uid={a.get('uid','')[:25]} memo={memo}")
            if memo == "4444":
                source = a

        if not source:
            print("4444 not found")
            context.close()
            return

        # Duplication test
        sid = source["id"]
        suid = source["uid"]
        print(f"\n=== 複製テスト (source id={sid}) ===")

        # Try with numeric id
        r1 = api_fetch(page, "POST", f"/articles/{sid}/duplications")
        print(f"POST /articles/{sid}/duplications: status={r1['status']}")
        if r1.get("data"):
            print(f"  data: {json.dumps(r1['data'], ensure_ascii=False)[:300]}")
        if r1.get("text"):
            print(f"  text: {r1['text'][:200]}")

        # If 500 with id, try uid
        if r1["status"] >= 400:
            print(f"\nRetrying with uid...")
            r2 = api_fetch(page, "POST", f"/articles/{suid}/duplications")
            print(f"POST /articles/{suid}/duplications: status={r2['status']}")
            if r2.get("data"):
                print(f"  data: {json.dumps(r2['data'], ensure_ascii=False)[:300]}")

        # If either succeeded, test rename + parameter
        result = r1 if r1["status"] in (200, 201) else (r2 if r1["status"] >= 400 else None)
        if result and result["status"] in (200, 201):
            new_art = result["data"]
            new_id = new_art.get("id")
            new_uid = new_art.get("uid", "")
            print(f"\n=== 新Version: id={new_id} uid={new_uid} ===")

            # Rename
            print("\n=== 名前変更 ===")
            r3 = api_fetch(page, "PATCH", f"/articles/{new_id}", {"memo": "auto_test_v1"})
            print(f"  status={r3['status']}")

            # Parameter
            print("\n=== パラメータ設定 ===")
            r4 = api_fetch(page, "POST",
                f"/ab_tests/{uid}/articles/{new_uid}/parameter_allowlists",
                {"parameter": "sbv=auto_test_123"})
            print(f"  status={r4['status']}")
            if r4.get("data"):
                print(f"  data: {json.dumps(r4['data'], ensure_ascii=False)[:200]}")

        context.close()
        print("\n=== Done ===")


if __name__ == "__main__":
    main()
