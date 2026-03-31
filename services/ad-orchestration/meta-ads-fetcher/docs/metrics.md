# 広告指標定義書

## 基本ルール
- 指標の計算式を変更する場合は、このファイルも必ず更新すること
- Meta管理画面の表示名とAPIフィールド名の対応を正とする
- 金額はJPYそのまま（*100しない）
- CV/MCVの定義は案件ごとに異なる（account_conversion_eventsテーブルで管理）

---

## 指標定義

### 表示・コスト系

| 指標 | 計算式 | 備考 |
|------|--------|------|
| **CPM** | COST / IMP * 1000 | 1000インプレッションあたりの単価 |

### クリック系

| 指標 | 計算式 | 備考 |
|------|--------|------|
| **CTR** | CLICK / IMP | リンククリック / インプレッション |

### CV系（案件のCV設定に依存）

| 指標 | 計算式 | 備考 |
|------|--------|------|
| **MCVR** | MCV / CLICK | LP遷移者のうちMCV発生率。MCVの定義は案件依存（コンテンツビュー等） |
| **MCPA** | COST / MCV | MCV1件あたりの単価 |
| **LPCVR** | CV / CLICK | LP遷移者のうちCV発生率。CVの定義は案件依存（登録完了、購入等） |
| **CPA** | COST / CV | CV1件あたりの単価。CVの定義は案件依存 |
| **CVR** | CV / IMP | インプレッションあたりのCV発生率 |

> CV/MCVの定義は `account_conversion_events` テーブルでアカウントごとに設定。
> `v_ad_performance` VIEWの `cv` / `mcv` カラムが自動解決する。

### 動画系

| 指標 | 計算式 | 備考 |
|------|--------|------|
| **3s視聴率** | 3sVIEW / PLAY | 再生開始のうち3秒以上視聴した割合 |
| **完全視聴率** | P100 / PLAY | 再生開始のうち最後まで視聴した割合 |

> **分母はPLAY（再生開始数）。IMPで割らない。**

---

## DBカラム ↔ Meta API マッピング

| DBカラム (ad_daily_metrics) | Meta APIフィールド | 管理画面表示名 |
|----------------------------|-------------------|--------------|
| `spend` | `spend` | 消化金額 |
| `impressions` | `impressions` | インプレッション |
| `reach` | `reach` | リーチ |
| `clicks` | `inline_link_clicks` | リンクのクリック |
| `video_plays` | `video_play_actions` | 動画の再生数 |
| `video_3s_views` | `actions` → `video_view` | 動画の3秒再生数 |
| `video_thruplay_views` | `video_thruplay_watched_actions` | ThruPlay |
| `video_p25_views` | `video_p25_watched_actions` | 動画の再生数(25%) |
| `video_p50_views` | `video_p50_watched_actions` | 動画の再生数(50%) |
| `video_p75_views` | `video_p75_watched_actions` | 動画の再生数(75%) |
| `video_p95_views` | `video_p95_watched_actions` | 動画の再生数(95%) |
| `video_p100_views` | `video_p100_watched_actions` | 動画の再生数(100%) |

---

## よくある間違い

| 間違い | 正しい | 理由 |
|--------|--------|------|
| 3s視聴率 = video_3s_views / impressions | **video_3s_views / video_plays** | 分母はIMPではなく再生開始数 |
| video_3s_viewsにThruPlayを格納 | video_3s_viewsは`actions`内`video_view` | ThruPlayは完視or15秒。3秒視聴とは別指標 |
| CPA = COST / MCV | CPA = COST / CV | MCVベースは「MCPA」と記載 |
| LPCVRを「登録完了」で固定 | CVの定義は案件依存 | account_conversion_eventsで定義 |
| 金額 * 100 | JPYそのまま | Meta APIは円建てで返す |
| v_unified_metricsの3s視聴を合算比較 | Meta=3秒, TikTok=2秒 | platformで判別必須 |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-03-26 | 初版作成。video_3s_viewsのThruPlay誤格納を修正。CV/MCV定義を案件依存に変更 |
