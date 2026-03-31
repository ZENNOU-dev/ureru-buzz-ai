"""Beyond: 記事LPのリンク置換（案件対応版）

記事LP内のCTAリンクを新しいCATSクリックURLに置換する。
案件ごとのBeyondチーム（ブリーチ/BONNOU）に自動切替。

使い方:
    # 案件名指定（cats_project_configからチーム自動判定）
    python3 beyond_link_replace.py --project アンサード --slug tAhFVYTqbSdNHM_rQ --url "https://bnn.ac01.l-ad.net/cl/..."

    # チームID直接指定
    python3 beyond_link_replace.py --team 682 --slug tAhFVYTqbSdNHM_rQ --url "https://bnn.ac01.l-ad.net/cl/..."

    # DB連携（article_lpsとcats_contentsから自動解決）
    python3 beyond_link_replace.py --project アンサード --article-lp-id 6 --cats-content-id 4487
"""
import os
import sys
import json
import time
import argparse
from dotenv import load_dotenv
from beyond_session import BeyondSession

load_dotenv()


def get_team_id_for_project(project_name: str) -> int:
    """cats_project_configからBeyondチームIDを取得."""
    from supabase import create_client
    sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

    proj = sb.table("projects").select("id").eq("name", project_name).limit(1).execute()
    if not proj.data:
        raise ValueError(f"Project '{project_name}' not found")
    project_id = proj.data[0]["id"]

    cfg = (sb.table("cats_project_config")
           .select("beyond_team_id")
           .eq("project_id", project_id)
           .eq("platform", "Meta")
           .limit(1).execute())
    if cfg.data and cfg.data[0].get("beyond_team_id"):
        return cfg.data[0]["beyond_team_id"]

    return 499  # デフォルト: ブリーチ


def resolve_urls_from_db(article_lp_id: int = None, cats_content_id: int = None) -> dict:
    """DBからslugとCATSクリックURLを解決."""
    from supabase import create_client
    sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

    result = {}
    if article_lp_id:
        lp = sb.table("article_lps").select("beyond_page_id").eq("id", article_lp_id).single().execute()
        result["slug"] = lp.data["beyond_page_id"]

    if cats_content_id:
        cats = sb.table("cats_contents").select("redirect_url").eq("cats_content_id", cats_content_id).single().execute()
        result["url"] = cats.data["redirect_url"]

    return result


def replace_links(slug: str, new_url: str, team_id: int = 499) -> bool:
    """Beyond記事LPのリンクを置換.

    フロー:
      1. BeyondSession開始（チーム自動選択）
      2. エディタページに遷移
      3. 「リンク置換」ダイアログを開く
      4. 「計測あり」フィルタ → 「全て選択」
      5. 新URLを入力 → 「置換」
      6. 「更新」で保存
    """
    with BeyondSession(team_id=team_id) as session:
        page = session.page

        session.navigate(f"/ab_tests/{slug}/articles", wait_sec=8)
        print(f"Editor: {slug} (team={team_id})")

        # 権限引き継ぎダイアログが出たら承認
        try:
            inherit_btn = page.locator('button:has-text("引き継ぎして編集する")')
            if inherit_btn.count() > 0:
                inherit_btn.click()
                time.sleep(3)
                print("  権限引き継ぎ: OK")
        except Exception:
            pass

        # 開いているパネルを閉じる
        page.keyboard.press("Escape")
        time.sleep(1)

        # Step 1: リンク置換トリガーをクリック
        trigger_pos = page.evaluate("""() => {
            const icons = document.querySelectorAll('[class*="sideToolbarIcon"]');
            for (const icon of icons) {
                if (icon.textContent.includes('リンク置換')) {
                    const triggers = icon.querySelectorAll('[class*="trigger"]');
                    for (const t of triggers) {
                        const rect = t.getBoundingClientRect();
                        if (rect.width > 0)
                            return {x: rect.x + rect.width/2, y: rect.y + rect.height/2};
                    }
                    const rect = icon.getBoundingClientRect();
                    return {x: rect.x + rect.width/2, y: rect.y + rect.height/2};
                }
            }
            return null;
        }""")

        if not trigger_pos:
            print("  Link replace icon not found")
            return False

        page.mouse.click(trigger_pos["x"], trigger_pos["y"])
        time.sleep(3)

        opened = page.evaluate("""() => {
            const t = document.body.innerText;
            return t.includes('計測あり') && t.includes('Version内リンク');
        }""")
        if not opened:
            page.mouse.click(trigger_pos["x"], trigger_pos["y"])
            time.sleep(3)
            opened = page.evaluate("() => document.body.innerText.includes('計測あり')")

        if not opened:
            print("  Failed to open link dialog")
            return False
        print("  Link dialog opened")

        # Step 2: 計測あり → 全て選択 → URL入力
        page.evaluate("""() => {
            document.querySelectorAll('div, span').forEach(el => {
                if (el.textContent.trim() === '計測あり' && el.children.length === 0) el.click();
            });
        }""")
        time.sleep(1)

        page.evaluate("""() => {
            document.querySelectorAll('div, span').forEach(el => {
                if (el.textContent.trim() === '全て選択' && el.children.length === 0) el.click();
            });
        }""")
        time.sleep(1)

        page.evaluate(f"""() => {{
            const inputs = document.querySelectorAll('input');
            for (const inp of inputs) {{
                const ph = inp.placeholder || '';
                if (ph.includes('リンク') || ph.includes('入力')) {{
                    const setter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype, 'value').set;
                    setter.call(inp, '{new_url}');
                    inp.dispatchEvent(new Event('input', {{bubbles: true}}));
                    inp.dispatchEvent(new Event('change', {{bubbles: true}}));
                    return true;
                }}
            }}
        }}""")
        time.sleep(1)
        print(f"  URL set: {new_url[:60]}...")

        # Step 3: 置換ボタン
        pos = page.evaluate("""() => {
            const candidates = [];
            document.querySelectorAll('div, span, button').forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width < 20 || rect.width > 150 || rect.x < 400) return;
                const directText = Array.from(el.childNodes)
                    .filter(n => n.nodeType === 3)
                    .map(n => n.textContent.trim()).join('');
                const fullText = el.textContent.trim();
                if (directText === '置換' || (fullText === '置換' && el.children.length <= 2)) {
                    candidates.push({x: rect.x + rect.width/2, y: rect.y + rect.height/2, w: rect.width});
                }
            });
            candidates.sort((a,b) => a.w - b.w);
            return candidates[0] || null;
        }""")

        if not pos:
            print("  置換 button not found")
            return False

        page.mouse.click(pos["x"], pos["y"])
        time.sleep(4)
        print("  置換 clicked")

        # Step 4: ダイアログを閉じる → 更新
        page.keyboard.press("Escape")
        time.sleep(2)

        print("  Waiting for 更新...")
        for i in range(60):
            info = page.evaluate("""() => {
                const btns = document.querySelectorAll('button');
                for (const b of btns) {
                    if (b.innerText.trim() === '更新') {
                        const r = b.getBoundingClientRect();
                        const bg = getComputedStyle(b).backgroundColor;
                        return {disabled: b.disabled, x: r.x+r.width/2, y: r.y+r.height/2, bg};
                    }
                }
            }""")
            if info and (not info["disabled"] or "rgb(255" in info.get("bg", "")):
                page.mouse.click(info["x"], info["y"])
                time.sleep(5)
                print(f"  更新 saved! ({i}s)")

                # 検証: bidが変わったか確認
                ver_list = page.evaluate(f"""async () => {{
                    const r = await fetch('https://api.squadbeyond.com/api/v1/ab_tests/{slug}/articles', {{credentials:'include'}});
                    return await r.json();
                }}""")
                if isinstance(ver_list, list) and ver_list:
                    uid = ver_list[0].get("uid", "")
                    body = page.evaluate(f"""async () => {{
                        const r = await fetch('https://api.squadbeyond.com/api/v1/articles/{uid}/bodies', {{credentials:'include'}});
                        return await r.text();
                    }}""")
                    has_new = new_url.split("bid=")[1][:10] in body if "bid=" in new_url else new_url[:30] in body
                    print(f"  Verified: new URL present = {has_new}")
                return True
            time.sleep(1)

        print("  更新 timeout")
        return False


def main():
    parser = argparse.ArgumentParser(description="Beyond記事LPリンク置換")
    parser.add_argument("--project", help="案件名 (cats_project_configからチーム判定)")
    parser.add_argument("--team", type=int, help="BeyondチームID (499=ブリーチ, 682=BONNOU)")
    parser.add_argument("--slug", help="Beyond記事LP slug")
    parser.add_argument("--url", help="新しいCATSクリックURL")
    parser.add_argument("--article-lp-id", type=int, help="article_lps.id (slugをDBから解決)")
    parser.add_argument("--cats-content-id", type=int, help="cats_contents.id (URLをDBから解決)")
    args = parser.parse_args()

    # チームID解決
    team_id = args.team
    if not team_id and args.project:
        team_id = get_team_id_for_project(args.project)
    team_id = team_id or 499

    # slug/URL解決
    slug = args.slug
    new_url = args.url

    if args.article_lp_id or args.cats_content_id:
        db_info = resolve_urls_from_db(args.article_lp_id, args.cats_content_id)
        slug = slug or db_info.get("slug")
        new_url = new_url or db_info.get("url")

    if not slug or not new_url:
        parser.error("--slug と --url (または --article-lp-id + --cats-content-id) が必要です")

    print(f"=== Beyond Link Replace ===")
    print(f"  Project: {args.project or 'N/A'}")
    print(f"  Team: {team_id}")
    print(f"  Slug: {slug}")
    print(f"  URL: {new_url}")

    ok = replace_links(slug, new_url, team_id)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
