"""CATS管理画面 → Supabase 同期スクリプト"""
import asyncio
import json
import os
import re
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from supabase import create_client

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

# CATS広告主 → projects の名前マッピング
CATS_PROJECT_MAP = {
    "DOT-AI": None,      # 後で project_id を解決
    "ミラネスシャツ": None,
    "オリパ堂": None,
    "ローコスト": None,
    "ウェブフリ": None,
    "キャリドラ": None,
    "アンサード": None,
    "REDEN": None,
    "バルクオム": None,
    "SMUUL": None,
}


def resolve_project_ids():
    """CATS広告主名 → Supabase projects.id をマッピング"""
    result = supabase.table("projects").select("id, name").execute()
    for p in result.data:
        for cats_name in CATS_PROJECT_MAP:
            if cats_name.lower() in p["name"].lower():
                CATS_PROJECT_MAP[cats_name] = p["id"]
                break


async def sync_all():
    resolve_project_ids()
    print(f"Project mapping: {CATS_PROJECT_MAP}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # ログイン
        await page.goto(os.getenv("CATS_LOGIN_URL"), wait_until="networkidle")
        await page.fill('input[name="loginId"]', os.getenv("CATS_USERNAME"))
        await page.fill('input[name="password"]', os.getenv("CATS_PASSWORD"))
        await page.click('button[type="submit"]')
        await page.wait_for_load_state("networkidle")
        print("[OK] Logged in")

        # 1. 広告主
        print("\n[1] Syncing cats_clients...")
        await page.goto("https://bonnou.admin01.l-ad.net/admin/client/list", wait_until="networkidle")
        clients = await page.eval_on_selector_all('table tbody tr', '''rows => rows.map(row => {
            const cells = row.querySelectorAll("td");
            return { id: parseInt(cells[1]?.textContent?.trim()), name: cells[2]?.textContent?.trim(), registered_at: cells[3]?.textContent?.trim() };
        })''')
        for c in clients:
            if not c.get("id"):
                continue
            project_id = CATS_PROJECT_MAP.get(c["name"])
            supabase.table("cats_clients").upsert({
                "cats_client_id": c["id"],
                "name": c["name"],
                "project_id": project_id,
            }, on_conflict="cats_client_id").execute()
        print(f"  {len(clients)} clients synced")

        # 2. 媒体
        print("\n[2] Syncing cats_partners...")
        await page.goto("https://bonnou.admin01.l-ad.net/admin/partner/list", wait_until="networkidle")
        partners = await page.eval_on_selector_all('table tbody tr', '''rows => rows.map(row => {
            const cells = row.querySelectorAll("td");
            return { id: parseInt(cells[1]?.textContent?.trim()), name: cells[2]?.textContent?.trim() };
        })''')
        for pt in partners:
            if not pt.get("id"):
                continue
            # プラットフォーム判定
            name = pt["name"]
            platform = "Meta" if name.startswith("Meta_") else "TikTok" if name.startswith("TikTok_") else "LINE" if "LINE" in name else "Other"
            # 広告主を名前から推定
            client_name = name.split("_", 1)[1] if "_" in name else name
            cats_client_id = None
            for c in clients:
                if c.get("name") and c["name"] in client_name:
                    cats_client_id = c["id"]
                    break
            supabase.table("cats_partners").upsert({
                "cats_partner_id": pt["id"],
                "name": name,
                "platform": platform,
                "cats_client_id": cats_client_id,
            }, on_conflict="cats_partner_id").execute()
        print(f"  {len(partners)} partners synced")

        # 3. 広告グループ
        print("\n[3] Syncing cats_content_groups...")
        await page.goto("https://bonnou.admin01.l-ad.net/admin/contentgroup/list", wait_until="networkidle")
        groups = await page.eval_on_selector_all('table tbody tr', '''rows => rows.map(row => {
            const cells = row.querySelectorAll("td");
            return { id: parseInt(cells[1]?.textContent?.trim()), name: cells[2]?.textContent?.trim(), ad_count: parseInt(cells[4]?.textContent?.trim()) || 0 };
        })''')
        for g in groups:
            if not g.get("id"):
                continue
            client_name = g["name"].split("_", 1)[1] if "_" in g["name"] else g["name"]
            cats_client_id = None
            for c in clients:
                if c.get("name") and c["name"] in client_name:
                    cats_client_id = c["id"]
                    break
            supabase.table("cats_content_groups").upsert({
                "cats_group_id": g["id"],
                "name": g["name"],
                "cats_client_id": cats_client_id,
                "ad_count": g["ad_count"],
            }, on_conflict="cats_group_id").execute()
        print(f"  {len(groups)} groups synced")

        # 4. API連携
        print("\n[4] Syncing cats_api_integrations...")
        await page.goto("https://bonnou.admin01.l-ad.net/admin/setting/conversions/list/index", wait_until="networkidle")
        apis = await page.eval_on_selector_all('table tbody tr', '''rows => rows.map(row => {
            const cells = row.querySelectorAll("td");
            return { id: parseInt(cells[1]?.textContent?.trim()), platform: cells[2]?.textContent?.trim(), name: cells[3]?.textContent?.trim() };
        })''')
        for a in apis:
            if not a.get("id"):
                continue
            api_name = a["name"].strip()
            client_name = api_name.split("_", 1)[1] if "_" in api_name else api_name
            cats_client_id = None
            for c in clients:
                if c.get("name") and c["name"] in client_name:
                    cats_client_id = c["id"]
                    break
            supabase.table("cats_api_integrations").upsert({
                "cats_api_id": a["id"],
                "name": api_name,
                "platform": a["platform"].strip(),
                "cats_client_id": cats_client_id,
            }, on_conflict="cats_api_id").execute()
        print(f"  {len(apis)} API integrations synced")

        # 5. 広告 + クリックURL + 中間クリックURL
        print("\n[5] Syncing cats_contents (ads + click URLs)...")

        # 5a. 広告一覧 (120件表示)
        await page.goto("https://bonnou.admin01.l-ad.net/admin/content/list", wait_until="networkidle")
        try:
            await page.select_option('select[name="dataTable_length"]', "120")
            await page.wait_for_timeout(2000)
        except:
            pass

        content_list = await page.eval_on_selector_all('table tbody tr', '''rows => rows.map(row => {
            const cells = row.querySelectorAll("td");
            const idText = cells[1]?.textContent?.trim();
            const clientText = cells[2]?.textContent?.trim();
            const nameText = cells[3]?.textContent?.trim();
            const groupText = cells[4]?.textContent?.trim();
            const dateText = cells[6]?.textContent?.trim();
            return { id: parseInt(idText), client_name: clientText, name: nameText, group_name: groupText, registered_at: dateText };
        })''')
        print(f"  Found {len(content_list)} ads")

        # 5b. クリックURL一覧
        await page.goto("https://bonnou.admin01.l-ad.net/admin/clicktag/list", wait_until="networkidle")
        try:
            await page.select_option('select[name="dataTable_length"]', "120")
            await page.wait_for_timeout(2000)
        except:
            pass

        click_urls = await page.evaluate(r'''() => {
            const rows = document.querySelectorAll("table tbody tr");
            const result = {};
            for (const row of rows) {
                const cells = row.querySelectorAll("td");
                const adText = cells[4]?.textContent?.trim() || "";
                const adIdMatch = adText.match(/^(\d+):/);
                if (!adIdMatch) continue;
                const adId = parseInt(adIdMatch[1]);
                const copyBtns = row.querySelectorAll("[onclick*='urlCopy']");
                let redirect_url = "", direct_param = "";
                for (const btn of copyBtns) {
                    const onclick = btn.getAttribute("onclick");
                    const match = onclick?.match(/urlCopy\('([^']+)'\)/);
                    if (match) {
                        if (match[1].startsWith("http")) redirect_url = match[1];
                        else direct_param = match[1];
                    }
                }
                const partnerText = cells[0]?.textContent?.trim() || "";
                const partnerIdMatch = partnerText.match(/^(\d+):/);
                result[adId] = { redirect_url, direct_param, partner_id: partnerIdMatch ? parseInt(partnerIdMatch[1]) : null };
            }
            return result;
        }''')
        print(f"  Found {len(click_urls)} click URLs")

        # 5c. 中間クリックURL一覧
        await page.goto("https://bonnou.admin01.l-ad.net/admin/middleclicktag/list", wait_until="networkidle")
        middle_urls = await page.evaluate(r'''() => {
            const rows = document.querySelectorAll("table tbody tr");
            const result = {};
            for (const row of rows) {
                const cells = row.querySelectorAll("td");
                const idText = cells[0]?.textContent?.trim() || "";
                const adId = parseInt(idText);
                if (!adId) continue;
                const copyBtns = row.querySelectorAll("[onclick*='urlCopy']");
                let middle_redirect_url = "", middle_direct_param = "";
                for (const btn of copyBtns) {
                    const onclick = btn.getAttribute("onclick");
                    const match = onclick?.match(/urlCopy\('([^']+)'\)/);
                    if (match) {
                        if (match[1].startsWith("http")) middle_redirect_url = match[1];
                        else middle_direct_param = match[1];
                    }
                }
                result[adId] = { middle_redirect_url, middle_direct_param };
            }
            return result;
        }''')
        print(f"  Found {len(middle_urls)} middle click URLs")

        # 5d. DBに書き込み
        for content in content_list:
            if not content.get("id"):
                continue
            ad_id = content["id"]

            # 広告主ID解決
            cats_client_id = None
            for c in clients:
                if c.get("name") == content.get("client_name"):
                    cats_client_id = c["id"]
                    break

            # グループID解決
            cats_group_id = None
            for g in groups:
                if g.get("name") == content.get("group_name"):
                    cats_group_id = g["id"]
                    break

            # クリックURL
            click = click_urls.get(str(ad_id), {})
            middle = middle_urls.get(str(ad_id), {})

            # 遷移タイプ判定
            has_middle = bool(middle.get("middle_redirect_url"))
            transition_type = "middle_click" if has_middle else "direct_click"

            # project_id解決
            project_id = CATS_PROJECT_MAP.get(content.get("client_name"))

            row = {
                "cats_content_id": ad_id,
                "name": content["name"],
                "cats_client_id": cats_client_id,
                "cats_group_id": cats_group_id,
                "cats_partner_id": click.get("partner_id"),
                "redirect_url": click.get("redirect_url") or None,
                "direct_param": click.get("direct_param") or None,
                "middle_redirect_url": middle.get("middle_redirect_url") or None,
                "middle_direct_param": middle.get("middle_direct_param") or None,
                "transition_type": transition_type,
                "project_id": project_id,
                "registered_at": content.get("registered_at"),
            }
            supabase.table("cats_contents").upsert(row, on_conflict="cats_content_id").execute()

        print(f"  {len(content_list)} ads synced to cats_contents")

        await browser.close()

    # 確認
    print("\n=== Sync Summary ===")
    for table in ["cats_clients", "cats_partners", "cats_content_groups", "cats_api_integrations", "cats_contents"]:
        result = supabase.table(table).select("*", count="exact").execute()
        print(f"  {table}: {result.count} rows")

    # 中間クリック使用件数
    result = supabase.table("cats_contents").select("*", count="exact").eq("transition_type", "middle_click").execute()
    print(f"  cats_contents (middle_click): {result.count} rows")
    result = supabase.table("cats_contents").select("*", count="exact").eq("transition_type", "direct_click").execute()
    print(f"  cats_contents (direct_click): {result.count} rows")


if __name__ == "__main__":
    asyncio.run(sync_all())
