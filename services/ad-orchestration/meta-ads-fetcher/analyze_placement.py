import os, requests, json
from dotenv import load_dotenv; load_dotenv()
token = os.getenv('META_ACCESS_TOKEN')

accounts = [
    ('act_1096025525105152', '0445'),
    ('act_768428308772194', '0456'),
]

for act_id, name in accounts:
    r = requests.get(f'https://graph.facebook.com/v22.0/{act_id}/insights', params={
        'access_token': token,
        'fields': 'impressions,spend,actions,cost_per_action_type',
        'breakdowns': 'publisher_platform,platform_position',
        'time_range': json.dumps({'since': '2025-06-01', 'until': '2026-03-20'}),
        'level': 'account',
        'limit': 100,
    })
    data = r.json().get('data', [])

    print(f'\n=== {name} placement (account level) ===')
    print(f'{"placement":<45} {"spend":>12} {"CV":>5} {"CPA":>10} {"pct":>6}')
    print('-' * 85)

    rows = []
    for d in data:
        p = d.get("publisher_platform","?") + "/" + d.get("platform_position","?")
        spend = float(d.get('spend', 0))
        cv = 0; cpa = 0
        for a in d.get('actions', []):
            if a.get('action_type') == 'offsite_conversion.fb_pixel_complete_registration':
                cv = int(a.get('value', 0))
        for c in d.get('cost_per_action_type', []):
            if c.get('action_type') == 'offsite_conversion.fb_pixel_complete_registration':
                cpa = float(c.get('value', 0))
        rows.append({'p': p, 'spend': spend, 'cv': cv, 'cpa': cpa})

    rows.sort(key=lambda x: x['spend'], reverse=True)
    total_spend = sum(r['spend'] for r in rows)
    total_cv = sum(r['cv'] for r in rows)

    for row in rows:
        pct = (row['spend'] / total_spend * 100) if total_spend > 0 else 0
        cs = f"{row['cpa']:,.0f}" if row['cpa'] > 0 else '-'
        print(f"{row['p']:<45} {int(row['spend']):>12,} {row['cv']:>5} {cs:>10} {pct:>5.1f}%")

    avg_cpa = total_spend / total_cv if total_cv > 0 else 0
    print(f"{'TOTAL':<45} {int(total_spend):>12,} {total_cv:>5} {int(avg_cpa):>10,}")

    # Gender
    r2 = requests.get(f'https://graph.facebook.com/v22.0/{act_id}/insights', params={
        'access_token': token,
        'fields': 'impressions,spend,actions,cost_per_action_type',
        'breakdowns': 'gender',
        'time_range': json.dumps({'since': '2025-06-01', 'until': '2026-03-20'}),
        'level': 'account',
        'limit': 100,
    })
    print(f'\n  Gender:')
    for d in r2.json().get('data', []):
        g = d.get('gender','?')
        spend = float(d.get('spend',0))
        cv = 0; cpa = 0
        for a in d.get('actions',[]):
            if a.get('action_type') == 'offsite_conversion.fb_pixel_complete_registration':
                cv = int(a.get('value',0))
        for c in d.get('cost_per_action_type',[]):
            if c.get('action_type') == 'offsite_conversion.fb_pixel_complete_registration':
                cpa = float(c.get('value',0))
        cs = f"{cpa:,.0f}" if cpa > 0 else '-'
        pct = spend / total_spend * 100 if total_spend > 0 else 0
        print(f"    {g:<10} {int(spend):>12,} ({pct:>5.1f}%)  CV:{cv:>4}  CPA:{cs}")
