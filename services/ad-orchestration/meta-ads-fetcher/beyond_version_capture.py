"""Capture Beyond API calls during version duplication + parameter setting."""

import os
import time
import json
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()
SB_EMAIL = os.getenv("SQUAD_BEYOND_EMAIL")
SB_PASS = os.getenv("SQUAD_BEYOND_PASSWORD")

api_calls = []


def on_resp(response):
    url = response.url
    method = response.request.method
    if "squadbeyond" not in url:
        return
    if method not in ("POST", "PUT", "PATCH", "DELETE"):
        return
    if any(x in url for x in ["google-analytics", "bam.nr-data", "sentry",
                                "hubspot", "channel.io", "track?", "collect?"]):
        return
    body = ""
    try:
        ct = response.headers.get("content-type", "")
        if "json" in ct:
            body = json.dumps(response.json(), ensure_ascii=False)[:3000]
    except:
        pass
    post = ""
    try:
        post = response.request.post_data or ""
    except:
        post = "(binary)"
    api_calls.append({
        "method": method, "url": url, "status": response.status,
        "post": str(post)[:3000], "resp": body,
    })
    short = url.replace("https://api.squadbeyond.com", "").split("?")[0]
    print(f"  [{method} {response.status}] {short}")
    if post and str(post) != "(binary)":
        print(f"    POST: {str(post)[:300]}")
    if body:
        print(f"    RESP: {body[:300]}")


def login_bleach(page):
    """Login to Beyond as ブリーチ team."""
    page.goto("https://app.squadbeyond.com/sign_in")
    page.wait_for_load_state("networkidle")
    time.sleep(3)
    page.fill('input[name="email"]', SB_EMAIL)
    page.fill('input[name="password"]', SB_PASS)
    time.sleep(1)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    time.sleep(8)

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
        print("login: bleach OK")
    else:
        print("login: bleach button NOT FOUND")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        login_bleach(page)
        page.on("response", on_resp)

        uid = "lowc-m3-02aq-bonfk00"
        page.goto(f"https://app.squadbeyond.com/ab_tests/{uid}/articles")
        time.sleep(10)

        has_v = page.locator("text=02aq").count()
        print(f"\n02aq found: {has_v}")
        if not has_v:
            print("ABORT: version not found")
            browser.close()
            return

        api_calls.clear()

        # === Step 1: 複製 ===
        print("\n=== Step 1: 複製 ===")
        v = page.locator("text=02aq").first
        box = v.bounding_box()
        page.mouse.click(box["x"] + 20, box["y"] + 40)
        time.sleep(1)
        dup = page.locator("text=複製")
        if dup.count() > 0 and dup.first.is_visible():
            dup.first.click()
            time.sleep(3)
            print("duplicated")
        page.screenshot(path="/tmp/beyond_step1_dup.png")

        # === Step 2: パラメータ設定画面に直接遷移 ===
        print("\n=== Step 2: パラメータ設定画面 ===")
        page.goto(f"https://app.squadbeyond.com/ab_tests/{uid}/articles/split_test_settings/params")
        time.sleep(10)
        page.screenshot(path="/tmp/beyond_step2_params.png")

        # パラメータ画面のinputを確認
        inputs = page.locator("input").all()
        visible_inputs = [inp for inp in inputs if inp.is_visible()]
        print(f"Visible inputs: {len(visible_inputs)}")
        for i, inp in enumerate(visible_inputs):
            val = inp.input_value()
            print(f"  [{i}] value='{val[:50]}'")

        # === Step 3: パラメータ入力 ===
        print("\n=== Step 3: パラメータ入力 ===")
        # 空のinputを探す（新しく複製されたVersionのパラメータ欄）
        empty_inputs = [inp for inp in visible_inputs if not inp.input_value()]
        print(f"Empty inputs: {len(empty_inputs)}")
        if empty_inputs:
            target = empty_inputs[-1]
            target.click()
            target.type("sbv=test123")
            time.sleep(1)
            target.press("Enter")
            time.sleep(3)
            print("parameter entered: sbv=test123")
        page.screenshot(path="/tmp/beyond_step3_entered.png")

        # === Step 4: 配信割合 ===
        print("\n=== Step 4: 配信割合 ===")
        # 配信割合はVersion画面に戻って変更が必要かも
        # まずこの画面でnumber inputを探す
        num_inputs = page.locator('input[type="number"]').all()
        visible_nums = [n for n in num_inputs if n.is_visible()]
        print(f"Number inputs: {len(visible_nums)}")
        for i, n in enumerate(visible_nums):
            print(f"  [{i}] value={n.input_value()}")

        page.screenshot(path="/tmp/beyond_step4_weight.png")

        # === Step 5: 更新 ===
        print("\n=== Step 5: 更新 ===")
        update_btn = page.locator('button:has-text("更新")')
        if update_btn.count() > 0 and update_btn.first.is_visible():
            update_btn.first.click()
            time.sleep(8)
            print("updated!")

        page.screenshot(path="/tmp/beyond_step5_done.png")

        # === Results ===
        print(f"\n{'='*60}")
        print(f"=== {len(api_calls)} API calls captured ===")
        print(f"{'='*60}")
        for c in api_calls:
            print(f"\n  [{c['method']} {c['status']}] {c['url'][:120]}")
            if c["post"]:
                print(f"    POST: {c['post'][:600]}")
            if c["resp"]:
                print(f"    RESP: {c['resp'][:600]}")

        with open("/tmp/beyond_full_api.json", "w") as f:
            json.dump(api_calls, f, ensure_ascii=False, indent=2)
        print(f"\nSaved to /tmp/beyond_full_api.json")

        browser.close()


if __name__ == "__main__":
    main()
