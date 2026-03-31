"""clicktag/list の検索フォームDOM調査."""
from dotenv import load_dotenv; load_dotenv()
import os, time, json
from playwright.sync_api import sync_playwright

CATS_URL = os.getenv("CATS_LOGIN_URL", "https://bonnou.admin01.l-ad.net/admin/")
CATS_USER = os.getenv("CATS_USERNAME")
CATS_PASS = os.getenv("CATS_PASSWORD")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    page.goto(CATS_URL)
    page.wait_for_load_state("networkidle")
    if page.query_selector("input[name='loginId']"):
        page.fill("input[name='loginId']", CATS_USER)
        page.fill("input[name='password']", CATS_PASS)
        page.click("input[type='submit'], button[type='submit']")
        page.wait_for_load_state("networkidle")

    page.goto(CATS_URL + "clicktag/list")
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    # 絞り込み検索ボタンクリック
    page.evaluate("""() => {
        const btns = document.querySelectorAll('button, a');
        for (const btn of btns) {
            if (btn.innerText.trim() === '絞り込み検索') { btn.click(); return; }
        }
    }""")
    time.sleep(1)

    # 全selectのname/id/options
    selects = page.evaluate("""() => {
        return Array.from(document.querySelectorAll('select')).map(s => ({
            name: s.name,
            id: s.id,
            optCount: s.options.length,
            firstOpts: Array.from(s.options).slice(0, 5).map(o => ({v: o.value, t: o.text.substring(0, 40)})),
            visible: s.offsetParent !== null
        }));
    }""")
    print("=== Selects ===")
    for s in selects:
        print(f"  name=[{s['name']}] id=[{s['id']}] opts={s['optCount']} visible={s['visible']}")
        for o in s["firstOpts"]:
            print(f"    {o['v']}: {o['t']}")

    # checkboxes
    cbs = page.evaluate("""() => {
        return Array.from(document.querySelectorAll('input[type="checkbox"]')).map(c => ({
            name: c.name, id: c.id, value: c.value, checked: c.checked,
            label: (c.parentElement || {}).innerText || ''
        }));
    }""")
    print("\n=== Checkboxes ===")
    for c in cbs:
        lbl = c["label"].strip()[:30]
        print(f"  name=[{c['name']}] value={c['value']} checked={c['checked']} label=[{lbl}]")

    # buttons
    btns = page.evaluate("""() => {
        return Array.from(document.querySelectorAll('button, input[type="submit"]'))
            .filter(b => b.offsetParent !== null)
            .map(b => ({
                tag: b.tagName, type: b.type,
                text: (b.innerText || b.value || '').trim().substring(0, 30),
                id: b.id
            }));
    }""")
    print("\n=== Buttons ===")
    for b in btns:
        print(f"  {b['tag']} type={b['type']} text=[{b['text']}] id=[{b['id']}]")

    browser.close()
