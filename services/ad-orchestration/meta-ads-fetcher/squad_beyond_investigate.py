"""Squad Beyond v5 - Cookie保持 + 全グループの記事LP一覧取得."""

import os
import time
import json
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()

SB_URL = os.getenv("SQUAD_BEYOND_URL", "https://app.squadbeyond.com/")
SB_EMAIL = os.getenv("SQUAD_BEYOND_EMAIL")
SB_PASS = os.getenv("SQUAD_BEYOND_PASSWORD")
COOKIE_FILE = "/tmp/squad_beyond_cookies.json"


def login(context):
    """ログイン + チーム選択。Cookie保存。"""
    page = context.new_page()
    page.goto(SB_URL)
    page.wait_for_load_state("networkidle")

    email_input = page.query_selector("input[type='email']")
    pass_input = page.query_selector("input[type='password']")
    if email_input and pass_input:
        email_input.fill(SB_EMAIL)
        pass_input.fill(SB_PASS)
        time.sleep(0.5)
        submit = page.query_selector("button[type='submit'], button:has-text('ログイン')")
        if submit:
            submit.click()
        page.wait_for_load_state("networkidle")
        time.sleep(2)

    # チーム選択
    bonnou = page.query_selector("text=BONNOU")
    if bonnou:
        bonnou.click()
        time.sleep(1)
        login_btn = page.query_selector("button:has-text('ログイン')")
        if login_btn:
            login_btn.click()
        page.wait_for_load_state("networkidle")
        time.sleep(3)

    # Cookie保存
    cookies = context.cookies()
    with open(COOKIE_FILE, "w") as f:
        json.dump(cookies, f)
    print(f"  Logged in, {len(cookies)} cookies saved")
    return page


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Cookie復元を試みる
        context = browser.new_context()
        if os.path.exists(COOKIE_FILE):
            with open(COOKIE_FILE) as f:
                cookies = json.load(f)
            context.add_cookies(cookies)
            page = context.new_page()
            page.goto(SB_URL)
            page.wait_for_load_state("networkidle")
            time.sleep(2)

            # ログイン画面に戻されたか確認
            if "sign_in" in page.url or page.query_selector("input[type='password']"):
                print("  Cookie expired, re-logging in...")
                page.close()
                page = login(context)
            else:
                print(f"  Cookie restored: {page.url}")
        else:
            page = login(context)

        # beyondページに移動
        page.goto(SB_URL)
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        # グループリスト取得
        print("\n=== グループリスト ===")
        groups = page.evaluate("""() => {
            const groups = [];
            // グループリスト内のアイテムを取得
            const items = document.querySelectorAll('[class*="group"], [class*="Group"]');
            items.forEach(item => {
                const text = item.innerText?.trim();
                if (text && text.length < 50 && !text.includes('\\n')) {
                    groups.push(text);
                }
            });
            if (groups.length === 0) {
                // フォールバック: テキストからグループ名を探す
                const body = document.body.innerText;
                const knownGroups = ['ローコスト', 'REDEN', 'LACOCO', 'ミラネスシャツ', 'DOT-AI', 'アンサード'];
                knownGroups.forEach(g => {
                    if (body.includes(g)) groups.push(g);
                });
            }
            return groups;
        }""")
        print(f"  Groups: {groups}")

        # 各グループを展開してフォルダ・ページを取得
        target_groups = ['ローコスト', 'REDEN', 'アンサード', 'ミラネスシャツ', 'DOT-AI']

        all_results = {}

        for group_name in target_groups:
            print(f"\n=== {group_name} ===")

            # グループをクリック
            group_el = page.query_selector(f"text={group_name}")
            if not group_el:
                print(f"  Group not found: {group_name}")
                continue

            group_el.click()
            time.sleep(1.5)

            # 展開後のコンテンツを取得
            expanded = page.evaluate("""(groupName) => {
                const results = {folders: [], pages: []};

                // ページ内の全テキストを取得してフォルダ/ページ構造を解析
                const body = document.body.innerText;
                const lines = body.split('\\n').filter(l => l.trim());

                let inGroup = false;
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed === groupName) {
                        inGroup = true;
                        continue;
                    }
                    if (inGroup) {
                        // 次のグループに到達したら終了
                        if (['REDEN', 'LACOCO', 'ミラネスシャツ', 'DOT-AI', 'アンサード', 'メンズクリア',
                             'リライブシャツα', 'STLASSH', 'MEDULLA', 'ニューZ', 'リゲイン', 'Brighte',
                             '過去案件', 'バルクオム', 'ウェブフリ', 'FB保留', 'リスティング', 'MEALFOR',
                             'LAP', 'facebook', 'bytedance', 'グループにいないフォルダ', 'フォルダ作成',
                             'tikローコスト', 'ローコスト'].includes(trimmed) && trimmed !== groupName) {
                            // tikローコストはローコストのサブフォルダなので除外しない
                            if (trimmed !== 'tikローコスト' || groupName !== 'ローコスト') {
                                break;
                            }
                        }
                        if (trimmed.length > 2 && trimmed.length < 100) {
                            results.folders.push(trimmed);
                        }
                    }
                }
                return results;
            }""", group_name)

            print(f"  Sub-items: {expanded['folders'][:10]}")
            all_results[group_name] = expanded

            # フォルダをクリックしてページ一覧を確認
            for folder_name in expanded['folders'][:3]:
                folder_el = page.query_selector(f"text={folder_name}")
                if folder_el:
                    folder_el.click()
                    time.sleep(2)
                    page.wait_for_load_state("networkidle")
                    time.sleep(1)

                    # URLが変わったか確認
                    if "/folders/" in page.url or "/articles" in page.url:
                        print(f"  Navigated to: {page.url}")

                        # ページ一覧を取得
                        page_list = page.evaluate("""() => {
                            const pages = [];
                            // テーブル行やカード要素を探す
                            document.querySelectorAll('tr, [class*="card"], [class*="row"], [class*="article"]').forEach(el => {
                                const text = el.innerText?.trim().substring(0, 200);
                                const links = Array.from(el.querySelectorAll('a')).map(a => ({
                                    text: a.innerText?.trim().substring(0, 50),
                                    href: a.href
                                }));
                                if (text && text.length > 5 && links.length > 0) {
                                    pages.push({text: text.replace(/\\n/g, ' | ').substring(0, 150), links});
                                }
                            });
                            return pages.slice(0, 20);
                        }""")

                        if page_list:
                            print(f"  Pages in {folder_name}: {len(page_list)}")
                            for pg in page_list[:5]:
                                print(f"    {pg['text'][:100]}")
                                for l in pg['links'][:2]:
                                    print(f"      → {l['href']}")

                        # スクリーンショット
                        page.screenshot(path=f"/tmp/sb_{group_name}_{folder_name}.png")

                    # 戻る
                    page.goto(SB_URL)
                    page.wait_for_load_state("networkidle")
                    time.sleep(2)

                    # グループを再展開
                    group_el = page.query_selector(f"text={group_name}")
                    if group_el:
                        group_el.click()
                        time.sleep(1)

        # Cookie更新
        cookies = context.cookies()
        with open(COOKIE_FILE, "w") as f:
            json.dump(cookies, f)

        browser.close()
        print("\n\n=== Summary ===")
        for g, data in all_results.items():
            print(f"  {g}: {data['folders'][:5]}")
        print("\n=== Done ===")


if __name__ == "__main__":
    main()
