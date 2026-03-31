import os, json
from dotenv import load_dotenv
load_dotenv('/Users/yumhahada/ad-orchestration/meta-ads-fetcher/.env')
from supabase import create_client
sb = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

PROJECT_ID = 14  # REDEN

# === 1. client_codes 登録 ===
print('=== client_codes ===')
client_codes = [
    {"code_name": "mcl_hairspray_2980_meta_bon001", "base_url": "https://re-den.com/lp?u=mcl_hairspray_2980_meta_bon001"},
    {"code_name": "mcl_hairspray_2980_meta_bon002", "base_url": "https://re-den.com/lp?u=mcl_hairspray_2980_meta_bon002"},
    {"code_name": "mcl_hairspray_2980_meta_bon003", "base_url": "https://re-den.com/lp?u=mcl_hairspray_2980_meta_bon003"},
    {"code_name": "mcl_supple_2504_meta_bon001", "base_url": "https://re-den.com/lp?u=mcl_supple_2504_meta_bon001"},
    {"code_name": "mcl_supple_2504_meta_bon002", "base_url": "https://re-den.com/lp?u=mcl_supple_2504_meta_bon002"},
    {"code_name": "mcl_supple_2504_meta_bon003", "base_url": "https://re-den.com/lp?u=mcl_supple_2504_meta_bon003"},
    {"code_name": "mcl_supple_2504_meta_bon004", "base_url": "https://re-den.com/lp?u=mcl_supple_2504_meta_bon004"},
    {"code_name": "mcl_supple_2504_meta_bon005", "base_url": "https://re-den.com/lp?u=mcl_supple_2504_meta_bon005"},
    {"code_name": "mcl_supple_2504_meta_bon006", "base_url": "https://re-den.com/lp?u=mcl_supple_2504_meta_bon006"},
    {"code_name": "mcl_supple_2504_meta_bon007", "base_url": "https://re-den.com/lp?u=mcl_supple_2504_meta_bon007"},
    {"code_name": "mcl_supple_2504_meta_bon008", "base_url": "https://re-den.com/lp?u=mcl_supple_2504_meta_bon008"},
    {"code_name": "mcl_supple_2504_meta_bon009", "base_url": "https://re-den.com/lp?u=mcl_supple_2504_meta_bon009"},
    {"code_name": "mcl_supple_2504_meta_bon010", "base_url": "https://re-den.com/lp?u=mcl_supple_2504_meta_bon010"},
]

code_id_map = {}
for cc in client_codes:
    existing = sb.table('client_codes').select('id').eq('code_name', cc['code_name']).eq('project_id', PROJECT_ID).execute()
    if existing.data:
        code_id_map[cc['code_name']] = existing.data[0]['id']
        print(f'  EXISTS: {cc["code_name"]} (id={existing.data[0]["id"]})')
    else:
        r = sb.table('client_codes').insert({**cc, 'project_id': PROJECT_ID, 'is_active': True}).execute()
        code_id_map[cc['code_name']] = r.data[0]['id']
        print(f'  INSERT: {cc["code_name"]} (id={r.data[0]["id"]})')

# === 2. article_lps 登録 ===
print('\n=== article_lps ===')
lps_data = [
    {
        "lp_name": "若年予防訴求_実写_3点セット",
        "base_url": "https://sb-redencampaign.ourpage.jp/ab/kSMsdGbKRADiTjCXvA",
        "beyond_page_id": "kSMsdGbKRADiTjCXvA",
        "beyond_team": "BONNOU",
        "appeal_name": "若年予防",
        "expression_type": "実写",
        "description": "3点セット",
        "cc_name": None,  # 若年予防のCATS名未指定 → 後で紐づけ
    },
    {
        "lp_name": "若年改善訴求_実写_3点セット",
        "base_url": "https://sb-redencampaign.ourpage.jp/ab/lmLyDsgloyCsEFAso-Hg",
        "beyond_page_id": "lmLyDsgloyCsEFAso-Hg",
        "beyond_team": "BONNOU",
        "appeal_name": "若年改善",
        "expression_type": "実写",
        "description": "3点セット",
        "cc_name": "mcl_supple_2504_meta_bon006",
    },
    {
        "lp_name": "若年改善訴求_実写_スプレーセット",
        "base_url": "https://sb-redencampaign.ourpage.jp/ab/ZrePvhMyPpQG_orUmw",
        "beyond_page_id": "ZrePvhMyPpQG_orUmw",
        "beyond_team": "BONNOU",
        "appeal_name": "若年改善",
        "expression_type": "実写",
        "description": "スプレーセット",
        "cc_name": "mcl_hairspray_2980_meta_bon001",
    },
    {
        "lp_name": "男性ホルモン訴求_実写_3点セット",
        "base_url": "https://sb-redencampaign.ourpage.jp/ab/NWO_jBYxBanENIAOcw",
        "beyond_page_id": "NWO_jBYxBanENIAOcw",
        "beyond_team": "BONNOU",
        "appeal_name": "男性ホルモン",
        "expression_type": "実写",
        "description": "3点セット",
        "cc_name": "mcl_supple_2504_meta_bon010",
    },
]

lp_id_map = {}
for lp in lps_data:
    cc_name = lp.pop('cc_name', None)
    client_code_id = code_id_map.get(cc_name) if cc_name else None

    insert_data = {
        'project_id': PROJECT_ID,
        'lp_name': lp['lp_name'],
        'base_url': lp['base_url'],
        'beyond_page_id': lp['beyond_page_id'],
        'beyond_team': lp['beyond_team'],
        'appeal_name': lp['appeal_name'],
        'expression_type': lp['expression_type'],
        'description': lp['description'],
        'client_code_id': client_code_id,
        'status': 'active',
        'is_active': True,
    }

    existing = sb.table('article_lps').select('id').eq('beyond_page_id', lp['beyond_page_id']).eq('project_id', PROJECT_ID).execute()
    if existing.data:
        lp_id_map[lp['beyond_page_id']] = existing.data[0]['id']
        print(f'  EXISTS: {lp["lp_name"]} (id={existing.data[0]["id"]})')
    else:
        r = sb.table('article_lps').insert(insert_data).execute()
        lp_id_map[lp['beyond_page_id']] = r.data[0]['id']
        print(f'  INSERT: {lp["lp_name"]} (id={r.data[0]["id"]})')

# === 3. link_urls 登録（Meta入稿用 = 記事LP直接URL）===
print('\n=== link_urls ===')
for lp in lps_data:
    url = lp['base_url']
    name = f"REDEN_{lp['lp_name']}"

    existing = sb.table('link_urls').select('id').eq('url', url).eq('project_id', PROJECT_ID).execute()
    if existing.data:
        print(f'  EXISTS: {name} (id={existing.data[0]["id"]})')
    else:
        r = sb.table('link_urls').insert({
            'project_id': PROJECT_ID,
            'name': name,
            'url': url,
            'url_type': 'direct',
            'description': '記事LP直接入稿。CTAリンクにCATS設置',
            'is_active': True,
        }).execute()
        print(f'  INSERT: {name} (id={r.data[0]["id"]})')

print('\n=== 完了 ===')
print(f'client_codes: {len(code_id_map)} 件')
print(f'article_lps: {len(lp_id_map)} 件')
