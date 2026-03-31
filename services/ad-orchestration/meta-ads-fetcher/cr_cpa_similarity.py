"""
CPA × CR類似度マッピング分析
ローコストプロジェクトのCRについて:
- 各CRのCPAを算出
- CRペア間のコサイン類似度を計算
- 勝ちCR(低CPA)との類似度 vs CPA をプロット
"""
import os, json, sys
import numpy as np
import requests
from dotenv import load_dotenv

load_dotenv()

URL = os.getenv("SUPABASE_URL") + "/rest/v1/"
KEY = os.getenv("SUPABASE_SERVICE_KEY")
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

PROJECT_NAME = "ローコスト"


def fetch_json(endpoint, params=None):
    r = requests.get(URL + endpoint, headers=HEADERS, params=params or {})
    r.raise_for_status()
    return r.json()


def get_project_id():
    res = fetch_json(f"projects?select=id&name=eq.{PROJECT_NAME}")
    return res[0]["id"]


def get_cpa_by_creative(project_id):
    """v_ad_performance から creative 別 CPA を集計"""
    rows = fetch_json(
        f"v_ad_performance?select=creative_id,creative_name,spend,cv"
        f"&project_id=eq.{project_id}&spend=gt.0",
        {"limit": "50000"},
    )
    agg = {}
    for r in rows:
        cid = r.get("creative_id")
        if not cid:
            continue
        if cid not in agg:
            agg[cid] = {"name": r["creative_name"], "spend": 0, "cv": 0}
        agg[cid]["spend"] += r.get("spend") or 0
        agg[cid]["cv"] += r.get("cv") or 0

    result = {}
    for cid, d in agg.items():
        cpa = d["spend"] / d["cv"] if d["cv"] > 0 else None
        result[cid] = {
            "name": d["name"],
            "spend": d["spend"],
            "cv": d["cv"],
            "cpa": cpa,
        }
    return result


def get_embeddings(creative_ids):
    """cr_videos から video_embedding を取得"""
    # Supabase REST API: in filter
    ids_str = ",".join(str(i) for i in creative_ids)
    rows = fetch_json(
        f"cr_videos?select=creative_id,video_embedding"
        f"&creative_id=in.({ids_str})"
        f"&video_embedding=not.is.null",
        {"limit": "1000"},
    )
    result = {}
    for r in rows:
        emb = r.get("video_embedding")
        if emb:
            # pgvector returns as string "[0.1,0.2,...]"
            if isinstance(emb, str):
                emb = json.loads(emb)
            result[r["creative_id"]] = np.array(emb, dtype=np.float32)
    return result


def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


def main():
    print("=" * 60)
    print("CPA × CR類似度マッピング — ローコスト")
    print("=" * 60)

    pid = get_project_id()
    print(f"\nProject ID: {pid}")

    # 1. CPA集計
    print("\n[1] CPA集計中...")
    cpa_data = get_cpa_by_creative(pid)
    print(f"   spend > 0 のCR: {len(cpa_data)}")

    # CV > 0 のCRだけ (CPAが計算できるもの)
    cpa_with_cv = {k: v for k, v in cpa_data.items() if v["cpa"] is not None}
    print(f"   CV > 0 のCR: {len(cpa_with_cv)}")

    # 2. Embedding取得
    print("\n[2] Embedding取得中...")
    embeddings = get_embeddings(list(cpa_with_cv.keys()))
    print(f"   Embedding取得済み: {len(embeddings)}")

    # 3. 両方揃ったCR
    both = sorted(
        [cid for cid in cpa_with_cv if cid in embeddings],
        key=lambda c: cpa_with_cv[c]["cpa"],
    )
    print(f"   CPA + Embedding 両方あるCR: {len(both)}")

    if len(both) < 3:
        print("データ不足。ベクトル化の完了を待ってください。")
        return

    # 4. CPA ランキング表示
    print("\n" + "=" * 60)
    print("CPA ランキング (Top 10 / Bottom 10)")
    print("=" * 60)
    print(f"{'Rank':<5} {'CPA':>10} {'CV':>6} {'Spend':>12} {'CR名'}")
    print("-" * 70)
    for i, cid in enumerate(both[:10], 1):
        d = cpa_with_cv[cid]
        print(f"{i:<5} ¥{d['cpa']:>9,.0f} {d['cv']:>6} ¥{d['spend']:>11,.0f} {d['name'][:40]}")
    print("  ...")
    for i, cid in enumerate(both[-5:], len(both) - 4):
        d = cpa_with_cv[cid]
        print(f"{i:<5} ¥{d['cpa']:>9,.0f} {d['cv']:>6} ¥{d['spend']:>11,.0f} {d['name'][:40]}")

    # 5. 勝ちCR Top-5 の平均embedding
    top5_ids = both[:5]
    top5_emb = np.mean([embeddings[c] for c in top5_ids], axis=0)
    top5_emb /= np.linalg.norm(top5_emb)

    # 6. 全CRの「勝ちCR群との類似度」を計算
    print("\n" + "=" * 60)
    print("勝ちCR Top-5 との類似度 vs CPA")
    print("=" * 60)
    print(f"勝ちCR Top-5: {', '.join(cpa_with_cv[c]['name'][:20] for c in top5_ids)}")
    print()
    print(f"{'類似度':>8} {'CPA':>10} {'CV':>6} {'CR名'}")
    print("-" * 60)

    sim_cpa_pairs = []
    for cid in both:
        sim = cosine_similarity(top5_emb, embeddings[cid])
        d = cpa_with_cv[cid]
        sim_cpa_pairs.append((sim, d["cpa"], d["cv"], d["name"], cid))

    # 類似度降順で表示
    sim_cpa_pairs.sort(key=lambda x: -x[0])
    for sim, cpa, cv, name, cid in sim_cpa_pairs:
        marker = " ★" if cid in top5_ids else ""
        print(f"  {sim:>6.3f} ¥{cpa:>9,.0f} {cv:>6} {name[:40]}{marker}")

    # 7. 相関分析
    sims = np.array([x[0] for x in sim_cpa_pairs])
    cpas = np.array([x[1] for x in sim_cpa_pairs])

    corr = np.corrcoef(sims, cpas)[0, 1]
    print(f"\n{'=' * 60}")
    print(f"相関係数 (類似度 vs CPA): {corr:.4f}")
    if corr < -0.3:
        print("→ 負の相関: 勝ちCRに似ているほどCPAが良い傾向")
    elif corr > 0.3:
        print("→ 正の相関: 勝ちCRに似ているがCPAが悪い（飽和？）")
    else:
        print("→ 弱い相関: 映像的類似度だけではCPAを説明できない")

    # 8. 四象限分析
    med_sim = np.median(sims)
    med_cpa = np.median(cpas)
    print(f"\n{'=' * 60}")
    print(f"四象限分析 (中央値: 類似度={med_sim:.3f}, CPA=¥{med_cpa:,.0f})")
    print("=" * 60)

    quadrants = {"高類似・低CPA (理想)": [], "高類似・高CPA (要改善)": [],
                 "低類似・低CPA (独自路線)": [], "低類似・高CPA (撤退候補)": []}
    for sim, cpa, cv, name, cid in sim_cpa_pairs:
        if sim >= med_sim and cpa <= med_cpa:
            quadrants["高類似・低CPA (理想)"].append((name, sim, cpa))
        elif sim >= med_sim and cpa > med_cpa:
            quadrants["高類似・高CPA (要改善)"].append((name, sim, cpa))
        elif sim < med_sim and cpa <= med_cpa:
            quadrants["低類似・低CPA (独自路線)"].append((name, sim, cpa))
        else:
            quadrants["低類似・高CPA (撤退候補)"].append((name, sim, cpa))

    for label, items in quadrants.items():
        print(f"\n■ {label} ({len(items)}本)")
        for name, sim, cpa in items[:5]:
            print(f"  {name[:35]:<36} sim={sim:.3f} CPA=¥{cpa:,.0f}")
        if len(items) > 5:
            print(f"  ... 他{len(items)-5}本")

    # 9. テキスト類似度も比較
    print(f"\n{'=' * 60}")
    print("テキスト(訴求)類似度 vs CPA も確認中...")
    text_embeddings = {}
    rows = fetch_json(
        f"cr_videos?select=creative_id,text_embedding"
        f"&creative_id=in.({','.join(str(c) for c in both)})"
        f"&text_embedding=not.is.null",
        {"limit": "1000"},
    )
    for r in rows:
        emb = r.get("text_embedding")
        if emb:
            if isinstance(emb, str):
                emb = json.loads(emb)
            text_embeddings[r["creative_id"]] = np.array(emb, dtype=np.float32)

    if len(text_embeddings) > 3:
        top5_text = np.mean([text_embeddings[c] for c in top5_ids if c in text_embeddings], axis=0)
        top5_text /= np.linalg.norm(top5_text)

        text_sims = []
        text_cpas = []
        for cid in both:
            if cid in text_embeddings:
                sim = cosine_similarity(top5_text, text_embeddings[cid])
                text_sims.append(sim)
                text_cpas.append(cpa_with_cv[cid]["cpa"])

        text_corr = np.corrcoef(text_sims, text_cpas)[0, 1]
        print(f"相関係数 (テキスト類似度 vs CPA): {text_corr:.4f}")
        if abs(text_corr) > abs(corr):
            print("→ テキスト(訴求内容)の方が映像よりCPAとの相関が強い")
        else:
            print("→ 映像的類似度の方がテキストよりCPAとの相関が強い")

    print(f"\n{'=' * 60}")
    print("分析完了")


if __name__ == "__main__":
    main()
