# 売れるBUZZ AI - 基本設計書

## 1. システムアーキテクチャ

### 1.1 全体構成

```
┌─────────────────────────────────────────────────────────┐
│                    フロントエンド                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Notion UI   │  │  独自UI      │  │  Slack Bot   │   │
│  │  (MVP/社内)   │  │  (SaaS化時)  │  │  (通知/承認)  │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
└─────────┼──────────────────┼──────────────────┼──────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼──────────┐
│         ▼                  ▼                  ▼          │
│  ┌─────────────────────────────────────────────────┐     │
│  │           オーケストレーター                       │     │
│  │    (ワークフローエンジン / 承認フロー管理)          │     │
│  └────────────────────┬────────────────────────────┘     │
│                       │                                  │
│  ┌────────┬───────────┼───────────┬────────┬──────┐     │
│  ▼        ▼           ▼           ▼        ▼      ▼     │
│ ┌────┐ ┌────┐     ┌────┐     ┌────┐  ┌────┐ ┌────┐    │
│ │研究│ │訴求│     │企画│     │台本│  │編集│ │動画│    │
│ │Agent│ │Agent│    │Agent│    │Agent│ │Agent│ │Agent│   │
│ └──┬─┘ └──┬─┘     └──┬─┘     └──┬─┘  └──┬─┘ └──┬─┘    │
│    │      │           │           │       │      │       │
│ ┌────┐ ┌────┐     ┌────┐     ┌────┐  ┌────┐ ┌────┐    │
│ │入稿│ │運用│     │分析│     │レポ│  │レギュ│ │管理│   │
│ │Agent│ │Agent│    │Agent│    │Agent│ │Agent│ │Agent│   │
│ └──┬─┘ └──┬─┘     └──┬─┘     └──┬─┘  └──┬─┘ └──┬─┘    │
│    │      │           │           │       │      │       │
│  ┌─┴──────┴───────────┴───────────┴───────┴──────┴─┐    │
│  │              スキルレイヤー                        │    │
│  │  (共通スキル: LLM呼出/テンプレ/検索/通知/承認)     │    │
│  └────────────────────┬────────────────────────────┘    │
│                       │                                  │
│         バックエンド / エージェントレイヤー                │
└───────────────────────┼──────────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────────┐
│                       ▼                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Notion   │  │ Supabase │  │ BigQuery │  │ Google   │ │
│  │ (UI/承認)│  │ +pgvector│  │ (長期    │  │ Drive    │ │
│  │          │  │ (既存統合)│  │  蓄積)   │  │ (素材)   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Meta Ads │  │ TikTok   │  │ YouTube  │  │ Vertex AI│ │
│  │ API      │  │ Ads API  │  │ Ads API  │  │(Embedding│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│                                                          │
│                  データ / 外部サービス                     │
└──────────────────────────────────────────────────────────┘
```

### 1.2 レイヤー構成

| レイヤー | 役割 | 技術 |
|---|---|---|
| フロントエンド | UI・承認・通知 | Notion（MVP）→ 独自UI（SaaS化）、Slack |
| オーケストレーター | ワークフロー制御・承認管理・フェーズ遷移 | Claude Agent SDK / カスタム |
| エージェントレイヤー | 各フェーズの実行ロジック | 専門エージェント × 12 |
| スキルレイヤー | エージェントが使う共通機能 | LLM / テンプレート / API連携 |
| データレイヤー | 永続化・検索・外部API | Supabase+pgvector（既存統合）/ BigQuery / Notion / Google Drive / Vertex AI / 広告API |

---

## 2. エージェント設計

### 2.1 エージェント一覧

| # | エージェント名 | 入力 | 出力 | 依存 |
|---|---|---|---|---|
| 1 | **SetupAgent** | 案件情報（AP/MP入力） | 案件データベースレコード | なし |
| 2 | **ResearchAgent** | 案件情報 + コンセプト | リサーチデータ（構造化） | SetupAgent |
| 3 | **AppealAgent** | リサーチデータ + コンセプト | 訴求案（月4件） | ResearchAgent |
| 4 | **PlanningAgent** | 訴求 + 興味の型/構成の型 | 広告企画（構成/FV/仮説） | AppealAgent |
| 5 | **ScriptAgent** | 広告企画 | 台本テキスト + 3フックバリエーション | PlanningAgent |
| 6 | **EditBriefAgent** | 台本 + 素材リスト | 編集概要（カット/テロップ/BGM/SE全指定） | ScriptAgent |
| 7 | **VideoAgent** | 編集概要 | Remotionプロジェクト → 完成動画 | EditBriefAgent |
| 8 | **SubmissionAgent** | 動画名 + 入稿設定 | 各媒体への入稿 + Slack通知 | VideoAgent |
| 9 | **OperationAgent** | 広告パフォーマンスデータ | 拡大/継続/停止/縮小判断 + 実行 | SubmissionAgent |
| 10 | **AnalysisAgent** | 広告データ + 動画タグ | マクロ/ミクロ分析結果 | OperationAgent |
| 11 | **ReportAgent** | 分析結果 | 日次/週次/月次/CR/検証レポート | AnalysisAgent |
| 12 | **RegulationAgent** | 台本/動画 + レギュレーションDB | 懸念事項リスト + 修正提案 | 横断（Phase 5-7で起動） |
| 13 | **ChatAgent** | 自然言語の質問 | 回答（配信結果/ナレッジ/訴求相談） | 横断（常時利用可能） |

### 2.1.1 AIチャット機能（ChatAgent）

```
展開ロードマップ:
├── MVP: Notion上のAIチャット（Notionページ内で質問→回答）
├── Phase 2: Slack Bot（Slackで@bot 質問→回答）
└── SaaS化: 独自UIでチャットインターフェース

機能:
├── 配信結果の確認（「この案件のCPAは？」「今週のCV数は？」）
│   └── Supabase/BQから広告データを取得して回答
├── 訴求開発・広告企画の相談（「この訴求の改善案は？」）
│   └── ナレッジDB（pgvector）から類似事例を検索して提案
├── 過去ナレッジの確認（「前回効果が高かったフックは？」）
│   └── ナレッジDB（pgvector）からベクトル検索
└── レギュレーション確認（「この表現は使える？」）
    └── レギュレーションDB（pgvector）から検索
```

### 2.2 オーケストレーター

```
OrchestratorAgent
├── ワークフロー状態管理
│   ├── 現在のフェーズ
│   ├── 各フェーズのステータス（未開始/実行中/承認待ち/完了）
│   └── 担当者情報
├── 承認フロー管理
│   ├── 承認依頼の送信（Notion + Slack通知）
│   ├── 承認状態の監視
│   └── 承認後の次フェーズ起動
├── エラーハンドリング
│   ├── リトライロジック
│   ├── フォールバック（人間介入依頼）
│   └── アラート通知
└── スケジューリング
    ├── 運用Agent: 5分間隔
    ├── レポートAgent: 日次/週次/月次
    └── レギュレーションAgent: 台本/動画完成時
```

---

## 3. データモデル

### 3.1 Notionデータベース構成

```
[テナント（案件）]
    │
    ├── [基本情報] ── 1:1
    │       体制/担当者、背景/目的、KPI/予算
    │
    ├── [運用方針] ── 1:N（媒体別）
    │       キャンペーン構造、検証期/拡大期ルール
    │
    ├── [リサーチ] ── 1:1
    │       商品理解、セグメント分析、市場競合、既存顧客、N1インタビュー
    │
    ├── [訴求] ── 1:N
    │   │   訴求No.、訴求名、WHO/WHAT/WHY、USP、差別化軸
    │   │
    │   └── [広告企画] ── 1:N
    │       │   企画名、興味の型、構成の型、FV、構成、企画仮説
    │       │
    │       └── [台本] ── 1:1
    │           │   台本テキスト（セクション別）、文字数
    │           │
    │           ├── [フックバリエーション] ── 1:N（通常3）
    │           │       フックテキスト、興味の型
    │           │
    │           └── [編集概要] ── 1:1
    │               │   カット割、テロップ、BGM、SE、ME、エフェクト
    │               │
    │               └── [動画] ── 1:1
    │                       動画URL、ステータス、入稿先
    │
    ├── [素材ライブラリ] ── 1:N
    │       素材名、形式、ジャンル、URL、ステータス、登場人物
    │       ※汎用素材は全テナントからリレーション可
    │       ※クライアント提供/利用禁止はフラグ管理
    │
    ├── [レギュレーション] ── 1:N
    │       チェック日、確認物、可否、コメント、修正ナレッジ
    │
    ├── [広告パフォーマンス] ── Supabaseに格納（後述）
    │
    ├── [発注/納品管理] ── 1:N
    │       商品名、担当、項目分類、進捗、費用、日程
    │
    ├── [目標管理] ── 1:N（月別）
    │       目標/進捗/見込み/達成率 × CV/COST/CPA
    │
    └── [承認ログ] ── 1:N
            フェーズ、承認者、承認日時、コメント
```

### 3.2 Supabaseテーブル構成（パフォーマンスデータ + ベクトル検索）

```sql
-- テナント管理
tenants (
    id UUID PK,
    name TEXT,
    notion_workspace_id TEXT,
    created_at TIMESTAMP
)

-- 広告パフォーマンスデータ（高頻度書き込み）
ad_performance (
    id UUID PK,
    tenant_id UUID FK,
    platform TEXT,           -- meta/tiktok/youtube/line/x
    campaign_id TEXT,
    adgroup_id TEXT,
    ad_id TEXT,
    creative_name TEXT,
    date DATE,
    hour INT,
    impressions INT,
    clicks INT,
    conversions_gross INT,
    conversions_net INT,
    cost DECIMAL,
    ctr DECIMAL,
    cvr DECIMAL,
    cpa_gross DECIMAL,
    cpa_net DECIMAL,
    video_views_25 INT,
    video_views_50 INT,
    video_views_75 INT,
    video_views_100 INT,
    created_at TIMESTAMP
)

-- クリエイティブタグ（分析用）
creative_tags (
    id UUID PK,
    tenant_id UUID FK,
    creative_name TEXT,
    concept TEXT,             -- コンセプト
    appeal_name TEXT,         -- 訴求名
    interest_type TEXT,       -- 興味の型
    structure_type TEXT,      -- 構成の型
    hook_text TEXT,           -- フックテキスト
    duration_seconds INT,
    created_at TIMESTAMP
)

-- ナレッジベース（ベクトル検索用）
knowledge_base (
    id UUID PK,
    tenant_id UUID FK,        -- NULLなら全テナント共通
    category TEXT,            -- appeal/structure_type/interest_type/hook/composition/cut
    content TEXT,             -- ナレッジ内容
    performance_score DECIMAL,-- 効果スコア
    embedding VECTOR(3072),   -- ベクトル埋め込み
    metadata JSONB,           -- 追加メタデータ
    created_at TIMESTAMP
)

-- レギュレーションナレッジ
regulation_knowledge (
    id UUID PK,
    tenant_id UUID FK,        -- NULLなら全テナント共通（薬機法等）
    category TEXT,            -- word/concept
    rule_type TEXT,           -- yakujiho/keihinhou/platform/client_specific
    ng_expression TEXT,       -- NG表現
    ok_alternative TEXT,      -- OK代替表現
    reason TEXT,              -- 理由
    embedding VECTOR(3072),
    created_at TIMESTAMP
)

-- 運用ルール（5分間隔判断用）
operation_rules (
    id UUID PK,
    tenant_id UUID FK,
    platform TEXT,
    rule_type TEXT,           -- stop/continue/expand/shrink
    condition JSONB,          -- {"metric": "cpa", "operator": ">=", "value": 1, "cv_threshold": 0}
    action JSONB,             -- {"type": "pause_ad", "notify": true}
    priority INT,
    enabled BOOLEAN,
    created_at TIMESTAMP
)
```

### 3.3 マルチテナント分離

```
データ格納方針:
├── MVP: Notion = データ格納 + UI（人間が直接編集可能）
│   └── 完全自動化できるまでは人間の手動修正が必要なため
├── SaaS化: Supabase = データ格納（RLS完全分離）+ 独自UI
│   └── Notionからの移行時にデータエクスポート
└── 常にSupabaseに格納するデータ:
    ├── 広告パフォーマンスデータ（高頻度書き込み）
    ├── ベクトル検索用データ（ナレッジ/素材/レギュ）
    ├── 運用ルール/ログ（5分間隔判断）
    └── BQ長期蓄積データ

テナント分離戦略:
├── Notion: NotionSkillの全メソッドでtenant_idフィルタを構造的に強制
│   └── フィルタなしクエリはエラー。全DBにtenant_idプロパティ付与
├── Supabase: Row Level Security (RLS) でテナント分離
│   └── 全テーブルに tenant_id カラム + RLSポリシー
├── Google Drive: テナント別フォルダ構造
│   └── /clients/{tenant_id}/materials/
└── 素材: ステータスフラグで利用制限
    ├── general: 全テナント利用可
    ├── client_provided: 当該テナントのみ
    └── prohibited: 全テナント利用不可
```

---

## 4. スキル設計

### 4.1 共通スキル

| スキル名 | 機能 | 使用エージェント |
|---|---|---|
| **LLMSkill** | LLM呼び出し（プロンプト実行） | 全エージェント |
| **NotionSkill** | Notionデータベース読み書き | 全エージェント |
| **SupabaseSkill** | Supabaseクエリ・ベクトル検索 | Analysis/Report/Knowledge系 |
| **DriveSkill** | Google Drive素材操作 | EditBrief/Video |
| **SlackSkill** | Slack通知・承認依頼 | Orchestrator/Submission |
| **ApprovalSkill** | 承認フロー管理（Notion承認ボタン） | Orchestrator |
| **TemplateSkill** | テンプレート適用・構造化出力 | Script/EditBrief/Report |
| **WebSearchSkill** | Web検索・情報収集 | Research |
| **AdLibrarySkill** | 広告ライブラリ検索 | Research |
| **SNSSearchSkill** | SNS情報収集 | Research |

### 4.2 専門スキル

| スキル名 | 機能 | 使用エージェント |
|---|---|---|
| **MetaAdsSkill** | Meta Ads API操作 | Submission/Operation/Analysis |
| **TikTokAdsSkill** | TikTok Ads API操作 | Submission/Operation/Analysis |
| **YouTubeAdsSkill** | YouTube Ads API操作 | Submission/Operation/Analysis |
| **RemotionSkill** | Remotionプロジェクト生成・レンダリング | Video |
| **TTSSkill** | テキスト音声変換 | Video |
| **MaterialMatchSkill** | 台本テキスト→素材マッチング | EditBrief |
| **RegulationCheckSkill** | レギュレーション自動チェック | Regulation |
| **PerformanceCalcSkill** | KPI計算・判断ロジック | Operation/Analysis |
| **ChartSkill** | グラフ・チャート生成 | Report |
| **GanttSkill** | ガントチャート生成・更新 | 管理系 |

---

## 5. 承認フロー設計

### 5.1 承認ポイント一覧

| # | フェーズ | 承認対象 | デフォルト承認者 | 柔軟性 |
|---|---|---|---|---|
| 1 | リサーチ完了 | リサーチデータ | CP | 変更可 |
| 2 | コンセプト決定 | コンセプト選択 | CP + AP | 変更可 |
| 3 | 訴求開発完了 | 訴求案 | CP | 変更可 |
| 4 | 広告企画完了 | 企画内容 | CP | 変更可 |
| 5 | 台本完了 | 台本テキスト | CP + CD | 変更可 |
| 6 | 編集概要完了 | 編集指示 | CD | 変更可 |
| 7 | 動画完成 | 完成動画 | CD + クライアント | 変更可 |
| 8 | 入稿前 | 入稿内容 | MP | 変更可 |
| 9 | 運用判断 | 拡大/停止判断 | MP | 変更可 |

### 5.2 承認フローの実装

```
承認リクエスト発行
├── Notionデータベースに承認レコード作成
│   ├── ステータス: 承認待ち
│   ├── 承認者: 事前設定された担当者
│   ├── 対象データへのリンク
│   └── 承認ボタン（Notionのセレクトプロパティ: 承認/差し戻し）
├── Slack通知
│   ├── 承認依頼メッセージ
│   ├── 対象内容のサマリー
│   └── Notionリンク
└── 承認状態の監視（ポーリング or Webhook）
    ├── 承認 → 次フェーズ起動
    └── 差し戻し → 該当エージェント再実行（コメント付き）
```

### 5.3 承認設定の柔軟な変更

```json
// 案件ごとの承認設定（Notionデータベース）
{
  "tenant_id": "xxx",
  "approval_config": [
    {
      "phase": "research",
      "approvers": ["user_id_1"],
      "required": true,
      "auto_approve_after_hours": null  // nullは自動承認なし
    },
    {
      "phase": "script",
      "approvers": ["user_id_1", "user_id_2"],
      "required": true,
      "auto_approve_after_hours": 24    // 24時間後に自動承認
    }
  ]
}
```

---

## 6. PDCAループ設計

### 6.1 評価軸の整理

**最重要KPI: CPA × CV数**

| 分析軸 | 評価指標 | 粒度 |
|---|---|---|
| **訴求軸** | CPA / CV数 | 訴求単位で「CPAいくらで何CV獲得できたか」 |
| **構成の型軸** | CPA / CV数 | UGC/ドラマ/アニメ等の型単位 |
| **興味の型（フック）軸** | 2秒視聴率 | 商品興味/エピソード興味等のフック単位 |

**構成要素別の評価指標:**

| 構成要素 | 重要指標 | 理由 |
|---|---|---|
| フック | 2秒視聴率 | 見ない壁を超えられているか |
| 悩み/自分ごと化 | CVR | 自分ごと化の壁を超えられているか |
| 商品コンセプト | CVR | 信じない壁を超えられているか |
| ベネフィット | CVR | 信じない壁を超えられているか |
| オファー | CVR | 行動しない壁を超えられているか |
| CTA | CTR | 実際にクリックさせられているか |

**視聴維持率分析:**
- 各パート（フック/自分ごと化/コンセプト/商品紹介/ベネフィット/オファー/CTA）ごとの離脱率を測定
- 相対的に離脱率が高いパートを自動検出
- 該当パートの振り返りタスクを自動生成

### 6.2 データフロー

```
[制作] ──タグ付け──→ [入稿] ──配信データ──→ [分析]
                                                │
                ┌───────────────────────────────┘
                ▼
        [ナレッジ蓄積]（3軸 + 構成要素別 + 視聴維持率）
         ├── 訴求軸: この訴求はCPA◯円で◯CV獲得
         ├── 構成の型軸: UGC型はCPA◯円、ドラマ型はCPA◯円
         ├── 興味の型（フック）軸: 商品興味フックは2秒視聴率◯%
         ├── 構成要素別:
         │    ├── フック: 2秒視聴率◯%
         │    ├── 悩み/自分ごと化: CVR◯%
         │    ├── 商品コンセプト: CVR◯%
         │    ├── ベネフィット: CVR◯%
         │    ├── オファー: CVR◯%
         │    └── CTA: CTR◯%
         └── 視聴維持率: パートXで離脱率が相対的に◯%高い → 要改善
                │
                ▼
        [次サイクルへフィードバック]
         ├── AppealAgent: 効果データに基づく訴求提案（CPA×CV軸）
         ├── PlanningAgent: 効果の高い構成の型の優先提案
         ├── ScriptAgent:
         │    ├── 効果の高い興味の型のフック活用（2秒視聴率軸）
         │    ├── CVR改善のための構成要素改善
         │    └── 離脱率が高いパートの重点改善
         └── EditBriefAgent: 効果の高い素材/編集パターンの活用
```

### 6.2 検証サイクル

| サイクル | 期間 | 内容 |
|---|---|---|
| 短期 | 1週間 | クリエイティブ単位の効果検証、フック/構成のA/Bテスト |
| 中期 | 1ヶ月 | 訴求別/型別のパフォーマンス評価、次月の訴求開発方針 |
| 長期 | 3ヶ月 | コンセプト/市場全体のトレンド分析、戦略見直し |

### 6.3 自動改善フロー

```
Phase 1 (MVP): 人間がレポートを見て次の指示を出す
    ↓
Phase 2: AIが改善案を提案、人間が承認
    ↓
Phase 3: AIがセルフフィードバック、人間は結果を確認するのみ
    ↓
Phase 4: 完全自動（異常時のみ人間にアラート）
```

---

## 7. 通知設計

### 7.1 Slack通知一覧

| イベント | チャンネル/DM | 内容 |
|---|---|---|
| 承認依頼 | 担当者DM + Notion | 「[案件名] 台本が完成しました。確認をお願いします」+ Notionリンク |
| 承認完了 | プロジェクトch + Notion | 「[案件名] 台本が承認されました。編集概要の生成を開始します」 |
| 差し戻し | 担当者DM + Notion | 「[案件名] 台本が差し戻されました。コメント: ◯◯」 |
| 入稿完了 | プロジェクトch + Notion | 「[案件名] Meta/TikTokに入稿完了。CR名: ◯◯」 |
| 運用判断 | 運用ch + Notion | 「[案件名] ◯◯を停止しました（CPA×1でCV0）」 |
| レポート完成 | プロジェクトch + Notion | 「[案件名] 週次レポートが完成しました」+ Notionリンク |
| エラー/異常 | アラートch + Notion | 「[案件名] ◯◯エージェントでエラーが発生しました」 |

※すべての通知はSlackとNotionの両方に送信される

---

## 8. 既存システムとの統合

### 8.1 既存システムとの統合方針

```
基本方針:
  - DB構造が異なるものは無理に統合しない
  - 効率的な場合のみ統合する
  - 新システムのDB設計を優先し、既存データは移行で対応

video-material-selector:
  → DB構造が異なるため統合しない
  → 素材管理は新しいNotion素材DBで再設計
  → 必要な素材データのみ移行
```

### 8.2 データ移行

```
スプレッドシート → Notion
├── 制作管理シート（動画制作管理等） → Notion 制作DB（動画DB）
├── 進行管理シート → Notion 案件DB + スケジュールDB
├── 全体管理シート → Notion 入稿DB + Supabase パフォーマンスDB
└── 段階的移行（並行運用期間あり）
```
