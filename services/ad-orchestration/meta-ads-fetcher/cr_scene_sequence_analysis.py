"""
シーン列比較分析 — CRをシーンのembedding列として比較し、CPAとの関係を分析
動画全体embeddingではなく、シーン列(冒頭→中盤→CTA)の流れとして類似度を計算
"""
import os, json, sys, time
import numpy as np
import requests
from dotenv import load_dotenv

load_dotenv()

URL = os.getenv("SUPABASE_URL") + "/rest/v1/"
KEY = os.getenv("SUPABASE_SERVICE_KEY")
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

PROJECT_ID = 18  # ローコスト


def fetch_json(endpoint, params=None):
    r = requests.get(URL + endpoint, headers=HEADERS, params=params or {})
    r.raise_for_status()
    return r.json()


def cos_sim(a, b):
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def normalize_scene_sequence(scenes, n_segments=5):
    """
    シーン列を固定長N区間に正規化。
    各区間の代表embeddingは、その時間帯に含まれるシーンembeddingの加重平均。
    区間: 冒頭 / 序盤 / 中盤 / 終盤 / CTA
    """
    if not scenes:
        return None

    total_dur = scenes[-1]["end_ms"] - scenes[0]["start_ms"]
    if total_dur <= 0:
        total_dur = 1

    segment_dur = total_dur / n_segments
    start_time = scenes[0]["start_ms"]
    segments = []

    for seg_i in range(n_segments):
        seg_start = start_time + seg_i * segment_dur
        seg_end = seg_start + segment_dur

        weighted_embs = []
        weights = []
        for s in scenes:
            # このシーンと区間の重なりを計算
            overlap_start = max(s["start_ms"], seg_start)
            overlap_end = min(s["end_ms"], seg_end)
            overlap = max(0, overlap_end - overlap_start)
            if overlap > 0:
                weighted_embs.append(s["emb"])
                weights.append(overlap)

        if weighted_embs:
            weights = np.array(weights, dtype=np.float32)
            weights /= weights.sum()
            seg_emb = sum(w * e for w, e in zip(weights, weighted_embs))
            seg_emb /= np.linalg.norm(seg_emb)
            segments.append(seg_emb)
        else:
            # 最寄りシーンを使う
            mid = (seg_start + seg_end) / 2
            closest = min(scenes, key=lambda s: abs((s["start_ms"] + s["end_ms"]) / 2 - mid))
            e = closest["emb"].copy()
            e /= np.linalg.norm(e)
            segments.append(e)

    return segments


def sequence_similarity(seq_a, seq_b):
    """シーン列同士の類似度 — 各区間のcos_simの平均"""
    if seq_a is None or seq_b is None:
        return None
    sims = [cos_sim(a, b) for a, b in zip(seq_a, seq_b)]
    return {
        "overall": float(np.mean(sims)),
        "per_segment": sims,
    }


def main():
    N_SEGMENTS = 5
    SEGMENT_NAMES = ["冒頭", "序盤", "中盤", "終盤", "CTA"]

    print(f"{'='*70}")
    print(f"シーン列比較分析 — ローコスト ({N_SEGMENTS}区間)")
    print(f"{'='*70}")

    # 1. CR情報取得
    crs = fetch_json(f"creatives?select=id,creative_name&project_id=eq.{PROJECT_ID}", {"limit": "1000"})
    cr_map = {c["id"]: c["creative_name"] for c in crs}

    videos = fetch_json(
        "cr_videos?select=id,creative_id,scene_count,duration_ms"
        "&processing_status=eq.completed",
        {"limit": "1000"},
    )
    vid_map = {}
    vid_to_cr = {}
    for v in videos:
        if v["creative_id"] in cr_map:
            vid_map[v["creative_id"]] = v
            vid_to_cr[v["id"]] = v["creative_id"]

    print(f"対象CR: {len(vid_map)}")

    # 2. シーンembedding取得（ページネーション）
    all_vid_ids = [v["id"] for v in vid_map.values()]
    cr_scenes = {cid: [] for cid in vid_map}

    batch_size = 20  # 20動画ずつ
    for i in range(0, len(all_vid_ids), batch_size):
        batch_ids = all_vid_ids[i : i + batch_size]
        ids_str = ",".join(str(x) for x in batch_ids)
        scenes = fetch_json(
            f"cr_scenes?select=video_id,scene_index,scene_embedding,start_ms,end_ms"
            f"&video_id=in.({ids_str})"
            f"&scene_embedding=not.is.null"
            f"&order=video_id.asc,scene_index.asc",
            {"limit": "5000"},
        )
        for s in scenes:
            cid = vid_to_cr.get(s["video_id"])
            if not cid:
                continue
            emb = s["scene_embedding"]
            if isinstance(emb, str):
                emb = json.loads(emb)
            cr_scenes[cid].append({
                "idx": s["scene_index"],
                "emb": np.array(emb, dtype=np.float32),
                "start_ms": s["start_ms"],
                "end_ms": s["end_ms"],
            })
        sys.stdout.write(f"\r  シーン取得: {min(i+batch_size, len(all_vid_ids))}/{len(all_vid_ids)} 動画")
        sys.stdout.flush()

    # ソート
    for cid in cr_scenes:
        cr_scenes[cid].sort(key=lambda x: x["idx"])

    valid = {cid: sc for cid, sc in cr_scenes.items() if len(sc) >= 3}
    print(f"\n  有効CR: {len(valid)} (3シーン以上)")

    # 3. 正規化シーン列
    print("\n[正規化中...]")
    normalized = {}
    for cid, scenes in valid.items():
        seq = normalize_scene_sequence(scenes, N_SEGMENTS)
        if seq:
            normalized[cid] = seq
    print(f"  正規化完了: {len(normalized)} CR")

    # 4. CPA取得
    perf = fetch_json(
        f"v_ad_performance?select=creative_id,spend,cv&project_id=eq.{PROJECT_ID}&spend=gt.0",
        {"limit": "50000"},
    )
    perf_agg = {}
    for p in perf:
        cid = p.get("creative_id")
        if not cid:
            continue
        if cid not in perf_agg:
            perf_agg[cid] = {"spend": 0, "cv": 0}
        perf_agg[cid]["spend"] += p.get("spend") or 0
        perf_agg[cid]["cv"] += p.get("cv") or 0

    # CPA算出
    cr_cpa = {}
    for cid in normalized:
        pa = perf_agg.get(cid, {"spend": 0, "cv": 0})
        cr_cpa[cid] = {
            "spend": pa["spend"],
            "cv": pa["cv"],
            "cpa": pa["spend"] / pa["cv"] if pa["cv"] > 0 else None,
        }

    cv_crs = sorted(
        [cid for cid in normalized if cr_cpa[cid]["cpa"] is not None],
        key=lambda c: cr_cpa[c]["cpa"],
    )
    print(f"  CV有りCR: {len(cv_crs)}")

    if len(cv_crs) < 3:
        print("CV有りCRが少なすぎる")
        return

    # 5. Top5基準シーン列
    top5 = cv_crs[:5]
    print(f"\n{'='*70}")
    print(f"基準: CPA Top5")
    print(f"{'='*70}")
    for cid in top5:
        print(f"  ¥{cr_cpa[cid]['cpa']:>9,.0f} | {cr_map[cid]}")

    # Top5の各区間の平均embedding
    top5_seq = []
    for seg_i in range(N_SEGMENTS):
        seg_embs = [normalized[cid][seg_i] for cid in top5]
        avg = np.mean(seg_embs, axis=0)
        avg /= np.linalg.norm(avg)
        top5_seq.append(avg)

    # 6. 全CRとTop5基準のシーン列類似度
    print(f"\n{'='*70}")
    print(f"Top5基準との区間別類似度 × CPA")
    print(f"{'='*70}")
    header = f"{'CPA':>10} {'総合':>6}"
    for name in SEGMENT_NAMES:
        header += f" {name:>6}"
    header += f"  {'CR名'}"
    print(header)
    print("-" * 90)

    all_results = []
    for cid in normalized:
        sim = sequence_similarity(top5_seq, normalized[cid])
        cpa = cr_cpa[cid]["cpa"]
        cpa_str = f"¥{cpa:,.0f}" if cpa else "CV無"
        all_results.append({
            "cid": cid,
            "name": cr_map[cid],
            "cpa": cpa,
            "cv": cr_cpa[cid]["cv"],
            "spend": cr_cpa[cid]["spend"],
            "overall_sim": sim["overall"],
            "segment_sims": sim["per_segment"],
        })

    # CPA有り → CPA順、CV無し → 類似度順
    cv_results = sorted([r for r in all_results if r["cpa"] is not None], key=lambda x: x["cpa"])
    no_cv_results = sorted([r for r in all_results if r["cpa"] is None], key=lambda x: -x["overall_sim"])

    for r in cv_results:
        line = f"¥{r['cpa']:>9,.0f} {r['overall_sim']:>6.3f}"
        for s in r["segment_sims"]:
            line += f" {s:>6.3f}"
        line += f"  {r['name'][:35]}"
        is_top5 = r["cid"] in top5
        print(f"{line}{'  ★' if is_top5 else ''}")

    print(f"  --- CV無し (Top5類似度順 上位15) ---")
    for r in no_cv_results[:15]:
        line = f"{'CV無':>10} {r['overall_sim']:>6.3f}"
        for s in r["segment_sims"]:
            line += f" {s:>6.3f}"
        line += f"  {r['name'][:35]}"
        print(line)

    # 7. 区間別の相関
    print(f"\n{'='*70}")
    print("区間別: Top5類似度 vs CPA 相関")
    print(f"{'='*70}")
    cpas = np.array([r["cpa"] for r in cv_results])
    for seg_i, name in enumerate(SEGMENT_NAMES):
        sims = np.array([r["segment_sims"][seg_i] for r in cv_results])
        corr = np.corrcoef(sims, cpas)[0, 1]
        direction = "↓良" if corr < -0.2 else "↑悪" if corr > 0.2 else "→弱"
        print(f"  {name}: r = {corr:>7.4f}  {direction}  (類似度高い→CPA{'低い=良い' if corr < 0 else '高い=悪い' if corr > 0 else '関係薄い'})")

    overall_sims = np.array([r["overall_sim"] for r in cv_results])
    corr_all = np.corrcoef(overall_sims, cpas)[0, 1]
    print(f"  {'総合':}: r = {corr_all:>7.4f}")

    # 8. 区間ごとの勝ち/負けパターン
    print(f"\n{'='*70}")
    print("区間別: CPA良い組(Top半分) vs CPA悪い組 の類似度差")
    print(f"{'='*70}")
    mid = len(cv_results) // 2
    good = cv_results[:mid]
    bad = cv_results[mid:]
    for seg_i, name in enumerate(SEGMENT_NAMES):
        good_avg = np.mean([r["segment_sims"][seg_i] for r in good])
        bad_avg = np.mean([r["segment_sims"][seg_i] for r in bad])
        diff = good_avg - bad_avg
        bar = "█" * int(abs(diff) * 500)
        direction = "+" if diff > 0 else "-"
        print(f"  {name}: 良い組={good_avg:.4f}  悪い組={bad_avg:.4f}  差={direction}{abs(diff):.4f} {bar}")

    # 9. CV無しの中でTop5に最も似ているCR（有望候補）
    print(f"\n{'='*70}")
    print("CV無しだがTop5に構成が似ている = 有望候補 (Top10)")
    print(f"{'='*70}")
    print(f"{'総合':>6} {'冒頭':>6} {'序盤':>6} {'中盤':>6} {'終盤':>6} {'CTA':>6}  {'消化額':>10}  {'CR名'}")
    print("-" * 85)
    for r in no_cv_results[:10]:
        line = f"{r['overall_sim']:>6.3f}"
        for s in r["segment_sims"]:
            line += f" {s:>6.3f}"
        line += f"  ¥{r['spend']:>9,.0f}  {r['name'][:35]}"
        print(line)

    # 10. CV無しの中でTop5と最も違うCR
    print(f"\n{'='*70}")
    print("CV無しでTop5と構成が最も違う = 別路線 (Bottom10)")
    print(f"{'='*70}")
    for r in no_cv_results[-10:]:
        line = f"{r['overall_sim']:>6.3f}"
        for s in r["segment_sims"]:
            line += f" {s:>6.3f}"
        line += f"  ¥{r['spend']:>9,.0f}  {r['name'][:35]}"
        print(line)


if __name__ == "__main__":
    main()
