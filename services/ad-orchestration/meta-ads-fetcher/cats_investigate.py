"""Investigate CATS form structure using Playwright.

Logs in, navigates to content registration form, and dumps all
select options + form fields for automation planning.
"""

import os
import json
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()

CATS_URL = os.getenv("CATS_LOGIN_URL", "https://bonnou.admin01.l-ad.net/admin/")
CATS_USER = os.getenv("CATS_USERNAME")
CATS_PASS = os.getenv("CATS_PASSWORD")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Login
        print("=== Logging in to CATS ===")
        page.goto(CATS_URL)
        page.wait_for_load_state("networkidle")

        # Check if login form exists
        login_form = page.query_selector("input[name='loginId']")
        if login_form:
            page.fill("input[name='loginId']", CATS_USER)
            page.fill("input[name='password']", CATS_PASS)
            page.click("input[type='submit'], button[type='submit']")
            page.wait_for_load_state("networkidle")
            print(f"Logged in. Current URL: {page.url}")
        else:
            print(f"No login form found. Current URL: {page.url}")

        # 2. Navigate to content registration
        print("\n=== Navigating to content registration ===")
        page.goto(CATS_URL + "content/register")
        page.wait_for_load_state("networkidle")
        print(f"URL: {page.url}")

        # 3. Dump all select elements and their options
        print("\n=== SELECT elements ===")
        selects = page.query_selector_all("select")
        for sel in selects:
            name = sel.get_attribute("name") or sel.get_attribute("id") or "unknown"
            options = sel.query_selector_all("option")
            opt_list = []
            for opt in options:
                val = opt.get_attribute("value") or ""
                text = opt.inner_text().strip()
                if val:
                    opt_list.append({"value": val, "text": text})
            print(f"\n  [{name}] ({len(opt_list)} options)")
            for o in opt_list[:20]:  # Limit output
                print(f"    value={o['value']:10s} text={o['text']}")
            if len(opt_list) > 20:
                print(f"    ... +{len(opt_list)-20} more")

        # 4. Dump all input elements
        print("\n=== INPUT elements ===")
        inputs = page.query_selector_all("input")
        for inp in inputs:
            name = inp.get_attribute("name") or ""
            typ = inp.get_attribute("type") or "text"
            val = inp.get_attribute("value") or ""
            if name:
                print(f"  name={name:40s} type={typ:10s} value={val}")

        # 5. Dump all textarea elements
        print("\n=== TEXTAREA elements ===")
        textareas = page.query_selector_all("textarea")
        for ta in textareas:
            name = ta.get_attribute("name") or ""
            if name:
                print(f"  name={name}")

        # 6. Check click URL list page structure
        print("\n\n=== Navigating to click URL list ===")
        page.goto(CATS_URL + "clicktag/list")
        page.wait_for_load_state("networkidle")
        print(f"URL: {page.url}")

        # Dump filter selects
        selects = page.query_selector_all("select")
        for sel in selects:
            name = sel.get_attribute("name") or sel.get_attribute("id") or "unknown"
            options = sel.query_selector_all("option")
            opt_list = []
            for opt in options:
                val = opt.get_attribute("value") or ""
                text = opt.inner_text().strip()
                if val:
                    opt_list.append({"value": val, "text": text})
            print(f"\n  [{name}] ({len(opt_list)} options)")
            for o in opt_list[:20]:
                print(f"    value={o['value']:10s} text={o['text']}")

        # 7. Check middle click URL list
        print("\n\n=== Navigating to middle click URL list ===")
        page.goto(CATS_URL + "middleclicktag/list")
        page.wait_for_load_state("networkidle")
        print(f"URL: {page.url}")

        selects = page.query_selector_all("select")
        for sel in selects:
            name = sel.get_attribute("name") or sel.get_attribute("id") or "unknown"
            options = sel.query_selector_all("option")
            opt_list = []
            for opt in options:
                val = opt.get_attribute("value") or ""
                text = opt.inner_text().strip()
                if val:
                    opt_list.append({"value": val, "text": text})
            print(f"\n  [{name}] ({len(opt_list)} options)")
            for o in opt_list[:20]:
                print(f"    value={o['value']:10s} text={o['text']}")

        browser.close()
        print("\n=== Investigation complete ===")


if __name__ == "__main__":
    main()
