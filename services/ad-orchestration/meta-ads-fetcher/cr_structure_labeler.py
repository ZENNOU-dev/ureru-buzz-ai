"""
CR構成ラベリング — テロップ+書き起こしからGemini Flashで構造化分類
既存cr_videosのtranscription/telop_full_textを使うので動画DL不要
"""
import os, json, sys, time
import requests
import numpy as np
from dotenv import load_dotenv
from google import genai
from google.genai import types as genai_types

load_dotenv()

URL = os.getenv("SUPABASE_URL") + "/rest/v1/"
KEY = os.getenv("SUPABASE_SERVICE_KEY")
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

gemini_client = genai.Client()
MODEL = "gemini-2.5-flash-lite"

LABELING_PROMPT = """\
あなたは広告クリエイティブの構成アナリストです。
以下の歯科矯正マウスピース広告動画のテロップと書き起こしを分析し、JSONで回答してください。

## CR名: {cr_name}
## 動画尺: {duration_sec:.1f}秒 / シーン数: {scene_count}

## テロップ全文:
{telop}

## 書き起こし(音声):
{transcription}

---

以下のJSON形式で回答してください。各フィールドは指定された選択肢から選んでください。

```json
{{
  "video_format": "実写UGC風 | 実写BA比較 | アニメ会話劇 | ミックス",
  "performer_visibility": "顔出し | 口元のみ | 手元のみ | なし",
  "hook_type": "友達の変化 | BA衝撃 | 問いかけ | 数字提示 | 自慢→種明かし | 悩み共感 | 第三者評価",
  "story_structure": "会話劇 | モノローグ | 第三者語り | ナレーション",
  "orthodontic_vs_surgery": true,
  "main_benefit": "Eライン・横顔 | 垢抜け | モテ・恋愛 | コスパ | 期間の短さ | 仕上がり品質",
  "authority_method": "専門医監修 | 歯科衛生士推薦 | カウセ比較 | BA症例 | なし",
  "offer_type": "月々1760円 | 無料カウセ | 期間限定 | 複数提示 | なし",
  "target_gender": "女性 | 男性 | ユニセックス",
  "situation": "合コン・飲み会 | 友達との会話 | カップル | 結婚式 | 日常 | なし",
  "hook_summary": "冒頭3秒の内容を15文字以内で要約",
  "structure_flow": "動画全体の構成を30文字以内で要約(例: フック→悩み→矯正提案→BA→オファー)"
}}
```

重要:
- video_format: CR名に「アニメ」が含まれればアニメ会話劇
- orthodontic_vs_surgery: 「整形の前にまず矯正」的な転換訴求があればtrue
- hook_type: 冒頭の最初の訴求を判定。複数あれば最初のものを選ぶ
- main_benefit: 動画全体で最も強調されているベネフィットを1つ選ぶ
- JSONのみ回答。説明不要。
"""


def fetch_json(endpoint, params=None):
    r = requests.get(URL + endpoint, headers=HEADERS, params=params or {})
    r.raise_for_status()
    return r.json()


def label_cr(cr_name, duration_ms, scene_count, telop, transcription):
    """Gemini Flashで構成ラベリング"""
    prompt = LABELING_PROMPT.format(
        cr_name=cr_name,
        duration_sec=(duration_ms or 0) / 1000,
        scene_count=scene_count or 0,
        telop=telop or "(なし)",
        transcription=transcription or "(なし)",
    )
    resp = gemini_client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )
    return json.loads(resp.text)


def main():
    project_name = sys.argv[1] if len(sys.argv) > 1 else "ローコスト"
    print(f"{'='*60}")
    print(f"CR構成ラベリング — {project_name}")
    print(f"{'='*60}")

    # 1. 完了済みcr_videosを取得
    videos = fetch_json(
        "cr_videos?select=creative_id,duration_ms,scene_count,transcription,telop_full_text"
        "&processing_status=eq.completed"
        "&transcription=not.is.null",
        {"limit": "1000"},
    )
    cr_ids = [v["creative_id"] for v in videos]
    vid_map = {v["creative_id"]: v for v in videos}

    # 2. プロジェクトフィルタ
    ids_str = ",".join(str(i) for i in cr_ids)
    crs = fetch_json(
        f"creatives?select=id,creative_name,project_id"
        f"&id=in.({ids_str})"
        f"&project_id=eq.18",  # ローコスト
        {"limit": "1000"},
    )
    cr_map = {c["id"]: c["creative_name"] for c in crs}
    target_ids = [c["id"] for c in crs]
    print(f"対象CR: {len(target_ids)}本\n")

    # 3. CPA取得
    perf = fetch_json(
        "v_ad_performance?select=creative_id,spend,cv&project_id=eq.18&spend=gt.0",
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

    # 4. ラベリング実行
    results = []
    for i, cid in enumerate(target_ids):
        name = cr_map[cid]
        v = vid_map[cid]
        pa = perf_agg.get(cid, {"spend": 0, "cv": 0})
        cpa = pa["spend"] / pa["cv"] if pa["cv"] > 0 else None

        print(f"[{i+1}/{len(target_ids)}] {name}...", end=" ", flush=True)
        try:
            labels = label_cr(
                name, v["duration_ms"], v["scene_count"],
                v["telop_full_text"], v["transcription"],
            )
            labels["creative_id"] = cid
            labels["creative_name"] = name
            labels["spend"] = pa["spend"]
            labels["cv"] = pa["cv"]
            labels["cpa"] = cpa
            labels["duration_ms"] = v["duration_ms"]
            labels["scene_count"] = v["scene_count"]
            # 自動算出軸
            telop_len = len(v.get("telop_full_text") or "")
            trans_len = len(v.get("transcription") or "")
            dur_s = (v["duration_ms"] or 1) / 1000
            labels["telop_density"] = round(telop_len / dur_s, 1)
            labels["avg_scene_dur_ms"] = round((v["duration_ms"] or 0) / max(v["scene_count"] or 1, 1))
            labels["transcription_chars"] = trans_len
            results.append(labels)
            print("OK")
        except Exception as e:
            print(f"ERROR: {e}")

        if (i + 1) % 15 == 0:
            time.sleep(2)  # rate limit

    # 5. 保存
    out_path = f"cr_structure_labels_{project_name}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n保存: {out_path} ({len(results)}件)")

    # 6. 構成 × CPA 分析
    print(f"\n{'='*60}")
    print("構成軸 × CPA 分析")
    print(f"{'='*60}")

    axes = [
        "video_format", "hook_type", "story_structure",
        "orthodontic_vs_surgery", "main_benefit", "authority_method",
        "offer_type", "target_gender", "situation",
    ]

    for ax in axes:
        groups = {}
        for r in results:
            val = str(r.get(ax, "不明"))
            if val not in groups:
                groups[val] = {"cpas": [], "spend": 0, "cv": 0, "count": 0}
            groups[val]["count"] += 1
            groups[val]["spend"] += r.get("spend", 0)
            groups[val]["cv"] += r.get("cv", 0)
            if r.get("cpa") is not None:
                groups[val]["cpas"].append(r["cpa"])

        print(f"\n■ {ax}")
        print(f"  {'値':<25} {'本数':>4} {'CV有':>4} {'総CV':>5} {'総Spend':>12} {'平均CPA':>10}")
        print(f"  {'-'*70}")
        for val, g in sorted(groups.items(), key=lambda x: -(x[1]["cv"])):
            avg_cpa = f"¥{np.mean(g['cpas']):,.0f}" if g["cpas"] else "-"
            cv_count = len(g["cpas"])
            print(
                f"  {val:<25} {g['count']:>4} {cv_count:>4} {g['cv']:>5} "
                f"¥{g['spend']:>11,.0f} {avg_cpa:>10}"
            )

    # 7. 冒頭フック × CPA 詳細
    print(f"\n{'='*60}")
    print("冒頭フック詳細")
    print(f"{'='*60}")
    for r in sorted(results, key=lambda x: x.get("cpa") or 999999):
        cpa_str = f"¥{r['cpa']:,.0f}" if r["cpa"] else "CV無"
        print(
            f"  {cpa_str:>8} | {r.get('hook_type','?'):<16} | "
            f"{r.get('hook_summary',''):<20} | {r['creative_name'][:30]}"
        )

    # 8. 構成フローパターン
    print(f"\n{'='*60}")
    print("構成フロー × CPA")
    print(f"{'='*60}")
    for r in sorted(results, key=lambda x: x.get("cpa") or 999999):
        cpa_str = f"¥{r['cpa']:,.0f}" if r["cpa"] else "CV無"
        print(f"  {cpa_str:>8} | {r.get('structure_flow','')}")


if __name__ == "__main__":
    main()
