# 売れるBUZZ AI - 詳細指示書

## 1. 実装順序

### 1.1 Sprint計画

```
Sprint 0（基盤構築）: 1週間
├── モノレポセットアップ
├── Supabaseプロジェクト作成 + マイグレーション
├── Notion DBテンプレート作成
├── 共通モジュール（core）実装
└── CI/CD基盤

Sprint 1（Tier 1 - 編集概要自動化）: 2週間
├── NotionSkill実装
├── DriveSkill実装
├── MaterialMatchSkill実装
├── EditBriefAgent実装
├── 素材エンベディングパイプライン
└── E2Eテスト

Sprint 2（Tier 1 - 台本自動化）: 2週間
├── LLMSkill実装
├── TemplateSkill実装
├── ScriptAgent実装（注釈自動挿入含む）
├── RegulationAgent実装
└── E2Eテスト

Sprint 3（Tier 2 - 入稿/運用）: 2週間
├── MetaAdsSkill / TikTokAdsSkill実装
├── SubmissionAgent実装
├── OperationAgent実装
├── 広告データ取得パイプライン
├── CV計測連携
└── E2Eテスト

Sprint 4（制作パイプライン）: 2週間
├── PlanningAgent実装
├── AppealAgent実装
├── ResearchAgent実装
└── E2Eテスト

Sprint 5（動画生成 + レポート）: 2週間
├── RemotionSkill + テンプレート実装
├── VideoAgent実装
├── AnalysisAgent + ReportAgent実装
└── E2Eテスト

Sprint 6（オーケストレーション + 統合）: 2週間
├── WorkflowEngine実装
├── ApprovalSkill + SlackSkill実装
├── コミュニケーション自動取り込み実装
├── 全Phase統合テスト
├── Cloud Run / Cloud Schedulerデプロイ
└── 本番稼働開始
```

---

## 2. Sprint 0: 基盤構築

### 2.1 モノレポ初期化

```bash
mkdir ureru-buzz-ai && cd ureru-buzz-ai
pnpm init
pnpm add -D typescript turbo @types/node
mkdir -p packages/{core,orchestrator,agents,skills,remotion-project,api}/src
mkdir -p supabase/migrations docs
```

### 2.2 共通モジュール（packages/core）

```
packages/core/src/
├── config/
│   ├── env.ts           # 環境変数の型安全な読み込み（zod parse）
│   └── constants.ts     # 定数定義（フェーズ名、ステータス値等）
├── types/
│   ├── agent.ts         # BaseAgent, AgentInput, AgentOutput
│   ├── notion.ts        # Notion DBのプロパティ型定義
│   ├── supabase.ts      # Supabaseテーブルの型定義
│   ├── workflow.ts      # ワークフロー/承認関連型
│   └── ad-platform.ts   # 広告API共通型
├── errors/
│   └── index.ts         # カスタムエラークラス
├── logger/
│   └── index.ts         # 構造化ログ（JSON形式）
└── utils/
    ├── retry.ts         # exponential backoffリトライ
    ├── rate-limiter.ts  # Notion API等のレート制限管理
    ├── tenant.ts        # テナントID解決ユーティリティ
    └── notification.ts  # Slack + Notion両方への通知ヘルパー
```

### 2.3 Supabaseマイグレーション

全テーブル定義は技術要件書§2.3に準拠。以下の順序で実行：

```
001_create_tenants.sql          # テナント管理
002_create_ad_performance.sql   # 広告パフォーマンス
003_create_ad_demographics.sql  # 属性データ
004_create_creative_tags.sql    # クリエイティブタグ
005_create_knowledge_base.sql   # ナレッジ（pgvector有効化含む）
006_create_regulation_knowledge.sql
007_create_operation_rules.sql
008_create_material_embeddings.sql  # 素材エンベディング
009_create_operation_logs.sql
010_create_rls_policies.sql     # テナント分離RLS
```

### 2.4 Notion DBテンプレート

Notion APIで以下のデータベースを自動作成するスクリプトを用意（`scripts/setup-notion-dbs.ts`）：
- 案件DB、運用方針DB、リサーチDB、訴求DB、企画DB、台本DB
- 編集概要DB、素材DB、動画DB、入稿DB
- レギュレーションDB、発注/請求DB、目標管理DB、承認ログDB

---

## 3. Sprint 1: EditBriefAgent（MVP最優先）

### 3.1 NotionSkill

```
packages/skills/src/notion/
├── client.ts           # Notion APIクライアント（レート制限: p-queueで3req/秒）
├── database.ts         # DB操作（query, create, update）全操作にテナントフィルタ必須
├── page.ts             # ページ操作
├── properties.ts       # プロパティ型変換ヘルパー
└── index.ts
```

### 3.2 DriveSkill

```
packages/skills/src/drive/
├── client.ts           # Google Drive APIクライアント
├── files.ts            # ファイル操作
├── folders.ts          # テナント別フォルダ管理: /clients/{tenant_id}/materials/
├── dropbox.ts          # Dropbox共有リンクからのファイル取得
└── index.ts
```

### 3.3 MaterialMatchSkill（最重要スキル）

```
packages/skills/src/material-match/
├── matcher.ts          # メインマッチングロジック
├── embedding.ts        # エンベディング生成（テキスト + 映像）
├── frame-extractor.ts  # FFmpegフレーム抽出（2秒間隔）
├── scoring.ts          # 3軸スコアリング
└── index.ts
```

**マッチングロジック（matcher.ts）の処理フロー:**

```
入力: 台本（セクション分割済み） + テナントID

1. 利用可能素材の取得
   ├── Notion素材DBからクエリ
   ├── フィルタ: テナントの素材 + 汎用素材
   ├── 除外: ステータス=利用禁止
   └── 除外: 他テナントの提供素材

2. 各セクションごとにマッチング
   for each section in [hook, empathy, concept, product, benefit, offer, cta]:
     a. セクションテキストをエンベディング

     b. [軸1: 過去実績マッチ]
        - Supabase knowledge_baseから類似台本を検索
        - その台本で使用された素材IDを取得
        - 素材の使用実績スコアを計算

     c. [軸2: 市場データマッチ]
        - 動画広告分析Pro MCPでカテゴリ内の高再生数広告を取得
        - 類似セクションの素材パターンを抽出
        - 市場トレンドスコアを計算

     d. [軸3: コンテンツマッチ]
        - テキストエンベディング ↔ 素材テキストエンベディング（cosine類似度）
        - テキストエンベディング ↔ 素材映像エンベディング（CLIP cross-modal）
        - 具体マッチ検出: テキストのキーワード/シーン描写と素材概要の一致度
        - 具体マッチにはボーナススコア付与

     e. 総合スコア計算
        total = w1(0.3) * 過去実績 + w2(0.2) * 市場データ + w3(0.5) * コンテンツ
        ※具体マッチの場合: total += 0.3（ボーナス）

     f. 上位K件を候補として返却

出力: セクション × 素材候補（素材名, URL, サムネイル, スコア, 選定理由）
```

### 3.4 EditBriefAgent

```
packages/agents/src/edit-brief/
├── agent.ts            # メインエージェント
├── schemas.ts          # 入出力Zodスキーマ
├── prompts.ts          # LLMプロンプト
└── index.ts
```

**処理フロー:**

```
1. 台本DBから承認済み台本を取得
2. MaterialMatchSkillで素材自動選定（上記ロジック）
3. LLMでテロップ生成（台本テキスト → テロップ内容/スタイル/タイミング）
4. LLMでBGM選定（BGMライブラリDBから雰囲気/テンポでマッチング）
5. LLMでSE/ME選定（効果音ライブラリDBからシーンに合うSE選定）
6. LLMでカット割り生成（各セクションの秒数配分 + トランジション）
7. RegulationAgentでレギュチェック
8. 編集概要DBに登録（Notion）
9. Slack + Notionに承認依頼通知
```

---

## 4. Sprint 2: ScriptAgent + RegulationAgent

### 4.1 ScriptAgent

```
packages/agents/src/script/
├── agent.ts
├── schemas.ts
├── prompts/
│   ├── base.ts             # 基本台本生成プロンプト
│   ├── by-structure/       # 構成の型別プロンプト
│   │   ├── ugc.ts
│   │   ├── drama.ts
│   │   ├── anime.ts
│   │   ├── vlog.ts
│   │   ├── corporate.ts
│   │   └── ...
│   └── hook-variation.ts   # フックバリエーション生成
├── annotation.ts           # 注釈自動挿入
└── index.ts
```

**処理フロー:**

```
1. 企画DBから承認済み企画を取得
2. ナレッジDB検索: 過去の高効果台本パターンを取得
3. 構成の型に応じたプロンプトを選択
4. LLMで本編台本を生成（セクション分割）
5. 注釈自動挿入:
   a. レギュレーションDB（案件固有 + 共通）を取得
   b. 過去の同案件台本の注釈パターンを取得
   c. LLMで注釈必要箇所を検出（5つの判断基準）
   d. 注釈テキストを挿入
   e. 注釈漏れチェック → 漏れ候補をフラグ表示
6. フック3パターン生成（本編共通、フックのみ差し替え）
7. 文字数チェック（60秒以内）
8. RegulationAgent呼び出し（台本完成時チェック）
9. 台本DB × 3レコード登録
10. 承認依頼通知
```

**注釈の5つの判断基準（優先順位順）:**

```
1. クライアント固有レギュレーション（最優先）
2. 過去の同案件台本で注釈が入っていた類似箇所
3. 薬機法リスク（効果効能表現、体験談等）
4. 景表法リスク（価格表示、比較表現等）
5. 他案件でよくある注釈パターン
```

### 4.2 RegulationAgent

```
packages/agents/src/regulation/
├── agent.ts
├── checker.ts          # 台本/動画のチェックロジック
├── auto-updater.ts     # レギュ自動更新（コミュニケーション取り込みトリガー）
└── index.ts
```

**チェックタイミング:** 台本完成時 + 動画完成時の2回

---

## 5. Sprint 3: SubmissionAgent + OperationAgent

### 5.1 SubmissionAgent

```
packages/agents/src/submission/
├── agent.ts
├── platforms/
│   ├── meta.ts         # Meta入稿
│   ├── tiktok.ts       # TikTok入稿
│   ├── youtube.ts      # YouTube入稿
│   └── base.ts         # 共通インターフェース
└── index.ts
```

**入力:** 動画名のみ → 動画DB/企画DB/案件DBを逆引き → 入稿設定取得 → 各媒体APIで入稿

### 5.2 OperationAgent

```
packages/agents/src/operation/
├── agent.ts
├── rule-evaluator.ts   # ルール評価
├── data-fetcher.ts     # 広告データ取得（5分間隔当日/1時間間隔過去日）
├── cv-reconciler.ts    # CATS CV ↔ 実CV突合（EC Force等）
└── index.ts
```

### 5.3 広告データ取得パイプライン

```
packages/skills/src/meta-ads/
├── client.ts
├── fetcher.ts          # 指標定義に基づくデータ取得
├── parser.ts           # レスポンスパース + Gross/Net計算
└── index.ts

packages/skills/src/tiktok-ads/
├── (同構造)
```

**取得ルール:**
- 当日: 5分間隔、Cost >= 1円のデータのみ
- 過去日: 1時間間隔、直近7日分差分更新
- 属性データ: 日次バッチ、前日分（ad_demographicsテーブルに格納）
- Gross計算: 案件DBの手数料率を参照（媒体例外対応）

---

## 6. Sprint 4: PlanningAgent + AppealAgent + ResearchAgent

### 6.1 ResearchAgent

```
packages/agents/src/research/
├── agent.ts
├── sources/
│   ├── web-search.ts       # Web検索
│   ├── ad-library.ts       # Meta/TikTok広告ライブラリ
│   ├── sns.ts              # SNS情報収集
│   ├── video-analysis.ts   # 動画広告分析Pro MCP
│   └── client-docs.ts      # クライアント提供資料
├── structurer.ts           # リサーチシートの構造に合わせてデータ構造化
└── index.ts
```

### 6.2 AppealAgent

4訴求を自動提案。ナレッジDB（ベクトル検索）で過去の効果データを参照して提案精度を向上。

### 6.3 PlanningAgent

興味の型 × 構成の型を選定。4つの壁の仮説を自動生成。

---

## 7. Sprint 5: VideoAgent + ReportAgent

### 7.1 Remotionテンプレート

```
packages/remotion-project/src/
├── compositions/       # 構成の型別（11種類）
├── components/         # 共通コンポーネント
│   ├── MediaCut.tsx    # 素材表示（動画/画像自動切替）
│   ├── Subtitle.tsx    # テロップ（4スタイル: default/emphasis/question/impact）
│   ├── BGMTrack.tsx    # BGM制御
│   ├── SoundEffect.tsx # SE/ME
│   ├── Transition.tsx  # トランジション
│   └── Narration.tsx   # ナレーション音声
└── schemas/
    └── edit-brief-props.ts  # Zodスキーマ（技術要件書§5.2準拠）
```

### 7.2 AnalysisAgent

```
マクロ分析: 訴求軸 / 構成の型軸 → CPA × CV数
ミクロ分析:
  - フック → 2秒視聴率
  - 悩み/自分ごと化 → CVR
  - 商品コンセプト → CVR
  - ベネフィット → CVR
  - オファー → CVR
  - CTA → CTR
  - 視聴維持率 → パート別離脱率（相対的に高い箇所を検出）
```

### 7.3 ReportAgent

日次/週次/月次/CR/CRランキング/検証の6種類。Notion + Slack両方に通知。

---

## 8. Sprint 6: オーケストレーション + 統合

### 8.1 WorkflowEngine

9つの承認ポイントを持つフェーズ遷移エンジン。承認設定は案件ごとに柔軟変更可能。

### 8.2 コミュニケーション自動取り込み

```
packages/skills/src/communication/
├── chatwork-monitor.ts     # 1分間隔ポーリング
├── slack-monitor.ts        # 1分間隔ポーリング
├── gmail-monitor.ts        # 契約書等の添付ファイル
├── tldv-monitor.ts         # ミーティングサマリー + 全文リンク
├── link-resolver.ts        # Google Drive/Dropboxリンク解析
├── classifier.ts           # LLMベース分類（material/regulation/contract/strategy/feedback/unknown）
├── auto-registrar.ts       # 素材DB自動登録（AIメタデータ付与）
└── confirmation.ts         # 不確実な分類は担当者に確認（Slack DM）
```

### 8.3 デプロイ

```
Cloud Run: APIサーバー + オーケストレーター（min-instances=1で常時稼働）
Cloud Scheduler: 7つのcronジョブ登録
Remotion Lambda: 動画レンダリング
Supabase: DB + ベクトル検索
```

---

## 9. プロンプト設計方針

### 9.1 共通方針

- 出力: 必ずJSON Schema準拠の構造化出力
- コンテキスト: テナント固有情報（案件/レギュ/過去ナレッジ）を必ず注入
- フィードバック: 過去の承認/差し戻しコメントを含めて精度向上
- Few-shot: 過去の高品質出力例を提供

### 9.2 台本生成プロンプト構造

```
[システム指示] ← 役割定義
[案件コンテキスト] ← 案件名/コンセプト/WHO/WHAT/WHY
[企画情報] ← 興味の型/構成の型/4つの壁仮説
[レギュレーション] ← クライアント固有 + 共通ルール
[注釈ルール] ← 必須注釈箇所リスト
[過去の高効果台本例] ← ナレッジDB検索結果
[出力形式] ← JSON Schema
```

---

## 10. エラーハンドリング

### 10.1 リトライ戦略

| エラー種別 | リトライ | 最大回数 | バックオフ |
|---|---|---|---|
| APIレート制限（429） | ○ | 5回 | exponential（1s→16s） |
| サーバーエラー（5xx） | ○ | 3回 | exponential |
| タイムアウト | ○ | 2回 | 固定30秒 |
| 認証エラー（401/403） | × | - | 即アラート |
| バリデーションエラー | × | - | ログ + 人間介入 |
| LLM出力パースエラー | ○ | 3回 | 再プロンプト |

### 10.2 フォールバック

- リトライ上限到達 → Slack + Notionにアラート → 人間介入待ち
- 部分的成功 → 成功部分はDB保存、失敗部分のみ再実行可能
- 復旧後 → 失敗フェーズから再開（前フェーズやり直し不要）
