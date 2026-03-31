"""Beyond記事LPにCATSクリックURLを設置するスクリプト"""
from playwright.sync_api import sync_playwright
import os, time, json, re
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

BEYOND_EMAIL = os.getenv('SQUAD_BEYOND_EMAIL')
BEYOND_PASS = os.getenv('SQUAD_BEYOND_PASSWORD')
BEYOND_SLUG = 'tAhFVYTqbSdNHM_rQ'
BONNOU_TEAM_UID = 'b91b2a65-3339-4609-8f95-e47f922425ad'
CATS_CLICK_URL = 'https://bnn.ac01.l-ad.net/cl/p11f0d6f60e39q20/?bid=d915adCb16458f04'

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        os.path.expanduser('~/.squad-beyond-browser'),
        headless=True,
        args=['--disable-blink-features=AutomationControlled'],
        ignore_default_args=['--enable-automation'],
    )
    page = ctx.pages[0] if ctx.pages else ctx.new_page()

    # ログイン
    page.goto('https://app.squadbeyond.com/users/sign_in')
    time.sleep(3)

    body_text = page.inner_text('body')[:500]
    if 'メールアドレス' in body_text or 'sign_in' in page.url:
        page.fill('input[type="email"], input[name="email"]', BEYOND_EMAIL)
        page.fill('input[type="password"], input[name="password"]', BEYOND_PASS)
        page.click('button[type="submit"]')
        time.sleep(5)
        print(f'Login done: {page.url}')

    # チーム選択 (BONNOU) - UI経由
    page.goto('https://app.squadbeyond.com/users/teams')
    time.sleep(3)
    # BONNOUのログインボタンを探してクリック
    # DOM構造: チーム名テキストの近くにログインボタンがある
    team_selected = False
    buttons = page.locator('button, a').all()
    for i, btn in enumerate(buttons):
        try:
            text = btn.inner_text().strip()
            # 親要素にBONNOUが含まれるログインボタンを探す
            parent_text = btn.evaluate('el => el.closest("div")?.innerText || ""')
            if 'BONNOU' in parent_text and ('ログイン' in text or 'Login' in text.lower()):
                btn.click()
                time.sleep(5)
                team_selected = True
                print(f'Team: BONNOU (clicked)')
                break
        except:
            continue
    if not team_selected:
        # フォールバック: BONNOUテキストを含む要素をクリック
        bonnou = page.locator('text=BONNOU')
        if bonnou.count() > 0:
            # BONNOUの近くのボタンを探す
            bonnou.first.click()
            time.sleep(5)
            print(f'Team: BONNOU (text click)')
        else:
            print(f'BONNOU team not found on page')
            print(page.inner_text('body')[:500])

    # Version一覧取得
    versions_raw = page.evaluate(f'''async () => {{
        const r = await fetch('https://api.squadbeyond.com/api/v1/ab_tests/{BEYOND_SLUG}/articles', {{credentials: 'include'}});
        return await r.text();
    }}''')

    try:
        versions = json.loads(versions_raw)
    except Exception as e:
        print(f'Parse error: {e}\n{versions_raw[:300]}')
        ctx.close()
        exit(1)

    if not isinstance(versions, list):
        print(f'Error: {versions_raw[:300]}')
        ctx.close()
        exit(1)

    print(f'\nVersions ({len(versions)}):')
    for v in versions:
        print(f'  id={v["id"]} memo="{v.get("memo","")}" rate={v.get("split_test_rate")}')

    # 本文リンク確認
    ver_id = versions[0]["id"]
    body_raw = page.evaluate(f'''async () => {{
        const r = await fetch('https://api.squadbeyond.com/api/v1/articles/{ver_id}', {{credentials: 'include'}});
        return await r.text();
    }}''')
    article = json.loads(body_raw)
    bodies = article.get("bodies", [])

    body_str = json.dumps(bodies, ensure_ascii=False)
    urls = re.findall(r'https?://[^\s"\\<>]+', body_str)
    unique_urls = sorted(set(urls))
    print(f'\nLinks in version {ver_id}:')
    for u in unique_urls:
        flag = ''
        if 'l-ad.net' in u: flag = ' ★CATS'
        elif 'answered-official' in u: flag = ' ★CLIENT'
        print(f'  {u[:120]}{flag}')

    # リンク置換: 計測ありリンク（CLIENT URL）をCATSクリックURLに置換
    # bodies内のリンクを置換
    tracked_urls = [u for u in unique_urls if 'answered-official' in u or 'l-ad.net' in u]
    if tracked_urls:
        print(f'\n=== リンク置換 ===')
        print(f'  置換先: {CATS_CLICK_URL}')
        for old_url in tracked_urls:
            print(f'  {old_url} → CATS')

        # PATCH /articles/{ver_id}/bodies でリンク置換
        new_body_str = body_str
        for old_url in tracked_urls:
            new_body_str = new_body_str.replace(old_url, CATS_CLICK_URL)

        new_bodies = json.loads(new_body_str)

        result = page.evaluate(f'''async () => {{
            const r = await fetch('https://api.squadbeyond.com/api/v1/articles/{ver_id}/bodies', {{
                method: 'PATCH',
                credentials: 'include',
                headers: {{'Content-Type': 'application/json'}},
                body: JSON.stringify({{bodies: {json.dumps(new_bodies)}}})
            }});
            return {{status: r.status, text: (await r.text()).substring(0, 200)}};
        }}''')
        print(f'  PATCH result: status={result["status"]}')

        if result["status"] == 200:
            # 反映(公開)
            reflect = page.evaluate(f'''async () => {{
                const r = await fetch('https://api.squadbeyond.com/api/v1/articles/{versions[0]["uid"]}/reflections', {{
                    method: 'PATCH',
                    credentials: 'include',
                    headers: {{'Content-Type': 'application/json'}},
                    body: '{{}}'
                }});
                return {{status: r.status, text: (await r.text()).substring(0, 200)}};
            }}''')
            print(f'  Reflect: status={reflect["status"]}')
            print('  ✅ CATSクリックURL設置完了')
        else:
            print(f'  ❌ 置換失敗: {result["text"]}')
    else:
        print('\n置換対象リンクなし。手動でCTAリンクを設定してください。')

    ctx.close()
