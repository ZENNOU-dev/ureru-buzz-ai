# 売れるBUZZ AI — 要件定義 × 実装状況 ギャップ分析

> **最終更新**: 2026-03-31
> **対象リポジトリ**: BONNOU-inc/ureru-buzz-ai (commit: af561df)

---

## 1. 全体サマリー

### 全体実装率

```
全体進捗:  ████░░░░░░░░░░░░░░░░  ~20%

Phase別:
Phase 1  プロジェクト設定     ░░░░░░░░░░░░░░░░░░░░   0%
Phase 2  リサーチ             ░░░░░░░░░░░░░░░░░░░░   0%
Phase 3  訴求開発             ░░░░░░░░░░░░░░░░░░░░   0%
Phase 4  広告プラン           ░░░░░░░░░░░░░░░░░░░░   0%
Phase 5  台本制作             ░░░░░░░░░░░░░░░░░░░░   0%
Phase 6  編集概要             ██████████░░░░░░░░░░  50%  ← MVP最優先
Phase 7  動画編集             ░░░░░░░░░░░░░░░░░░░░   0%
Phase 8  入稿                 ░░░░░░░░░░░░░░░░░░░░   0%  ※ad-orchestration側で別実装あり
Phase 9  運用                 ░░░░░░░░░░░░░░░░░░░░   0%  ※ad-orchestration側で別実装あり
Phase 10 レポーティング       ░░░░░░░░░░░░░░░░░░░░   0%
横断機能                      ████░░░░░░░░░░░░░░░░  20%
インフラ                      ██░░░░░░░░░░░░░░░░░░  10%
```

### 一行サマリー

| 領域 | 状態 | 概要 |
|------|------|------|
| **コア基盤** | 🔧 完了 | monorepo構造、型定義、ユーティリティ、ロガー、エラーハンドリング |
| **Skill層** | 🔧 主要完了 | LLM/Notion/Kling/MaterialMatch実装済み。広告API/Slack/Drive等は未実装 |
| **Agent層** | ❌ 1/13 | EditBriefAgentのみ。他12エージェント未実装 |
| **Orchestrator** | ❌ 未実装 | 空ファイルのみ。ワークフロー/承認フロー全て未実装 |
| **Web UI** | 🔧 シェルのみ | 全画面あるがモックデータ。API未接続。Reports/Knowledge/Operationsは`ComingSoon` |
| **API** | ❌ 最小限 | Honoサーバー＋ヘルスチェックのみ。ビジネスロジックなし |
| **ad-orchestration** | 🔧 別系統 | 羽田さん構築。Meta/TikTok入稿・データ取得は動作中。本体と未統合 |

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
| Web UI（リサーチ画面） | 🔧 UIのみ | `packages/web/src/app/projects/[projectId]/research/page.tsx` | モックデータ、API未接続 |

### Phase 3: 訴求開発

| 要件項目 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| 月4訴求のAI自動提案 | ❌ 未実装 | — | 提案ロジック |
| 訴求シート構造（USP/訴求軸/WHO/WHAT/差別化） | ❌ 未実装 | — | Notion DB+入力UI |
| 過去実績データ連携 | ❌ 未実装 | — | ナレッジDB参照 |
| AppealAgent | ❌ 未実装 | — | Agent自体が存在しない |
| Web UI（訴求画面） | 🔧 UIのみ | `packages/web/src/app/projects/[projectId]/appeals/page.tsx` | モックデータ |

### Phase 4: 広告プラン

| 要件項目 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| 興味タイプ×構成タイプのプラン自動生成 | ❌ 未実装 | — | 8興味タイプ×11構成タイプのマトリクス |
| プラン仮説（視聴/自分ごと/信用/行動の4壁） | ❌ 未実装 | — | 仮説生成ロジック |
| PlanningAgent | ❌ 未実装 | — | Agent自体が存在しない |
| Web UI（プラン画面） | 🔧 UIのみ | `packages/web/src/app/projects/[projectId]/planning/page.tsx` | モックデータ |

### Phase 5: 台本制作

| 要件項目 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| プランからの台本AI自動生成 | ❌ 未実装 | — | 4壁フレームワーク台本生成 |
| フック3パターン生成 | ❌ 未実装 | — | 同一訴求×異なるフック角度 |
| 60秒以内テキスト台本 | ❌ 未実装 | — | 文字数制御 |
| ScriptAgent | ❌ 未実装 | — | Agent自体が存在しない |
| Web UI（台本画面） | 🔧 UIのみ | `packages/web/src/app/projects/[projectId]/scripts/` | モックデータ、一覧+詳細画面あり |

### Phase 6: 編集概要 ← MVP最優先

| 要件項目 | ステータス | 実装場所 | 不足内容 |
|---------|-----------|---------|---------|
| 台本→編集指示書の自動生成 | 🔧 一部実装 | `packages/agents/src/edit-brief/agent.ts` | 基本フロー実装済み |
| 台本パース | ✅ 完了 | `packages/agents/src/edit-brief/script-parser.ts` | — |
| テロップ生成 | ✅ 完了 | `packages/agents/src/edit-brief/subtitle-generator.ts` | — |
| BGM選択 | ✅ 完了 | `packages/agents/src/edit-brief/bgm-selector.ts` | — |
| 素材マッチング | 🔧 一部実装 | `packages/skills/src/material-match/` | スコアリング+マッチャー実装済み。ベクトル検索本番化が未完 |
| 音声アノテーション | ❌ 未実装 | — | ナレーション指示 |
| 薬機法チェック欄 | ❌ 未実装 | — | RegulationAgent依存 |
| SE/ME/エフェクト指定 | ❌ 未実装 | — | 効果音・モーションエフェクト |
| 修正ループ（フィードバック→再生成） | ❌ 未実装 | — | 修正要望→再実行パイプライン |
| Slack連携（完了通知） | ❌ 未実装 | — | SlackSkill依存 |
| Notion本番マッピング | 🔧 進行中 | `packages/skills/src/notion/` | 動画名シート完全準拠が必要 |
| Web UI（編集概要画面） | 🔧 実装済み | `packages/web/src/app/projects/[projectId]/edit-brief/page.tsx` | 500行超の本格UI。API接続が未 |
| テスト | ✅ 完了 | `packages/agents/src/__tests__/edit-brief/` | agent + parser テスト |

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
| **MaterialMatchSkill** | 🔧 一部実装 | `packages/skills/src/material-match/` | ✅ | スコアリング+マッチャー済。ベクトル検索本番化が未 |
| **RegulationCheckSkill** | ❌ 未実装 | — | — | 薬機法自動チェック |
| **PerformanceCalcSkill** | ❌ 未実装 | — | — | KPI計算、判定ロジック |
| **ChartSkill** | ❌ 未実装 | — | — | グラフ/チャート生成 |
| **GanttSkill** | ❌ 未実装 | — | — | ガントチャート生成 |
| **KlingSkill** | ✅ 完了 | `packages/skills/src/kling/skill.ts` | ✅ | 画像→動画生成API |
| **NanoBanana2Skill** | 🔧 スタブ | `packages/skills/src/nanobanana2/skill.ts` | ✅ | メソッド存在するが`not yet implemented`エラー |

**実装率: 3/22 (完了) + 2/22 (一部実装)**

---

## 6. インフラ・非機能要件ステータス

| 要件 | ステータス | 実装場所 | 不足内容 |
|------|-----------|---------|---------|
| **monorepo構成** | ✅ 完了 | `pnpm-workspace.yaml`, `turbo.json` | — |
| **TypeScript設定** | ✅ 完了 | `tsconfig.base.json` | — |
| **テストフレームワーク** | ✅ 完了 | `vitest.config.ts`（13テストファイル） | カバレッジ拡充が必要 |
| **Supabaseスキーマ** | ✅ 完了 | `supabase/migrations/`（11ファイル） | 本番検証が必要 |
| **CI/CDパイプライン** | ❌ 未実装 | — | GitHub Actions、自動テスト、自動デプロイ |
| **Cloud Run/Schedulerデプロイ** | ❌ 未実装 | — | 5分間隔ジョブ、APIサーバーデプロイ |
| **Secret管理** | 🔧 一部実装 | `deploy/github-issue-job/` | GCP Secret Manager（Issue Job用のみ） |
| **Redis/BullMQ** | ❌ 未実装 | — | 非同期タスクキュー、5分間隔ジョブ |
| **BigQuery連携** | ❌ 未実装 | — | 長期パフォーマンスデータ保存 |
| **Vertex AI Embedding** | ❌ 未実装 | — | ベクトル生成（※ad-orchestration側はGemini使用） |
| **マルチテナントRLS** | 🔧 一部実装 | Supabaseマイグレーション | ポリシー定義済み、実運用テスト未 |
| **環境変数管理** | 🔧 一部実装 | `.env.example` | 基本項目あり |
| **Cursor Rules** | ✅ 完了 | `.cursor/rules/`, `.cursorrules` | 行動指針、コミットワークフロー、セキュリティ |

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

## 凡例

| アイコン | 意味 |
|---------|------|
| ✅ | 完了（本番利用可能レベル） |
| 🔧 | 一部実装（機能不足あり） |
| ❌ | 未実装 |
| 🔧 別系統 | ad-orchestration側に実装あり（本体統合が必要） |
