"""Debug 500 error on duplication API - isolate each factor."""

import os
import time
import json
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()
SB_EMAIL = os.getenv("SQUAD_BEYOND_EMAIL")
SB_PASS = os.getenv("SQUAD_BEYOND_PASSWORD")
BROWSER_DIR = os.path.expanduser("~/.squad-beyond-browser")


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

        # Check if already logged in
        page.goto(f"https://app.squadbeyond.com/ab_tests/{uid}/articles")
        time.sleep(5)

        # Test 1: Basic session check
        print("=== Test 1: Session check ===")
        r1 = page.evaluate("""async () => {
            const r = await fetch("https://api.squadbeyond.com/api/v1/teams/member", {credentials: "include"});
            return {status: r.status, data: await r.json()};
        }""")
        print(f"  teams/member: {r1['status']}")
        if r1["status"] == 200:
            team = r1["data"].get("team", {})
            print(f"  team: {team.get('name')} (id={team.get('id')})")
        else:
            print(f"  Need to login first!")
            context.close()
            return

        # Test 2: Version list
        print("\n=== Test 2: Version list ===")
        r2 = page.evaluate(f"""async () => {{
            const r = await fetch("https://api.squadbeyond.com/api/v1/ab_tests/{uid}/articles", {{credentials: "include"}});
            return {{status: r.status, data: await r.json()}};
        }}""")
        print(f"  articles: {r2['status']}")
        source_id = None
        if r2["status"] == 200:
            arts = r2["data"]
            for a in arts:
                print(f"    id={a['id']} uid={a.get('uid','')} memo={a.get('memo','')}")
                if a.get("memo") == "02aq":
                    source_id = a["id"]

        if not source_id:
            print("  02aq not found")
            context.close()
            return

        # Test 3: Try duplication with different approaches
        print(f"\n=== Test 3: Duplication (source_id={source_id}) ===")

        # 3a: api.squadbeyond.com with POST
        print("\n  3a: api.squadbeyond.com POST /articles/{id}/duplications")
        r3a = page.evaluate(f"""async () => {{
            const r = await fetch("https://api.squadbeyond.com/api/v1/articles/{source_id}/duplications", {{
                method: "POST",
                credentials: "include",
                headers: {{"Content-Type": "application/json"}}
            }});
            const text = await r.text();
            return {{status: r.status, body: text.substring(0, 500)}};
        }}""")
        print(f"    status={r3a['status']} body={r3a['body'][:200]}")

        # 3b: with locale param
        print("\n  3b: with locale=ja param")
        r3b = page.evaluate(f"""async () => {{
            const r = await fetch("https://api.squadbeyond.com/api/v1/articles/{source_id}/duplications?locale=ja", {{
                method: "POST",
                credentials: "include",
                headers: {{"Content-Type": "application/json"}}
            }});
            const text = await r.text();
            return {{status: r.status, body: text.substring(0, 500)}};
        }}""")
        print(f"    status={r3b['status']} body={r3b['body'][:200]}")

        # 3c: with empty body
        print("\n  3c: with empty JSON body")
        r3c = page.evaluate(f"""async () => {{
            const r = await fetch("https://api.squadbeyond.com/api/v1/articles/{source_id}/duplications", {{
                method: "POST",
                credentials: "include",
                headers: {{"Content-Type": "application/json"}},
                body: "{{}}"
            }});
            const text = await r.text();
            return {{status: r.status, body: text.substring(0, 500)}};
        }}""")
        print(f"    status={r3c['status']} body={r3c['body'][:200]}")

        # 3d: app.squadbeyond.com domain
        print("\n  3d: app.squadbeyond.com domain")
        r3d = page.evaluate(f"""async () => {{
            const r = await fetch("/api/v1/articles/{source_id}/duplications", {{
                method: "POST",
                credentials: "include",
                headers: {{"Content-Type": "application/json"}}
            }});
            const text = await r.text();
            return {{status: r.status, body: text.substring(0, 500)}};
        }}""")
        print(f"    status={r3d['status']} body={r3d['body'][:200]}")

        # 3e: Check headers that the SPA sends - look at referer etc
        print("\n  3e: with Referer and X-Requested-With")
        r3e = page.evaluate(f"""async () => {{
            const r = await fetch("https://api.squadbeyond.com/api/v1/articles/{source_id}/duplications", {{
                method: "POST",
                credentials: "include",
                headers: {{
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": "https://app.squadbeyond.com/ab_tests/{uid}/articles"
                }}
            }});
            const text = await r.text();
            return {{status: r.status, body: text.substring(0, 500)}};
        }}""")
        print(f"    status={r3e['status']} body={r3e['body'][:200]}")

        context.close()
        print("\n=== Done ===")


if __name__ == "__main__":
    main()
