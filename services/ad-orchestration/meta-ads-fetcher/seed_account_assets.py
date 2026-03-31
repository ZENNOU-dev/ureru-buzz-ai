"""Seed account_assets from spreadsheet data.

Maps FB pages, pixels, and IG accounts to ad_accounts.
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


def get_client():
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))


# --- Spreadsheet data: ページ/ピクセル/インスタグラムID ---

PAGES = [
    ("Hair Revive Hub", "189185400935331", "17841462976677873"),
    ("美肌Buzz", "117069391487740", "17841461397448106"),
    ("オトナ美容lab", "172687945921997", "17841462950360607"),
    ("Beautiful hair lab", "164554196733526", "17841462868457759"),
    ("ウェブフリ", "100546495665297", "17841448695312873"),
    ("Regainｰsuppli", "295030608030960", "17841410775496565"),
    ("BULK HOMME - バルクオム", "425231097562213", "17841402371699572"),
    ("Medulla（メデュラ）", "111339984059890", "17841443409586791"),
    ("MEDULLA（メデュラ）", "952332371613722", "17841407955342770"),
    ("オトナ美容_lab", "103873529468110", "17841461312023730"),
    ("Health support", "107682485772636", "17841462390212602"),
    ("Beauty Channel", "205463189324878", "17841464546432819"),
    ("Healthy life lab", "754068734462715", "17841476707493524"),
    ("Beauty Buzz", "196467126885071", "17841464234112864"),
    ("Dioclinic01", "202674329590222", "17841463172126899"),
    ("Dioclinic", "173317199198121", "17841463247299620"),
    ("White lab", "186894981164950", "17841463194018954"),
    ("Skin care lab", "146388158565929", "17841462184504658"),
    ("Beauty hair lab", "145262152011359", "17841463060398832"),
    ("Marketing learner", "100546495665297", None),  # ID unknown, using placeholder
    ("坂本 健太", None, None),  # ID unknown
    ("株式会社myuuu", None, None),  # ID unknown
    ("SMUUL", None, None),  # ID unknown
]

PIXELS = [
    ("REDEN(2980オファー)", "1279964516707439"),
    ("Metaラココ_API", "1013172150718931"),
    ("medulla_API", "1041804361407737"),
    ("リゲイントリプルフォースのピクセル", "217560280114781"),
    ("ウェブフリ⑨_働き方2", "666021795603237"),
    ("BULK HOMME_HC980_FF定期", "1883724072068431"),
    ("▼MEDULLA_ecfピクセル", "1767762197077920"),
    ("STLASSH_API", "734293579436400"),
    ("FB_株式会社クリア/Anchorのピクセル", "792828804874084"),
    ("ストラッシュ(stlassh.com)", "3890833507663188"),
    ("リライブシャツα（CATS計測）", "582330424299660"),
    ("メンズクリア_API", "1445396089999684"),
    ("アンサード_API", "1439775190426870"),
    ("バルクオムHC自社（CATS）", "943698767525578"),
    ("キャリドラ/API", "1145288967754545"),
    ("ローコスト_API", "180518734975836"),
    ("DOT-AI CAPI計測", "1278102487666632"),
    ("オリパ堂_API", "1826323084902628"),
    ("BULK HOMME_The Protein", "1417287415852564"),
    ("【BON】SMUUL_resale", None),  # ID unknown
]

IG_ACCOUNTS = [
    ("bulkhomme", "929474450430304"),
    ("regain_suppli", "2827242667316531"),
    (".AI(ドットエーアイ）", "17841479680396126"),
    ("smuul_official", "1421260887923212"),
]

# --- Preset → Account mapping (from 入力プリセット設定 sheet) ---
# account_name → {page_name, pixel_name, ig_name (if any)}

ACCOUNT_ASSET_MAP = {
    "広告アカウント0153_REDEN(2980円オファー)": {
        "pages": ["Hair Revive Hub"],
        "pixels": ["REDEN(2980オファー)"],
    },
    "広告アカウント0457_REDEN②": {
        "pages": ["Hair Revive Hub"],
        "pixels": ["REDEN(2980オファー)"],
    },
    "広告アカウント0087_REDEN": {
        "pages": ["Hair Revive Hub"],
        "pixels": ["REDEN(2980オファー)"],
    },
    "広告アカウント0422_アンサード": {
        "pages": ["Hair Revive Hub"],
        "pixels": ["アンサード_API"],
    },
    "広告アカウント0458_アンサード②": {
        "pages": ["Hair Revive Hub"],
        "pixels": ["アンサード_API"],
    },
    "WF_01_10": {
        "pages": ["ウェブフリ"],
        "pixels": ["ウェブフリ⑨_働き方2"],
    },
    "広告アカウント0025_バルクオムシャンプー": {
        "pages": ["BULK HOMME - バルクオム"],
        "pixels": ["バルクオムHC自社（CATS）"],
    },
    "広告アカウント0046_バルクオム_プロテイン": {
        "pages": ["BULK HOMME - バルクオム"],
        "pixels": ["BULK HOMME_The Protein"],
    },
    "広告アカウント0445_ローコスト": {
        "pages": ["オトナ美容lab"],
        "pixels": ["ローコスト_API"],
    },
    "広告アカウント0456_ローコスト②": {
        "pages": ["オトナ美容lab"],
        "pixels": ["ローコスト_API"],
    },
    "広告アカウント0460_ローコスト③": {
        "pages": ["オトナ美容lab"],
        "pixels": ["ローコスト_API"],
    },
    "広告アカウント0439_キャリドラ": {
        "pages": ["Marketing learner"],
        "pixels": ["キャリドラ/API"],
    },
    "広告アカウント0450_オリパ堂": {
        "pages": ["坂本 健太"],
        "pixels": ["オリパ堂_API"],
    },
    "広告アカウント0446_.AI": {
        "pages": ["株式会社myuuu"],
        "pixels": ["DOT-AI CAPI計測"],
    },
    "広告アカウント0137_イエヤス": {
        "pages": ["SMUUL"],
        "pixels": ["【BON】SMUUL_resale"],
    },
    "広告アカウント0398_STLASSH": {
        "pages": [],
        "pixels": ["STLASSH_API"],
    },
    "広告アカウント0399_メンズクリア": {
        "pages": [],
        "pixels": ["メンズクリア_API"],
    },
    "広告アカウント0410_メンズクリア②": {
        "pages": [],
        "pixels": ["メンズクリア_API"],
    },
    "広告アカウント0302_ラココ": {
        "pages": ["美肌Buzz"],
        "pixels": ["Metaラココ_API"],
    },
    "広告アカウント0379_medulla": {
        "pages": ["Medulla（メデュラ）"],
        "pixels": ["medulla_API"],
    },
    "広告アカウント0324_リゲイン トリプルフォース": {
        "pages": ["Regainｰsuppli"],
        "pixels": ["リゲイントリプルフォースのピクセル"],
    },
    "広告アカウント0154_リライブシャツα": {
        "pages": ["Health support"],
        "pixels": ["リライブシャツα（CATS計測）"],
    },
}

# Build lookup dicts
PAGE_LOOKUP = {name: (meta_id, ig_backing) for name, meta_id, ig_backing in PAGES}
PIXEL_LOOKUP = {name: meta_id for name, meta_id in PIXELS}
IG_LOOKUP = {name: meta_id for name, meta_id in IG_ACCOUNTS}


def seed():
    client = get_client()

    # Get existing ad_accounts
    result = client.table("ad_accounts").select("account_id, account_name").execute()
    accounts = {row["account_name"]: row["account_id"] for row in result.data}

    print(f"Found {len(accounts)} ad_accounts in DB")

    rows_to_insert = []

    for account_name, assets in ACCOUNT_ASSET_MAP.items():
        account_id = accounts.get(account_name)
        if not account_id:
            print(f"  SKIP: account '{account_name}' not found in DB")
            continue

        # FB Pages
        for page_name in assets.get("pages", []):
            page_info = PAGE_LOOKUP.get(page_name)
            if not page_info or not page_info[0]:
                print(f"  SKIP: page '{page_name}' has no meta_asset_id")
                continue
            meta_id, ig_backing = page_info
            rows_to_insert.append({
                "account_id": account_id,
                "asset_type": "facebook_page",
                "asset_name": page_name,
                "meta_asset_id": meta_id,
                "ig_backing_id": ig_backing,
                "is_default": True,
            })

        # Pixels
        for pixel_name in assets.get("pixels", []):
            meta_id = PIXEL_LOOKUP.get(pixel_name)
            if not meta_id:
                print(f"  SKIP: pixel '{pixel_name}' has no meta_asset_id")
                continue
            rows_to_insert.append({
                "account_id": account_id,
                "asset_type": "pixel",
                "asset_name": pixel_name,
                "meta_asset_id": meta_id,
                "is_default": True,
            })

    print(f"\nInserting {len(rows_to_insert)} account_assets...")

    if rows_to_insert:
        result = client.table("account_assets").upsert(
            rows_to_insert,
            on_conflict="account_id,asset_type,meta_asset_id",
        ).execute()
        print(f"Upserted {len(result.data)} rows")

    # Verify
    count = client.table("account_assets").select("id", count="exact").execute()
    print(f"\nTotal account_assets rows: {count.count}")


if __name__ == "__main__":
    seed()
