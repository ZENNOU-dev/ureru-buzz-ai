"""CATS広告登録フォームの詳細調査 + 既存広告のクリックURL取得フロー"""
import asyncio
import json
import os
from dotenv import load_dotenv
from playwright.async_api import async_playwright

load_dotenv()

async def investigate():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # ログイン
        print("[1] Logging in...")
        await page.goto(os.getenv("CATS_LOGIN_URL"), wait_until="networkidle")
        await page.fill('input[name="loginId"]', os.getenv("CATS_USERNAME"))
        await page.fill('input[name="password"]', os.getenv("CATS_PASSWORD"))
        await page.click('button[type="submit"]')
        await page.wait_for_load_state("networkidle")

        # ===== 広告登録フォームの詳細 =====
        print("\n[2] 広告登録フォーム詳細...")
        await page.goto("https://bonnou.admin01.l-ad.net/admin/content/register", wait_until="networkidle")

        # 広告主ドロップダウンの選択肢
        print("\n  [2a] 広告主一覧 (useClientId):")
        options = await page.eval_on_selector_all(
            'select[name="useClientId"] option',
            'els => els.map(e => ({value: e.value, text: e.textContent.trim()}))'
        )
        for o in options:
            print(f"    value={o['value']}, text={o['text']}")

        # 広告グループドロップダウンの選択肢
        print("\n  [2b] 広告グループ一覧 (useGroupId):")
        options = await page.eval_on_selector_all(
            'select[name="useGroupId"] option',
            'els => els.map(e => ({value: e.value, text: e.textContent.trim()}))'
        )
        for o in options:
            print(f"    value={o['value']}, text={o['text']}")

        # 媒体ドロップダウン
        print("\n  [2c] 媒体一覧 (usePartnerIdList):")
        options = await page.eval_on_selector_all(
            'select#usePartnerIdList option',
            'els => els.map(e => ({value: e.value, text: e.textContent.trim()}))'
        )
        for o in options:
            print(f"    value={o['value']}, text={o['text']}")

        # 発行ドメインドロップダウン
        print("\n  [2d] 発行ドメイン (useDomainId):")
        options = await page.eval_on_selector_all(
            'select[name="useDomainId"] option',
            'els => els.map(e => ({value: e.value, text: e.textContent.trim()}))'
        )
        for o in options:
            print(f"    value={o['value']}, text={o['text']}")

        # フォーム送信時のPOSTデータを確認するため、実際のPOST先URLを取得
        print("\n  [2e] フォームaction:")
        form_action = await page.eval_on_selector('form', 'f => f.action')
        form_method = await page.eval_on_selector('form', 'f => f.method')
        print(f"    action={form_action}, method={form_method}")

        # ===== 既存広告の編集画面からクリックURLを取得 =====
        print("\n[3] 既存広告の編集画面からクリックURL取得...")
        # 最新の広告 (4479) の詳細ページ
        await page.goto("https://bonnou.admin01.l-ad.net/admin/content/list", wait_until="networkidle")

        # メニューボタンを探す（最初の広告のメニュー）
        # まず広告一覧のHTMLを解析
        rows = await page.eval_on_selector_all(
            'table tbody tr',
            '''rows => rows.slice(0, 5).map(row => {
                const cells = row.querySelectorAll("td");
                const links = row.querySelectorAll("a[href]");
                return {
                    text: Array.from(cells).map(c => c.textContent.trim()).join(" | "),
                    links: Array.from(links).map(a => ({href: a.href, text: a.textContent.trim()}))
                };
            })'''
        )
        for r in rows:
            print(f"    Row: {r['text'][:200]}")
            for l in r['links']:
                print(f"      Link: {l['text']} → {l['href']}")

        # 広告の編集/詳細ページにアクセス
        print("\n[4] 広告編集ページ (content/edit/4479)...")
        await page.goto("https://bonnou.admin01.l-ad.net/admin/content/edit/4479", wait_until="networkidle")
        print(f"    URL: {page.url}")
        print(f"    Title: {await page.title()}")
        await page.screenshot(path="/tmp/cats_09_content_edit.png")

        body_text = await page.inner_text("body")
        print(f"    Body (first 3000 chars):\n{body_text[:3000]}")

        # クリックURL一覧で特定広告のURLを取得
        print("\n[5] クリックURL詳細取得...")
        await page.goto("https://bonnou.admin01.l-ad.net/admin/clicktag/list", wait_until="networkidle")

        # テーブルの最初の行のリダイレクトURLを取得
        click_urls = await page.eval_on_selector_all(
            'table tbody tr',
            '''rows => rows.slice(0, 5).map(row => {
                const cells = row.querySelectorAll("td");
                const inputs = row.querySelectorAll("input[type='text']");
                return {
                    text: Array.from(cells).map(c => c.textContent.trim().substring(0, 100)).join(" | "),
                    inputs: Array.from(inputs).map(i => ({name: i.name, value: i.value}))
                };
            })'''
        )
        for r in click_urls:
            print(f"    Row: {r['text'][:300]}")
            for i in r['inputs']:
                if i['value']:
                    print(f"      Input: {i['name']}={i['value']}")

        # リダイレクトURL要素を直接取得
        print("\n[6] リダイレクトURL要素...")
        redirect_elements = await page.query_selector_all('[class*="redirect"], [id*="redirect"], [name*="redirect"]')
        print(f"    Found {len(redirect_elements)} redirect elements")

        # コピーボタンやURL表示領域を探す
        copy_buttons = await page.query_selector_all('[class*="copy"], [onclick*="copy"]')
        print(f"    Found {len(copy_buttons)} copy buttons")
        for btn in copy_buttons[:5]:
            onclick = await btn.get_attribute("onclick") or ""
            text = await btn.inner_text()
            print(f"      Button: text={text}, onclick={onclick[:200]}")

        # テーブルのクリックURLカラム内のinput/textareaを探す
        print("\n[7] クリックURLカラム内のinput/textarea...")
        tag_inputs = await page.eval_on_selector_all(
            'table input, table textarea',
            'els => els.map(e => ({tag: e.tagName, name: e.name, id: e.id, value: e.value?.substring(0, 200), type: e.type}))'
        )
        for t in tag_inputs[:20]:
            if t.get('value'):
                print(f"    {t['tag']}: name={t['name']}, id={t['id']}, value={t['value']}")

        # ===== 広告詳細ページのフォーム値を全取得 =====
        print("\n[8] 広告編集ページのフォーム値...")
        await page.goto("https://bonnou.admin01.l-ad.net/admin/content/edit/4479", wait_until="networkidle")

        form_values = await page.evaluate('''() => {
            const result = {};
            document.querySelectorAll("input, select, textarea").forEach(el => {
                const name = el.name || el.id;
                if (!name) return;
                if (el.type === "radio" && !el.checked) return;
                if (el.type === "checkbox" && !el.checked) return;
                result[name] = el.value?.substring(0, 300);
            });
            return result;
        }''')
        for k, v in form_values.items():
            if v:
                print(f"    {k} = {v}")

        await browser.close()

asyncio.run(investigate())
