# 売れるBUZZ AI — 要件定義 × 実装状況 ギャップ分析

> **最終更新**: 2026-03-31（コード全量監査済み）
> **対象リポジトリ**: BONNOU-inc/ureru-buzz-ai (commit: cec48da)

---

## 1. 全体サマリー

### 全体実装率

```
全体進捗:  █████░░░░░░░░░░░░░░░  ~25%

Phase別:
Phase 1  プロジェクト設定     ░░░░░░░░░░░░░░░░░░░░   0%
Phase 2  リサーチ             █░░░░░░░░░░░░░░░░░░░   5%  UI実装あり(1,913行)
Phase 3  訴求開発             █░░░░░░░░░░░░░░░░░░░   5%  UI実装あり(377行)
Phase 4  広告プラン           █░░░░░░░░░░░░░░░░░░░   5%  UI実装あり(802行)
Phase 5  台本制作             █░░░░░░░░░░░░░░░░░░░   5%  UI実装あり(823行)
Phase 6  編集概要             ██████████████░░░░░░  70%  ← MVP最優先
Phase 7  動画編集             █░░░░░░░░░░░░░░░░░░░   5%  KlingSkill完了+UI(819行)
Phase 8  入稿                 ░░░░░░░░░░░░░░░░░░░░   0%  ※ad-orchestration側で別実装あり
Phase 9  運用                 ░░░░░░░░░░░░░░░░░░░░   0%  ※ad-orchestration側で別実装あり
Phase 10 レポーティング       ░░░░░░░░░░░░░░░░░░░░   0%
横断機能                      ████░░░░░░░░░░░░░░░░  20%
インフラ                      ███░░░░░░░░░░░░░░░░░  15%
```

### コード量サマリー（実測値）

| パッケージ | 実装コード | テストコード | 備考 |
|-----------|-----------|-------------|------|
| `packages/core` | ~856行 | ~185行 | 全ファイル本番品質 |
| `packages/skills` | ~1,280行 | ~615行 | 4スキル完全動作+1スタブ |
| `packages/agents` | ~490行 | ~170行 | EditBriefAgent完全動作 |
| `packages/web` | ~6,857行 | — | 14画面に実UI実装 |
| `packages/api` | ~36行 | — | ヘルスチェックのみ |
| `packages/orchestrator` | 2行 | — | 空スタブ |
| `packages/soundcore-sync` | ~800行 | — | 完全動作パイプライン |
| **合計** | **~10,321行** | **~970行** | |

### 一行サマリー

| 領域 | 状態 | 概要 |
|------|------|------|
| **コア基盤** | ✅ 完了 | monorepo構造、型定義(856行)、retry/rate-limit/tenant検証、8カスタムエラークラス |
| **Skill層** | 🔧 主要完了 | LLM(48行)/Notion(239行)/Kling(111行)/MaterialMatch(358行)完全動作。広告API/Slack/Drive等は未実装 |
| **Agent層** | 🔧 1/13 | EditBriefAgent(231行)完全動作+テスト済み。他12エージェント未実装 |
| **Orchestrator** | ❌ 未実装 | 2行の空export。ワークフロー/承認フロー全て未実装 |
| **Web UI** | 🔧 UI実装済み | **14画面に実UI**(6,400行超)。ただしAPI未接続・モックデータ。ComingSoonは3画面のみ(Knowledge/Operations/Reports) |
| **API** | ❌ 最小限 | Hono(36行)＋ヘルスチェックのみ。ビジネスロジックなし |
| **soundcore-sync** | ✅ 完了 | 音声→文字起こし→AI要約→Notion書き込み(800行超)。独立パイプラインとして完全動作 |
| **ad-orchestration** | 🔧 別系統 | 羽田さん構築。Meta/TikTok入稿・データ取得は動作中。本体TypeScriptとの統合が必要 |

---

## 2. Phase別 詳細ステータス

### Phase 1: プロジェクト設定

| 要件項目 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| AP基本情報入力（組織/背景/KPI/予算） | ❌ 未実装 | — | 入力UI、バリデーション、Notion永続化 |
| MP運用方針入力（プラットフォーム設定） | ❌ 未実装 | — | プラットフォーム別設定UI |
| キャンペーン構造設定 | ❌ 未実装 | — | キャンペーン→広告セット→広告の構造設定 |
| テスト期間/拡大期間ルール設定 | ❌ 未実装 | — | KPI、停止条件、拡大条件の設定 |
| SetupAgent | ❌ 未実装 | — | Agent自体が存在しない |
| 承認フロー（設定完了→次Phase） | ❌ 未実装 | — | Orchestrator依存 |

### Phase 2: リサーチ

| 要件項目 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| Web検索（自動） | ❌ 未実装 | — | WebSearchSkill |
| 広告ライブラリ検索（Meta/TikTok） | ❌ 未実装 | — | AdLibrarySkill |
| クライアント素材分析（手動UP→AI分析） | ❌ 未実装 | — | アップロード+分析パイプライン |
| SNS情報収集 | ❌ 未実装 | — | SNSSearchSkill |
| 動画広告分析Pro連携 | ❌ 未実装 | — | API統合 |
| 商品理解シート構造化 | ❌ 未実装 | — | Notion DB設計+入力 |
| セグメント分析/市場調査/既存顧客分析 | ❌ 未実装 | — | 分析ロジック+Notion格納 |
| ResearchAgent | ❌ 未実装 | — | Agent自体が存在しない |
| Web UI（リサーチ画面） | 🔧 実UI実装 | `packages/web/.../research/page.tsx` (1,913行) | 商品/市場/顧客タブ、ヒーロー、デザインカラー、ギャラリー等の本格UI。API未接続 |

### Phase 3: 訴求開発

| 要件項目 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| 月4訴求のAI自動提案 | ❌ 未実装 | — | 提案ロジック |
| 訴求シート構造（USP/訴求軸/WHO/WHAT/差別化） | ❌ 未実装 | — | Notion DB+入力UI |
| 過去実績データ連携 | ❌ 未実装 | — | ナレッジDB参照 |
| AppealAgent | ❌ 未実装 | — | Agent自体が存在しない |
| Web UI（訴求画面） | 🔧 実UI実装 | `packages/web/.../appeals/page.tsx` (377行) | 訴求名/WHO/WHAT/WHY/仮説/ベネフィットの入力フォーム+担当者選択。API未接続 |

### Phase 4: 広告プラン

| 要件項目 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| 興味タイプ×構成タイプのプラン自動生成 | ❌ 未実装 | — | 8興味タイプ×11構成タイプのマトリクス |
| プラン仮説（視聴/自分ごと/信用/行動の4壁） | ❌ 未実装 | — | 仮説生成ロジック |
| PlanningAgent | ❌ 未実装 | — | Agent自体が存在しない |
| Web UI（プラン画面） | 🔧 実UI実装 | `packages/web/.../planning/page.tsx` (802行) | 興味タイプ/構成タイプ選択、FVテキスト編集、コンセプトフレームワーク。API未接続 |

### Phase 5: 台本制作

| 要件項目 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| プランからの台本AI自動生成 | ❌ 未実装 | — | 4壁フレームワーク台本生成 |
| フック3パターン生成 | ❌ 未実装 | — | 同一訴求×異なるフック角度 |
| 60秒以内テキスト台本 | ❌ 未実装 | — | 文字数制御 |
| ScriptAgent | ❌ 未実装 | — | Agent自体が存在しない |
| Web UI（台本画面） | 🔧 実UI実装 | `packages/web/.../scripts/page.tsx` (53行) + `[scriptId]/page.tsx` (770行) | 一覧+詳細エディタ（ゾーン分割、色分け、CRUD行操作）。API未接続 |

### Phase 6: 編集概要 ← MVP最優先（実装率: 70%）

| 要件項目 | ステータス | 実装場所 | 詳細 |
|---------|-----------|---------|------|
| 台本→編集指示書の自動生成 | ✅ 完了 | `packages/agents/src/edit-brief/agent.ts` (231行) | 10ステップの完全ワークフロー。テナント検証→Notion取得→パース→素材マッチ→テロップ→BGM→Notion作成→通知 |
| 台本パース | ✅ 完了 | `packages/agents/src/edit-brief/script-parser.ts` (124行) | マーカーベース解析+比率フォールバック(hook12%/empathy15%等)の2戦略 |
| テロップ生成 | ✅ 完了 | `packages/agents/src/edit-brief/subtitle-generator.ts` (57行) | Zod検証付きLLM構造化出力。スタイル(白太字中央/黄インパクト下等)対応 |
| BGM選択 | 🔧 MVP実装 | `packages/agents/src/edit-brief/bgm-selector.ts` (56行) | ハードコード8曲ライブラリからLLM選択。**TODO: Notion DB連携に置換** |
| 素材マッチング | ✅ ほぼ完了 | `packages/skills/src/material-match/` (358行) | ベクトル検索(Gemini768d)+テキストフォールバック+スコアリング+AI提案。テスト3ファイル(240行) |
| 音声アノテーション | ❌ 未実装 | — | ナレーション指示 |
| 薬機法チェック欄 | ❌ 未実装 | — | RegulationAgent依存 |
| SE/ME/エフェクト指定 | ❌ 未実装 | — | 効果音・モーションエフェクト |
| 修正ループ（フィードバック→再生成） | ❌ 未実装 | — | 修正要望→再実行パイプライン |
| Slack連携（完了通知） | ❌ 未実装 | — | SlackSkill依存 |
| Notion本番マッピング | 🔧 進行中 | `packages/skills/src/notion/mappers.ts` (201行) | プロパティ抽出+レコードビルダー実装済み。動画名シート完全準拠が必要 |
| Web UI（編集概要画面） | ✅ 実装済み | `packages/web/.../edit-brief/page.tsx` (664行) | テロップ位置/フォント/BGM/SE/素材選択の本格UI。API接続が未 |
| テスト | ✅ 完了 | `packages/agents/src/__tests__/edit-brief/` (169行) | agent(117行) + parser(52行) テスト |

### Phase 7: 動画編集

| 要件項目 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| Remotionプロジェクト生成 | ❌ 未実装 | — | remotion-projectパッケージ自体がない |
| 編集概要→Remotionコード変換 | ❌ 未実装 | — | RemotionSkill |
| TTS（テキスト音声合成） | ❌ 未実装 | — | TTSSkill |
| VideoAgent | ❌ 未実装 | — | Agent自体が存在しない |
| Klingスキル（素材動画生成） | ✅ 完了 | `packages/skills/src/kling/skill.ts` | API連携+テスト済み |

### Phase 8: 入稿

| 要件項目 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| Meta Ads API入稿 | 🔧 別系統 | `services/ad-orchestration/meta-ads-fetcher/submission_engine.py` | ureru-buzz-ai本体との統合が必要 |
| TikTok Ads API入稿 | 🔧 別系統 | `services/ad-orchestration/meta-ads-fetcher/tiktok_submission_engine.py` | 同上 |
| YouTube Ads API入稿 | ❌ 未実装 | — | Google Ads API連携 |
| LINE/X入稿 | ❌ 未実装 | — | 各プラットフォームAPI |
| 動画名入力→自動入稿フロー | ❌ 未実装 | — | SubmissionAgent |
| CATS/Beyond自動化 | 🔧 別系統 | `services/ad-orchestration/meta-ads-fetcher/cats_automation.py` 等 | Playwright自動化済み |
| Slack入稿完了通知 | ❌ 未実装 | — | SlackSkill |
| SubmissionAgent | ❌ 未実装 | — | Agent自体が存在しない |

### Phase 9: 運用

| 要件項目 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| 5分間隔自動判定ジョブ | ❌ 未実装 | — | BullMQ/Redis + スケジューラー |
| 停止/継続/拡大/縮小ルール実行 | ❌ 未実装 | — | DBにテーブルは存在（operation_rules） |
| 各プラットフォームリアルタイムデータ取得 | 🔧 別系統 | `services/ad-orchestration/meta-ads-fetcher/fetcher.py` | Meta/TikTokデータ取得は30分間隔で稼働中 |
| OperationAgent | ❌ 未実装 | — | Agent自体が存在しない |

### Phase 10: レポーティング

| 要件項目 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| デイリーレポート | ❌ 未実装 | — | 日次自動生成 |
| ウィークリーレポート | ❌ 未実装 | — | 週次自動生成 |
| マンスリーレポート | ❌ 未実装 | — | 月次自動生成+グラフ |
| クリエイティブレポート/ランキング | ❌ 未実装 | — | CR単位パフォーマンス |
| マクロ分析（コンセプト/訴求/構成タイプ別） | ❌ 未実装 | — | 3軸分析ロジック |
| ミクロ分析（フック/構成要素/編集軸/視聴維持率） | ❌ 未実装 | — | 要素別評価ロジック |
| ReportAgent / AnalysisAgent | ❌ 未実装 | — | Agent自体が存在しない |
| Web UI（レポート画面） | ❌ ComingSoon | `packages/web/src/app/reports/page.tsx` | プレースホルダーのみ |
| CR分析（ベクトル化+構造ラベリング） | 🔧 別系統 | `services/ad-orchestration/meta-ads-fetcher/cr_vectorize_pipeline.py` 等 | Gemini Embedding済み、本体統合が必要 |

---

## 3. 横断機能ステータス

| 横断機能 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| **Orchestrator（ワークフロー制御）** | ❌ 未実装 | `packages/orchestrator/src/index.ts`（空） | Phase遷移、状態管理、エラーハンドリング、スケジューリング全て |
| **承認フロー** | ❌ 未実装 | — | Notionボタン承認、ポーリング、差し戻し、Slack通知 |
| **薬機法/規制チェック** | ❌ 未実装 | — | RegulationAgent、規制ナレッジDB検索、自動チェック |
| **AIチャット** | ❌ 未実装 | — | ChatAgent、実績/ナレッジ/規制のクロス検索 |
| **マルチテナント** | 🔧 一部実装 | `packages/core/src/utils/tenant.ts`、Supabase RLS | 型定義+RLSあり。実際の分離強制が未検証 |
| **Slack通知** | ❌ 未実装 | — | SlackSkill、承認通知、入稿通知、エラー通知 |
| **素材管理** | ❌ 未実装 | — | DriveSkill、素材ライブラリ、テナント分離 |
| **ナレッジ蓄積** | 🔧 一部実装 | Supabaseテーブル+pgvector | DBスキーマあり。蓄積→検索→フィードバックのループ未実装 |
| **進捗/ガントチャート** | ❌ 未実装 | — | GanttSkill、スケジュール表示 |
| **請求管理** | ❌ 未実装 | — | 月次請求集計ロジック |
| **目標管理ダッシュボード** | ❌ 未実装 | — | KPI目標/進捗/予測/達成率 |
| **動画制作ステータス管理** | ❌ 未実装 | — | 制作ワークフロー統合管理 |

---

## 4. Agent 実装ステータス

| # | Agent名 | 担当Phase | ステータス | 実装場所 | 備考 |
|---|---------|----------|-----------|---------|------|
| 1 | **SetupAgent** | Phase 1 | ❌ 未実装 | — | プロジェクト初期設定 |
| 2 | **ResearchAgent** | Phase 2 | ❌ 未実装 | — | Web/広告ライブラリ/SNS検索 |
| 3 | **AppealAgent** | Phase 3 | ❌ 未実装 | — | 訴求AI提案 |
| 4 | **PlanningAgent** | Phase 4 | ❌ 未実装 | — | 興味タイプ×構成タイプ プラン生成 |
| 5 | **ScriptAgent** | Phase 5 | ❌ 未実装 | — | 台本+フック3パターン生成 |
| 6 | **EditBriefAgent** | Phase 6 | 🔧 一部実装 | `packages/agents/src/edit-brief/` | 基本フロー済。音声/薬機法/SE未対応 |
| 7 | **VideoAgent** | Phase 7 | ❌ 未実装 | — | Remotion連携+動画生成 |
| 8 | **SubmissionAgent** | Phase 8 | ❌ 未実装 | — | 各プラットフォームAPI入稿 |
| 9 | **OperationAgent** | Phase 9 | ❌ 未実装 | — | 5分間隔自動判定+実行 |
| 10 | **AnalysisAgent** | Phase 10 | ❌ 未実装 | — | マクロ/ミクロ分析 |
| 11 | **ReportAgent** | Phase 10 | ❌ 未実装 | — | 日次/週次/月次レポート生成 |
| 12 | **RegulationAgent** | 横断 | ❌ 未実装 | — | 薬機法/景表法/プラットフォーム規制 |
| 13 | **ChatAgent** | 横断 | ❌ 未実装 | — | 自然言語質問→クロス検索回答 |

**実装率: 1/13 (一部実装含む)**

---

## 5. Skill 実装ステータス

### 共通Skill

| Skill名 | ステータス | 実装場所 | テスト | 備考 |
|---------|-----------|---------|-------|------|
| **LLMSkill** | ✅ 完了 | `packages/skills/src/llm/client.ts` | ✅ | Anthropic Claude、構造化出力(Zod)対応 |
| **NotionSkill** | ✅ 完了 | `packages/skills/src/notion/client.ts` | ✅ | CRUD+ページネーション+レート制限 |
| **SupabaseSkill** | ❌ 未実装 | — | — | ベクトル検索、パフォーマンスデータクエリ |
| **DriveSkill** | ❌ 未実装 | — | — | Google Drive素材操作 |
| **SlackSkill** | ❌ 未実装 | — | — | 通知、承認リクエスト |
| **ApprovalSkill** | ❌ 未実装 | — | — | Notionボタン承認管理 |
| **TemplateSkill** | ❌ 未実装 | — | — | テンプレート適用、構造化出力 |
| **WebSearchSkill** | ❌ 未実装 | — | — | Web検索、情報収集 |
| **AdLibrarySkill** | ❌ 未実装 | — | — | Meta/TikTok広告ライブラリ検索 |
| **SNSSearchSkill** | ❌ 未実装 | — | — | SNS情報収集 |

### 専門Skill

| Skill名 | ステータス | 実装場所 | テスト | 備考 |
|---------|-----------|---------|-------|------|
| **MetaAdsSkill** | ❌ 未実装 | — | — | ※ad-orchestration側にPython実装あり |
| **TikTokAdsSkill** | ❌ 未実装 | — | — | ※ad-orchestration側にPython実装あり |
| **YouTubeAdsSkill** | ❌ 未実装 | — | — | Google Ads API |
| **RemotionSkill** | ❌ 未実装 | — | — | Remotionプロジェクト生成+レンダリング |
| **TTSSkill** | ❌ 未実装 | — | — | テキスト音声合成 |
| **MaterialMatchSkill** | ✅ ほぼ完了 | `packages/skills/src/material-match/` (358行) | ✅ (240行) | ベクトル検索+テキストフォールバック+スコアリング+AI提案。Gemini768d Embedding |
| **RegulationCheckSkill** | ❌ 未実装 | — | — | 薬機法自動チェック |
| **PerformanceCalcSkill** | ❌ 未実装 | — | — | KPI計算、判定ロジック |
| **ChartSkill** | ❌ 未実装 | — | — | グラフ/チャート生成 |
| **GanttSkill** | ❌ 未実装 | — | — | ガントチャート生成 |
| **KlingSkill** | ✅ 完了 | `packages/skills/src/kling/skill.ts` | ✅ | 画像→動画生成API |
| **NanoBanana2Skill** | 🔧 スタブ | `packages/skills/src/nanobanana2/skill.ts` (48行) | ✅ (51行) | `generateImage/editImage`は意図的スタブ（CD承認後に実行する設計）。prompt-generator(34行)は動作 |

**実装率: 3/22 (完了) + 2/22 (一部実装)**

---

## 6. インフラ・非機能要件ステータス

| 要件 | ステータス | 実装場所 | 不足内容 |
|------|-----------|---------|---------|
| **monorepo構成** | ✅ 完了 | `pnpm-workspace.yaml`, `turbo.json` | — |
| **TypeScript設定** | ✅ 完了 | `tsconfig.base.json` | — |
| **テストフレームワーク** | ✅ 完了 | `vitest.config.ts`（13テストファイル） | カバレッジ拡充が必要 |
| **Supabaseスキーマ** | ✅ 完了 | `supabase/migrations/`（11ファイル） | 10テーブル+22インデックス+2ベクトル検索関数(match_knowledge/match_materials)+全テーブルRLS。本番検証が必要 |
| **CI/CDパイプライン** | ❌ 未実装 | — | GitHub Actions、自動テスト、自動デプロイ |
| **Cloud Run/Schedulerデプロイ** | ❌ 未実装 | — | 5分間隔ジョブ、APIサーバーデプロイ |
| **Secret管理** | 🔧 一部実装 | `deploy/github-issue-job/` | GCP Secret Manager（Issue Job用のみ） |
| **Redis/BullMQ** | ❌ 未実装 | — | 非同期タスクキュー、5分間隔ジョブ |
| **BigQuery連携** | ❌ 未実装 | — | 長期パフォーマンスデータ保存 |
| **Vertex AI Embedding** | ❌ 未実装 | — | ベクトル生成（※ad-orchestration側はGemini使用） |
| **マルチテナントRLS** | 🔧 一部実装 | Supabaseマイグレーション | ポリシー定義済み、実運用テスト未 |
| **環境変数管理** | 🔧 一部実装 | `.env.example` | 基本項目あり |
| **Cursor Rules** | ✅ 完了 | `.cursor/rules/`, `.cursorrules` | 行動指針、コミットワークフロー、セキュリティ |
| **soundcore-sync** | ✅ 完了 | `packages/soundcore-sync/` (800行超) | 音声→文字起こし(Gemini)→AI要約→Notion書き込み。ECDH暗号化、HTTPサーバー、CRON対応 |
| **E2Eテスト/セットアップスクリプト** | ✅ 完了 | `scripts/` (11ファイル) | E2Eフロー、Notion DB作成、データシーディング、要件ギャップIssue生成 |

---

## 7. 優先度別ロードマップ × 実装状況

### Tier 1（最優先 — 最大工数削減）

| 項目 | 現状 | 次のアクション |
|------|------|--------------|
| **Phase 6: 編集概要自動生成** | 🔧 50% | 動画名シート完全準拠、音声/SE/エフェクト対応、修正ループ、Slack通知 |
| **Phase 5: 台本自動生成** | ❌ 0% | ScriptAgent実装、4壁フレームワーク、フック3パターン生成 |

### Tier 2（早期自動化可能）

| 項目 | 現状 | 次のアクション |
|------|------|--------------|
| **Phase 8: 入稿自動化** | 🔧 別系統あり | SubmissionAgent実装、ad-orchestrationのPython入稿ロジックとの統合方針決定 |
| **Phase 9: 運用自動化** | 🔧 別系統あり | OperationAgent実装、5分間隔ジョブ(BullMQ)、ad-orchestrationのデータ取得との統合 |

### Tier 3（制作パイプライン完成）

| 項目 | 現状 | 次のアクション |
|------|------|--------------|
| **Phase 4: 広告プラン自動生成** | ❌ 0% | PlanningAgent、興味タイプ×構成タイプマトリクス |
| **Phase 3: 訴求開発AI提案** | ❌ 0% | AppealAgent、訴求シート構造、過去実績連携 |
| **Phase 2: リサーチ自動化** | ❌ 0% | ResearchAgent、Web/広告ライブラリ/SNS検索Skill群 |

### Tier 4（分析・改善ループ）

| 項目 | 現状 | 次のアクション |
|------|------|--------------|
| **Phase 10: レポーティング** | ❌ 0% | ReportAgent/AnalysisAgent、3軸分析、日次/週次/月次レポート |
| **Phase 7: Remotion動画編集** | ❌ 0% | VideoAgent、RemotionSkill、TTSSkill |

### Tier 5（管理システム）

| 項目 | 現状 | 次のアクション |
|------|------|--------------|
| **Phase 1: プロジェクト設定UI** | ❌ 0% | SetupAgent、AP/MP入力UI |
| **スケジュール/ガントチャート** | ❌ 0% | GanttSkill |
| **請求管理** | ❌ 0% | 月次集計ロジック |
| **目標管理ダッシュボード** | ❌ 0% | KPI目標/進捗/予測 |

### 横断（全Tierに影響）

| 項目 | 現状 | 次のアクション |
|------|------|--------------|
| **Orchestrator** | ❌ 0% | ワークフローエンジン、承認フロー、Phase遷移 — **全Phase連携のボトルネック** |
| **SlackSkill** | ❌ 0% | 通知基盤 — 多数のPhaseが依存 |
| **CI/CD** | ❌ 0% | 開発効率・品質の基盤 |

---

## 8. ad-orchestration（羽田さん側）との統合ポイント

`services/ad-orchestration/` に統合済みだが、ureru-buzz-ai本体（TypeScript）との連携は未実装。

| ad-orchestration機能 | 本体での対応Skill/Agent | 統合方針（要検討） |
|---------------------|----------------------|-----------------|
| Meta入稿 (`submission_engine.py`) | SubmissionAgent + MetaAdsSkill | Python→TypeScript移植 or APIラッパー |
| TikTok入稿 (`tiktok_submission_engine.py`) | SubmissionAgent + TikTokAdsSkill | 同上 |
| データ取得 (`fetcher.py`, `tiktok_fetcher.py`) | OperationAgent + PerformanceCalcSkill | 同上 |
| CATS/Beyond自動化 (`cats_automation.py`) | SubmissionAgentの前処理 | Playwright自動化はPython維持が妥当 |
| CR分析 (`cr_vectorize_pipeline.py`) | AnalysisAgent | Gemini Embeddingロジックの共有 |
| データ同期 (`sync_*.py`) | Orchestratorのデータ層 | Notion↔Supabase同期の統一 |
| Google Workspace MCP | 本体のDriveSkill/SheetsSkill | MCP→Skill統合 or MCP並行利用 |

---

## 9. Web UI 画面別実装状況（実測値）

### 実UI実装済み（14画面 / 6,400行超）

| 画面 | ファイル | 行数 | 内容 |
|------|---------|------|------|
| リサーチ | `research/page.tsx` | 1,913 | 商品/市場/顧客タブ、ヒーロー、UXリサーチ、ギャラリー、デザインカラー、感情キーワード |
| 動画編集 | `editing/page.tsx` | 819 | シーン制御、タイムラインUI、レイヤー編集 |
| 広告プラン | `planning/page.tsx` | 802 | 興味タイプ/構成タイプ選択、FVテキスト、コンセプトフレームワーク |
| 台本詳細 | `scripts/[scriptId]/page.tsx` | 770 | ゾーン分割エディタ(hook/main)、色分け、CRUD行操作 |
| 編集概要 | `edit-brief/page.tsx` | 664 | テロップ位置/フォント、BGM/SE、素材選択 |
| 撮影管理 | `shooting/page.tsx` | 427 | シーン一覧、ステータスフィルタ、ロケ/タイミング情報 |
| 訴求管理 | `appeals/page.tsx` | 377 | 訴求名/WHO/WHAT/WHY/仮説/ベネフィット入力 |
| 規制チェック | `regulations/page.tsx` | 354 | キーワード警告、代替表現提案 |
| 納品物 | `deliverables/page.tsx` | 316 | チェックリスト、ステータスバッジ、タイムライン |
| 素材管理 | `materials/page.tsx` | 300 | フィルタ(動画/画像/BGM/SE)、検索、使用セクション追跡 |
| クリエイティブ | `creatives/page.tsx` | 94 | ランキングカルーセル、検索、ソート可能テーブル |
| ログイン | `login/page.tsx` | 90 | メール/パスワード、パスワードリセット、サインアップ |
| ダッシュボード | `dashboard/page.tsx` | 75 | KPI4指標カード、トレンド表示、トップクリエイティブ |
| ホーム | `page.tsx` | 57 | チャットUI、サジェストボタン |

### ComingSoon（3画面）

| 画面 | ファイル | 備考 |
|------|---------|------|
| ナレッジ | `knowledge/page.tsx` (9行) | プレースホルダーのみ |
| 運用 | `operations/page.tsx` (10行) | プレースホルダーのみ |
| レポート | `reports/page.tsx` (10行) | プレースホルダーのみ |

### 共通コンポーネント・Hooks

| ファイル | 機能 |
|---------|------|
| `app-shell.tsx` | サイドバー+チャットレイアウト |
| `floating-chat.tsx` | フローティングチャットウィジェット |
| `local-backend-status-banner.tsx` | ローカルバックエンド接続状態バナー |
| `global-undo-provider.tsx` | Undo/Redo状態管理プロバイダー |
| `use-undoable-state.ts` | Undo/Redo対応ステートフック |
| `use-page-undo-draft.ts` | ページレベル下書き永続化 |

---

## 凡例

| アイコン | 意味 |
|---------|------|
| ✅ | 完了（本番利用可能レベル） |
| 🔧 | 一部実装（機能不足あり） |
| ❌ | 未実装 |
| 🔧 別系統 | ad-orchestration側に実装あり（本体統合が必要） |
