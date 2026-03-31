"""Beyond Version複製 + パラメータ設定 + アーカイブ 自動化.

ガイド(beyond-duplication-guide.md)のフローに準拠。
UI操作(複製/名前変更/配信割合) + API(パラメータ設定)のハイブリッド。
"""

import sys
import time
from beyond_session import BeyondSession, BASE_URL, API_URL


def get_versions(page, slug):
    """Get version list via API."""
    return page.evaluate(f"""async () => {{
        const r = await fetch("{API_URL}/api/v1/ab_tests/{slug}/articles", {{credentials:"include"}});
        return await r.json();
    }}""")


def select_version(page, memo_name):
    """Select a version by name. Returns True if selected."""
    input_memo = page.locator('input[data-test="ArticleList-InputMemo"]')
    if input_memo.count() > 0 and input_memo.first.input_value() == memo_name:
        return True

    span = page.locator(f'span[data-test="ArticleList-Memo"]:text-is("{memo_name}")')
    if span.count() > 0:
        span.first.click()
        time.sleep(2)
        return True

    container = page.locator('[class*="abTestArticlesLists"]')
    if container.count() > 0:
        for _ in range(10):
            container.first.evaluate("el => el.scrollTop += 200")
            time.sleep(0.3)
            span = page.locator(f'span[data-test="ArticleList-Memo"]:text-is("{memo_name}")')
            if span.count() > 0:
                span.first.click()
                time.sleep(2)
                return True

    return False


def open_version_menu(page):
    """Open the "..." context menu for the currently selected version."""
    page.keyboard.press("Escape")
    time.sleep(0.5)

    ca = page.locator('[data-test="ArticleList-CurrentArticle"]')
    if ca.count() == 0:
        return False
    ca_box = ca.first.bounding_box()
    if not ca_box:
        return False

    input_memo = page.locator('input[data-test="ArticleList-InputMemo"]')
    ref_box = input_memo.first.bounding_box() if input_memo.count() > 0 else ca_box

    # Approach 1: Hover over CurrentArticle to reveal hidden buttons
    hover_points = [
        (ca_box["x"] + ca_box["width"] / 2, ca_box["y"] + 10),
        (ca_box["x"] + 20, ca_box["y"] + 10),
        (ca_box["x"] + ca_box["width"] - 20, ca_box["y"] + 10),
    ]
    for hx, hy in hover_points:
        page.mouse.move(hx, hy)
        time.sleep(0.8)

        btns_in_ca = page.locator('[data-test="ArticleList-CurrentArticle"] button').all()
        for btn in btns_in_ca:
            box = btn.bounding_box()
            if not box or box["width"] > 80:
                continue
            txt = btn.inner_text().strip()
            if txt in ("更新",) or btn.locator('input').count() > 0:
                continue
            btn.click()
            time.sleep(1)
            if _menu_is_open(page):
                return True
            page.keyboard.press("Escape")
            time.sleep(0.3)

    # Approach 2: Broader search near the version area
    page.mouse.move(ca_box["x"] + 20, ca_box["y"] + 5)
    time.sleep(0.8)

    all_btns = page.locator("button:visible").all()
    for btn in all_btns:
        box = btn.bounding_box()
        if not box or box["x"] > 400 or box["width"] > 60:
            continue
        if abs(box["y"] - ca_box["y"]) > 80:
            continue
        txt = btn.inner_text().strip()
        if txt in ("更新", "公開"):
            continue
        btn.click()
        time.sleep(1)
        if _menu_is_open(page):
            return True
        page.keyboard.press("Escape")
        time.sleep(0.3)

    # Approach 3: Coordinate sweep
    sweep_points = [
        (ref_box["x"] + 10, ref_box["y"] - 15),
        (ref_box["x"] + 30, ref_box["y"] - 15),
        (ref_box["x"] + 50, ref_box["y"] - 15),
        (ref_box["x"] + ref_box["width"] + 10, ref_box["y"] + 5),
        (ref_box["x"] + ref_box["width"] + 30, ref_box["y"] + 5),
        (ref_box["x"] + 10, ref_box["y"] + 35),
        (ref_box["x"] + 10, ref_box["y"] + 55),
        (ref_box["x"] + 50, ref_box["y"] + 35),
        (ref_box["x"] - 20, ref_box["y"] + 15),
        (ca_box["x"] + 5, ca_box["y"] + 5),
    ]
    for px, py in sweep_points:
        page.keyboard.press("Escape")
        time.sleep(0.2)
        page.mouse.move(px, py)
        time.sleep(0.5)
        page.mouse.click(px, py)
        time.sleep(0.8)
        if _menu_is_open(page):
            return True

    return False


def _menu_is_open(page):
    """Check if the version context menu is currently visible."""
    for text in ["複製", "アーカイブする"]:
        el = page.get_by_text(text, exact=True)
        if el.count() > 0 and el.first.is_visible():
            return True
    return False


def click_menu_item(page, item_text):
    """Click a menu item by exact text."""
    el = page.get_by_text(item_text, exact=True)
    if el.count() > 0 and el.first.is_visible():
        el.first.click()
        time.sleep(2)
        return True
    return False


def duplicate_version(session: BeyondSession, slug, source_memo, parameter=None):
    """Duplicate a version and optionally set parameter.

    Returns: dict with new version info, or None on failure.
    """
    page = session.page

    # Step 1: Navigate (session-aware)
    session.navigate(f"/ab_tests/{slug}/articles", wait_sec=5)

    # Step 2: Select source
    if not select_version(page, source_memo):
        print(f"  ERROR: '{source_memo}' not found")
        return None
    print(f"  selected: {source_memo}")

    # Step 3: Open menu
    if not open_version_menu(page):
        print("  ERROR: could not open version menu")
        return None

    # Step 4: Click 複製
    dialog_handled = {"accepted": False}

    def handle_dialog(dialog):
        dialog_handled["accepted"] = True
        print(f"  native dialog: '{dialog.message}' → accept")
        dialog.accept()

    page.on("dialog", handle_dialog)

    if not click_menu_item(page, "複製"):
        page.remove_listener("dialog", handle_dialog)
        print("  ERROR: 複製 not found in menu")
        return None

    # Step 5: Confirmation
    time.sleep(2)
    if not dialog_handled["accepted"]:
        confirm = page.get_by_text("複製する", exact=True)
        if confirm.count() > 0 and confirm.first.is_visible():
            confirm.first.click()
            time.sleep(3)

    page.remove_listener("dialog", handle_dialog)

    # Step 6: Get new version ID
    versions = get_versions(page, slug)
    if not versions:
        print("  ERROR: version list empty")
        return None

    new_art = versions[-1]
    new_uid = new_art.get("uid", "")
    new_id = new_art.get("id")
    print(f"  duplicated: id={new_id} uid={new_uid}")

    # Step 7: Weight → 1
    weight = page.locator('[data-test="ArticleList-CurrentArticle"] input[type="number"]')
    if weight.count() > 0:
        weight.first.click(click_count=3)
        weight.first.fill("1")
        weight.first.press("Tab")
        time.sleep(1)
        print("  weight: 1")

    # Step 8: Save
    update_btn = page.locator('button:has-text("更新")')
    if update_btn.count() > 0:
        for _ in range(30):
            if not update_btn.first.is_disabled():
                break
            time.sleep(1)
        if not update_btn.first.is_disabled():
            update_btn.first.click()
            time.sleep(5)
            print("  saved")

    # Step 9: Parameter
    if parameter:
        session.navigate(f"/ab_tests/{slug}/articles/split_test_settings/params", wait_sec=5)
        r = page.evaluate(f"""async () => {{
            const r = await fetch("{API_URL}/api/v1/ab_tests/{slug}/articles/{new_uid}/parameter_allowlists", {{
                method: "POST", credentials: "include",
                headers: {{"Content-Type": "application/json"}},
                body: JSON.stringify({{parameter: "{parameter}"}})
            }});
            return {{status: r.status, data: await r.json()}};
        }}""")
        if r["status"] in (200, 201):
            print(f"  parameter: {parameter}")
        else:
            print(f"  parameter FAILED: {r}")

    return {"id": new_id, "uid": new_uid}


def archive_version(session: BeyondSession, slug, memo_name):
    """Archive a version by name."""
    page = session.page

    session.navigate(f"/ab_tests/{slug}/articles", wait_sec=5)

    if not select_version(page, memo_name):
        print(f"  '{memo_name}' not found - already gone")
        return False

    if not open_version_menu(page):
        print(f"  could not open menu for '{memo_name}'")
        return False

    dialog_handled = {"accepted": False}

    def handle_dialog(dialog):
        dialog_handled["accepted"] = True
        print(f"  dialog: '{dialog.message}' → accept")
        dialog.accept()

    page.on("dialog", handle_dialog)

    el = page.get_by_text("アーカイブする", exact=True)
    if el.count() == 0 or not el.first.is_visible():
        page.remove_listener("dialog", handle_dialog)
        print(f"  'アーカイブする' not found in menu")
        return False
    el.first.click()

    time.sleep(3)
    page.remove_listener("dialog", handle_dialog)

    if dialog_handled["accepted"]:
        print(f"  archived: {memo_name}")
        return True

    versions = get_versions(page, slug)
    still_has = any(v.get("memo") == memo_name for v in versions)
    if not still_has:
        print(f"  '{memo_name}' already archived")
        return True

    print(f"  archive failed for '{memo_name}'")
    return False


def main():
    slug = "lowc-m3-02aq-bonfk00"
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"

    with BeyondSession() as session:
        page = session.page

        print("\n=== Current versions ===")
        versions = get_versions(page, slug)
        for v in versions:
            archived = v.get("archived", False)
            status = " [ARCHIVED]" if archived else ""
            print(f"  {v.get('memo',''):20s} id={v['id']}{status}")

        if mode == "test-menu":
            source = versions[0].get("memo", "") if versions else ""
            session.navigate(f"/ab_tests/{slug}/articles", wait_sec=5)
            if source and select_version(page, source):
                print(f"\n=== Testing menu for '{source}' ===")
                ok = open_version_menu(page)
                print(f"  Menu opened: {ok}")

        elif mode == "archive":
            test_names = sys.argv[2:] if len(sys.argv) > 2 else []
            for name in test_names:
                print(f"\n=== Archiving '{name}' ===")
                archive_version(session, slug, name)


if __name__ == "__main__":
    main()
