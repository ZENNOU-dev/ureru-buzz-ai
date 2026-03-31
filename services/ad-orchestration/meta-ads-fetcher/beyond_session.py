"""Beyond セッション管理 - 全自動化スクリプト共通.

使い方:
    with BeyondSession() as session:
        page = session.page
        session.navigate("/ab_tests/slug/articles")
        # 操作...

特徴:
- persistent context でブラウザ状態を保持
- セッション切れを検知して自動再ログイン
- navigate() は sign_in リダイレクトを検知してリトライ
- ensure_session() でいつでもセッション有効性を確認可能
"""
import os
import time
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, BrowserContext, Page

load_dotenv()

SB_EMAIL = os.getenv("SQUAD_BEYOND_EMAIL")
SB_PASS = os.getenv("SQUAD_BEYOND_PASSWORD")
BROWSER_DIR = os.path.expanduser("~/.squad-beyond-browser")
BASE_URL = "https://app.squadbeyond.com"
API_URL = "https://api.squadbeyond.com"
TEAM_MAP = {
    499: {"name": "ブリーチ", "uid": "8910ebea-6839-4392-8340-b19f8a671584"},
    682: {"name": "BONNOU", "uid": "b91b2a65-3339-4609-8f95-e47f922425ad"},
}
DEFAULT_TEAM_ID = 499  # ブリーチ


class BeyondSession:
    """セッション管理付きBeyondブラウザ."""

    def __init__(self, headless=False, team_id: int = None):
        self.headless = headless
        self.team_id = team_id or DEFAULT_TEAM_ID
        self.team_info = TEAM_MAP.get(self.team_id, TEAM_MAP[DEFAULT_TEAM_ID])
        self._pw = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None

    def __enter__(self):
        self._pw = sync_playwright().start()
        self._context = self._pw.chromium.launch_persistent_context(
            user_data_dir=BROWSER_DIR, channel="chrome", headless=self.headless,
            viewport={"width": 1920, "height": 1080}, locale="ja-JP",
            args=["--disable-blink-features=AutomationControlled"],
            ignore_default_args=["--enable-automation"],
        )
        self._page = self._context.pages[0] if self._context.pages else self._context.new_page()
        self._ensure_logged_in()
        return self

    def __exit__(self, *args):
        if self._context:
            self._context.close()
        if self._pw:
            self._pw.stop()

    @property
    def page(self) -> Page:
        return self._page

    # ── セッション確認 ──────────────────────────
    def _check_session(self) -> bool:
        """APIでセッション有効性を確認. 対象チームIDならTrue."""
        r = self._page.evaluate(f"""async () => {{
            try {{
                const r = await fetch("{API_URL}/api/v1/teams/member",
                    {{credentials: "include"}});
                if (r.ok) return await r.json();
                return {{error: r.status}};
            }} catch(e) {{ return {{error: e.message}}; }}
        }}""")
        if isinstance(r, dict):
            team = (r.get("team") or {}).get("id")
            return team == self.team_id
        return False

    def _login(self):
        """メール/パスワードでログイン → ブリーチチーム選択."""
        self._page.goto(f"{BASE_URL}/sign_in")
        self._page.wait_for_load_state("networkidle")
        time.sleep(3)

        # チーム選択ページにいる場合はログインスキップ
        if "/users/teams" in self._page.url:
            self._select_team()
            return

        pw = self._page.locator('input[name="password"]')
        if pw.count() > 0:
            self._page.fill('input[name="email"]', SB_EMAIL)
            self._page.fill('input[name="password"]', SB_PASS)
            time.sleep(1)
            self._page.click('button[type="submit"]')
            self._page.wait_for_load_state("networkidle")
            time.sleep(8)

        self._select_team()

    def _select_team(self):
        """対象チームのログインボタンをクリック. team_idに応じて動的選択."""
        team_name = self.team_info["name"]
        # チーム名で判定: ブリーチ→ブリーチ含みBONNOU含まない, BONNOU→BONNOU含む
        structure = self._page.evaluate("""() => {
            const btns = document.querySelectorAll('button');
            const r = []; let idx = 0;
            btns.forEach(b => {
                if (b.innerText.trim() === 'ログイン') {
                    let el = b; let pt = [];
                    for (let i=0;i<2;i++) {
                        el=el.parentElement;
                        if(!el) break;
                        pt.push(el.innerText.replace(/\\n/g,' | ').substring(0,100));
                    }
                    r.push({idx, pt}); idx++;
                }
            });
            return r;
        }""")

        for item in structure:
            for txt in item["pt"]:
                matched = False
                if team_name == "ブリーチ":
                    matched = "ブリーチ" in txt and "BONNOU" not in txt
                elif team_name == "BONNOU":
                    matched = "BONNOU" in txt
                else:
                    matched = team_name in txt

                if matched:
                    self._page.evaluate(f"""() => {{
                        const btns = document.querySelectorAll('button');
                        let idx = 0;
                        btns.forEach(b => {{
                            if(b.innerText.trim()==='ログイン'){{
                                if(idx==={item['idx']}) b.click();
                                idx++;
                            }}
                        }});
                    }}""")
                    self._page.wait_for_load_state("networkidle")
                    time.sleep(8)
                    print(f"team: {team_name} selected")
                    return

    def _ensure_logged_in(self):
        """セッション確認 → 無効なら再ログイン."""
        # まずどこかのページに行く（APIコールにはドメインが必要）
        self._page.goto(f"{BASE_URL}/ab_tests")
        self._page.wait_for_load_state("networkidle")
        time.sleep(3)

        if self._check_session():
            print("session: OK")
            return

        print("session: expired, re-logging in...")
        self._login()

        if self._check_session():
            print("session: restored")
        else:
            raise RuntimeError("Beyond login failed")

    # ── ナビゲーション（セッション切れ自動復帰） ──────
    def navigate(self, path: str, wait_sec: int = 6) -> str:
        """URLに遷移. sign_inにリダイレクトされたら再ログインしてリトライ.

        Args:
            path: /ab_tests/... 形式のパス、またはフルURL
            wait_sec: networkidle後の追加待機秒数
        Returns:
            最終URL
        """
        url = path if path.startswith("http") else f"{BASE_URL}{path}"

        self._page.goto(url)
        self._page.wait_for_load_state("networkidle")
        time.sleep(wait_sec)

        # sign_in にリダイレクトされた = セッション切れ
        if "/sign_in" in self._page.url or "/users/teams" in self._page.url:
            print(f"session: redirected to {self._page.url}, re-logging in...")
            self._login()

            # 元のURLにリトライ
            self._page.goto(url)
            self._page.wait_for_load_state("networkidle")
            time.sleep(wait_sec)

            if "/sign_in" in self._page.url:
                raise RuntimeError(f"Login failed, still at {self._page.url}")

        return self._page.url

    def ensure_session(self) -> bool:
        """操作途中でセッション有効か確認. 切れていれば再ログイン.

        Returns:
            True if session is valid (restored or already valid)
        """
        if self._check_session():
            return True

        print("session: mid-operation expiry detected, re-logging in...")
        current_url = self._page.url
        self._login()

        # 元のページに戻る
        if current_url and "/sign_in" not in current_url:
            self._page.goto(current_url)
            self._page.wait_for_load_state("networkidle")
            time.sleep(5)

        return self._check_session()
