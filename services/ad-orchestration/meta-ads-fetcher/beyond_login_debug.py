"""Debug Beyond team selection DOM structure."""

import os
import time
import json
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()
SB_EMAIL = os.getenv("SQUAD_BEYOND_EMAIL")
SB_PASS = os.getenv("SQUAD_BEYOND_PASSWORD")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        page.goto("https://app.squadbeyond.com/sign_in")
        page.wait_for_load_state("networkidle")
        time.sleep(3)
        page.fill('input[name="email"]', SB_EMAIL)
        page.fill('input[name="password"]', SB_PASS)
        time.sleep(1)
        page.click('button[type="submit"]')
        page.wait_for_load_state("networkidle")
        time.sleep(8)

        # DOM structure of login buttons
        structure = page.evaluate("""() => {
            const btns = document.querySelectorAll('button');
            const results = [];
            btns.forEach(btn => {
                if (btn.innerText.trim() === 'ログイン') {
                    let el = btn;
                    let ancestors = [];
                    for (let i = 0; i < 5; i++) {
                        el = el.parentElement;
                        if (!el) break;
                        ancestors.push({
                            tag: el.tagName,
                            cls: (el.className || '').substring(0, 80),
                            text: el.innerText.replace(/\\n/g, ' | ').substring(0, 100)
                        });
                    }
                    results.push({
                        y: btn.getBoundingClientRect().y,
                        ancestors: ancestors
                    });
                }
            });
            return results;
        }""")

        print(f"Found {len(structure)} login buttons")
        for i, item in enumerate(structure):
            print(f"\n=== btn[{i}] y={item['y']:.0f} ===")
            for j, anc in enumerate(item["ancestors"]):
                print(f"  [{j}] <{anc['tag']}> cls=\"{anc['cls'][:50]}\" text=\"{anc['text'][:80]}\"")

        # Method: find button whose CLOSEST parent (LI or first div) contains "ブリーチ"
        bleach_btn_index = None
        for i, item in enumerate(structure):
            # Check only first 2 ancestors (closest parents)
            for anc in item["ancestors"][:2]:
                if "ブリーチ" in anc["text"] and "BONNOU" not in anc["text"]:
                    bleach_btn_index = i
                    break
            if bleach_btn_index is not None:
                break

        print(f"\nブリーチ button index: {bleach_btn_index}")

        if bleach_btn_index is not None:
            # Click by evaluating JS
            page.evaluate(f"""() => {{
                const btns = document.querySelectorAll('button');
                let idx = 0;
                btns.forEach(btn => {{
                    if (btn.innerText.trim() === 'ログイン') {{
                        if (idx === {bleach_btn_index}) btn.click();
                        idx++;
                    }}
                }});
            }}""")
            print("Clicked ブリーチ login via JS")
            page.wait_for_load_state("networkidle")
            time.sleep(8)

            # Verify
            page.screenshot(path="/tmp/beyond_bleach_verify.png")
            body = page.inner_text("body")[:200]
            if "ブリーチ" in body[:100]:
                print("✓ ブリーチにログイン成功!")
            else:
                print(f"✗ チーム: {body[:50]}")

        browser.close()


if __name__ == "__main__":
    main()
