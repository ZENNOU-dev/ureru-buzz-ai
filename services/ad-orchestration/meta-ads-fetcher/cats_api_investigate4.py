"""CATS全エンティティの調査: 広告主, 媒体, 広告グループ, API連携, 中間クリックURL, 成果地点"""
import asyncio
import json
import os
from dotenv import load_dotenv
from playwright.async_api import async_playwright

load_dotenv()

async def investigate():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # ログイン
        await page.goto(os.getenv("CATS_LOGIN_URL"), wait_until="networkidle")
        await page.fill('input[name="loginId"]', os.getenv("CATS_USERNAME"))
        await page.fill('input[name="password"]', os.getenv("CATS_PASSWORD"))
        await page.click('button[type="submit"]')
        await page.wait_for_load_state("networkidle")

        # ===== 1. 広告主一覧 =====
        print("=" * 60)
        print("[1] 広告主一覧")
        print("=" * 60)
        await page.goto("https://bonnou.admin01.l-ad.net/admin/client/list", wait_until="networkidle")
        rows = await page.eval_on_selector_all('table tbody tr', '''rows => rows.map(row => {
            const cells = row.querySelectorAll("td");
            return Array.from(cells).map(c => c.textContent.trim()).join(" | ");
        })''')
        for r in rows:
            print(f"  {r}")

        # ===== 2. 媒体一覧 =====
        print("\n" + "=" * 60)
        print("[2] 媒体一覧")
        print("=" * 60)
        await page.goto("https://bonnou.admin01.l-ad.net/admin/partner/list", wait_until="networkidle")
        rows = await page.eval_on_selector_all('table tbody tr', '''rows => rows.map(row => {
            const cells = row.querySelectorAll("td");
            return Array.from(cells).map(c => c.textContent.trim()).join(" | ");
        })''')
        for r in rows:
            print(f"  {r}")

        # ===== 3. 媒体カテゴリ一覧 =====
        print("\n" + "=" * 60)
        print("[3] 媒体カテゴリ一覧")
        print("=" * 60)
        await page.goto("https://bonnou.admin01.l-ad.net/admin/partnercategory/list", wait_until="networkidle")
        rows = await page.eval_on_selector_all('table tbody tr', '''rows => rows.map(row => {
            const cells = row.querySelectorAll("td");
            return Array.from(cells).map(c => c.textContent.trim()).join(" | ");
        })''')
        for r in rows:
            print(f"  {r}")

        # ===== 4. 広告グループ一覧 =====
        print("\n" + "=" * 60)
        print("[4] 広告グループ一覧")
        print("=" * 60)
        await page.goto("https://bonnou.admin01.l-ad.net/admin/contentgroup/list", wait_until="networkidle")
        rows = await page.eval_on_selector_all('table tbody tr', '''rows => rows.map(row => {
            const cells = row.querySelectorAll("td");
            return Array.from(cells).map(c => c.textContent.trim()).join(" | ");
        })''')
        for r in rows:
            print(f"  {r}")

        # ===== 5. API連携一覧 (詳細) =====
        print("\n" + "=" * 60)
        print("[5] API連携一覧")
        print("=" * 60)
        await page.goto("https://bonnou.admin01.l-ad.net/admin/setting/conversions/list/index", wait_until="networkidle")
        rows = await page.eval_on_selector_all('table tbody tr', '''rows => rows.map(row => {
            const cells = row.querySelectorAll("td");
            const links = row.querySelectorAll("a[href]");
            return {
                text: Array.from(cells).map(c => c.textContent.trim()).join(" | "),
                links: Array.from(links).map(a => ({href: a.href, text: a.textContent.trim()}))
            };
        })''')
        for r in rows:
            print(f"  {r['text']}")
            for l in r['links']:
                if l['href'] != 'javascript:void(0);':
                    print(f"    → {l['text']}: {l['href']}")

        # ===== 6. 中間クリックURL一覧 =====
        print("\n" + "=" * 60)
        print("[6] 中間クリックURL一覧")
        print("=" * 60)
        await page.goto("https://bonnou.admin01.l-ad.net/admin/middleclicktag/list", wait_until="networkidle")
        body_text = await page.inner_text("body")
        # テーブルがあるか確認
        rows = await page.eval_on_selector_all('table tbody tr', '''rows => rows.map(row => {
            const cells = row.querySelectorAll("td");
            const copyBtns = row.querySelectorAll("[onclick*='urlCopy']");
            return {
                text: Array.from(cells).map(c => c.textContent.trim().substring(0, 80)).join(" | "),
                urls: Array.from(copyBtns).map(btn => {
                    const match = btn.getAttribute("onclick")?.match(/urlCopy\('([^']+)'\)/);
                    return match ? match[1] : "";
                }).filter(u => u)
            };
        })''')
        print(f"  {len(rows)} rows found")
        for r in rows[:10]:
            print(f"  {r['text']}")
            for u in r['urls']:
                print(f"    URL: {u}")

        # ===== 7. 成果地点 =====
        print("\n" + "=" * 60)
        print("[7] 成果地点")
        print("=" * 60)
        await page.goto("https://bonnou.admin01.l-ad.net/admin/setting/catspoint/update", wait_until="networkidle")
        body_text = await page.inner_text("body")
        print(f"  {body_text[:2000]}")

        # ===== 8. 広告詳細 (遷移先URL含む) - 最新の広告を1つ =====
        print("\n" + "=" * 60)
        print("[8] 広告詳細 (ID=4479)")
        print("=" * 60)
        # 広告一覧のメニューから編集リンクを探す
        await page.goto("https://bonnou.admin01.l-ad.net/admin/content/list", wait_until="networkidle")
        # メニューアイコンのクリックで表示されるリンクを取得
        menus = await page.eval_on_selector_all('table tbody tr', '''rows => {
            const first = rows[0];
            if (!first) return [];
            const menuBtn = first.querySelector("[data-toggle='dropdown'], .dropdown-toggle");
            const links = first.querySelectorAll(".dropdown-menu a");
            return Array.from(links).map(a => ({href: a.href, text: a.textContent.trim()}));
        }''')
        print(f"  Menu links: {json.dumps(menus, ensure_ascii=False)}")

        # 直接URLパターンを試す
        for pattern in [
            "https://bonnou.admin01.l-ad.net/admin/content/detail/4479",
            "https://bonnou.admin01.l-ad.net/admin/content/view/4479",
            "https://bonnou.admin01.l-ad.net/admin/content/show/4479",
            "https://bonnou.admin01.l-ad.net/admin/content/update/4479",
        ]:
            await page.goto(pattern, wait_until="networkidle")
            title = await page.title()
            if "404" not in title:
                print(f"  Found: {pattern} → {title}")
                form_values = await page.evaluate('''() => {
                    const result = {};
                    document.querySelectorAll("input, select, textarea").forEach(el => {
                        const name = el.name || el.id;
                        if (!name) return;
                        if (el.type === "radio" && !el.checked) return;
                        if (el.type === "checkbox" && !el.checked) return;
                        if (el.value) result[name] = el.value.substring(0, 300);
                    });
                    return result;
                }''')
                for k, v in form_values.items():
                    if v:
                        print(f"    {k} = {v}")
                break
            else:
                print(f"  404: {pattern}")

        # ===== 9. 成果通知タグ一覧 =====
        print("\n" + "=" * 60)
        print("[9] 成果通知タグ一覧")
        print("=" * 60)
        await page.goto("https://bonnou.admin01.l-ad.net/admin/actiontag/list", wait_until="networkidle")
        rows = await page.eval_on_selector_all('table tbody tr', '''rows => rows.slice(0, 10).map(row => {
            const cells = row.querySelectorAll("td");
            return Array.from(cells).map(c => c.textContent.trim().substring(0, 80)).join(" | ");
        })''')
        for r in rows:
            print(f"  {r}")

        await browser.close()

asyncio.run(investigate())
