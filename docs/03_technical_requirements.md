# 売れるBUZZ AI - 技術要件書

## 1. 技術スタック

### 1.1 コアランタイム

| 技術 | バージョン | 用途 |
|---|---|---|
| Node.js | 20 LTS | エージェント実行環境 |
| TypeScript | 5.x | 全コードベースの型安全性 |
| pnpm | 9.x | パッケージマネージャー |

### 1.2 フレームワーク・ライブラリ

| 技術 | 用途 | 選定理由 |
|---|---|---|
| Claude Agent SDK | エージェントオーケストレーション | Anthropic公式SDK、ツール定義・エージェント間連携 |
| Claude API (claude-sonnet-4-20250514) | LLM推論 | 台本/企画生成、分析、レギュチェック |
| Remotion | 動画自動生成 | React製、コードベースで動画編集可能、API経由レンダリング |
| Hono | 軽量APIサーバー | Webhook受信、cron実行、ヘルスチェック |
| Zod | スキーマバリデーション | エージェント入出力の型安全性 |
| Bullmq + Redis | ジョブキュー | 非同期タスク管理（運用5分間隔、レポート生成等） |

### 1.3 データストア

| 技術 | 用途 | 選定理由 |
|---|---|---|
| Notion API | 構造化データ管理（MVP UI） | 人間が見る/編集/承認するデータ。Notion MCPは使わず、SDK直接操作 |
| Supabase (PostgreSQL + pgvector) | マスターデータ、リアルタイム運用判断、ベクトル検索 | 既存Ad Orchestration（ozhldqebkxxkctmrfngq）に統合。RLS、pgvectorネイティブ |
| BigQuery | 広告パフォーマンスデータの長期蓄積・大規模分析 | 将来100社+スケール対応。MVP段階からコストほぼゼロで流しておく |
| Vertex AI | エンベディング生成（Gemini Embedding等） | 生成したベクトルはpgvectorに格納して検索。モデル選択の自由度 |
| Redis | キャッシュ、ジョブキュー | セッション管理、レート制限 |
| Google Drive API | 素材ファイル管理 | 既存運用との継続性 |

### 1.4 外部API

| API | 用途 | 認証方式 |
|---|---|---|
| Notion API | DB操作（CRUD） | Bearer Token (Internal Integration) |
| Meta Marketing API | 入稿/運用/レポート | OAuth 2.0 (Long-lived Token) |
| TikTok Marketing API | 入稿/運用/レポート | OAuth 2.0 (Access Token) |
| Google Ads API | YouTube入稿/運用/レポート | OAuth 2.0 |
| Slack Web API | 通知/承認依頼 | Bot Token |
| Google Drive API | 素材読み取り/書き込み | OAuth 2.0 |
| Remotion Lambda / Cloud Run | 動画レンダリング | API Key |
| TTS API（候補: ElevenLabs / VOICEVOX / OpenAI TTS） | ナレーション生成 | API Key |
| Web Search API | リサーチ用検索 | API Key |
| 動画広告分析Pro API/MCP | 市場データ・競合広告分析 | API Key |
| Chatwork API | クライアントコミュニケーション監視 | API Token |
| Dropbox API | クライアント素材共有の取得 | OAuth 2.0 |
| CATS API（or 自社CV計測基盤） | CV計測・媒体へのCV返送 | API Key |
| EC Force API等 | 実CV数取得 | API Key（案件別） |
| BigQuery API | 広告データ長期蓄積・大規模分析 | Service Account |
| Vertex AI API | エンベディング生成（Gemini Embedding） | Service Account |

### 1.5 インフラ（常時稼働設計 - PC閉じても動く）

```
┌─────────────────────────────────────────────┐
│           GCP Cloud Run（常時稼働）           │
│  ├── APIサーバー（Hono）                     │
│  ├── オーケストレーター                       │
│  └── エージェント実行環境                     │
├─────────────────────────────────────────────┤
│           Cloud Scheduler（cron）            │
│  ├── */5 * * * *  → 運用チェック + 当日広告データ取得│
│  ├── 0 * * * *    → 過去日広告データ取得      │
│  ├── */1 * * * *  → 承認ポーリング            │
│  ├── */1 * * * *  → コミュニケーション監視     │
│  ├── 0 9 * * *    → 日次レポート              │
│  ├── 0 9 * * 1    → 週次レポート              │
│  └── 0 9 1 * *    → 月次レポート              │
├─────────────────────────────────────────────┤
│           Upstash Redis（サーバーレス）       │
│  └── ジョブキュー + キャッシュ                │
├─────────────────────────────────────────────┤
│           Supabase                           │
│  └── PostgreSQL + pgvector + RLS             │
├─────────────────────────────────────────────┤
│           Remotion Lambda                    │
│  └── 動画レンダリング（オンデマンド）         │
└─────────────────────────────────────────────┘
→ PCを閉じても24時間365日稼働
→ Cloud Runの最小インスタンス数=1で常時起動
```

---

## 2. プロジェクト構成

### 2.1 モノレポ構成

```
ureru-buzz-ai/
├── docs/                          # ドキュメント
├── packages/
│   ├── core/                      # コア共通モジュール
│   │   └── src/
│   │       ├── config/            # 環境設定・定数
│   │       ├── types/             # 共通型定義
│   │       ├── errors/            # エラー定義
│   │       ├── logger/            # ログ出力
│   │       └── utils/             # ユーティリティ
│   │
│   ├── orchestrator/              # オーケストレーター
│   │   └── src/
│   │       ├── workflow-engine.ts  # ワークフロー制御
│   │       ├── approval-manager.ts # 承認フロー管理
│   │       ├── scheduler.ts       # スケジューラー（cron/interval）
│   │       └── event-bus.ts       # イベントバス
│   │
│   ├── agents/                    # エージェント群
│   │   └── src/
│   │       ├── setup/             # SetupAgent
│   │       ├── research/          # ResearchAgent
│   │       ├── appeal/            # AppealAgent
│   │       ├── planning/          # PlanningAgent
│   │       ├── script/            # ScriptAgent
│   │       ├── edit-brief/        # EditBriefAgent（MVP最優先）
│   │       ├── video/             # VideoAgent
│   │       ├── submission/        # SubmissionAgent
│   │       ├── operation/         # OperationAgent
│   │       ├── analysis/          # AnalysisAgent
│   │       ├── report/            # ReportAgent
│   │       └── regulation/        # RegulationAgent
│   │
│   ├── skills/                    # スキル群
│   │   └── src/
│   │       ├── llm/               # LLMSkill（Claude API呼び出し）
│   │       ├── notion/            # NotionSkill（DB操作）
│   │       ├── supabase/          # SupabaseSkill（クエリ/ベクトル検索）
│   │       ├── drive/             # DriveSkill（Google Drive操作）
│   │       ├── slack/             # SlackSkill（通知）
│   │       ├── approval/          # ApprovalSkill（承認管理）
│   │       ├── template/          # TemplateSkill（構造化出力）
│   │       ├── web-search/        # WebSearchSkill
│   │       ├── ad-library/        # AdLibrarySkill
│   │       ├── meta-ads/          # MetaAdsSkill
│   │       ├── tiktok-ads/        # TikTokAdsSkill
│   │       ├── youtube-ads/       # YouTubeAdsSkill
│   │       ├── remotion/          # RemotionSkill
│   │       ├── tts/               # TTSSkill
│   │       ├── material-match/    # MaterialMatchSkill
│   │       ├── regulation-check/  # RegulationCheckSkill
│   │       └── performance-calc/  # PerformanceCalcSkill
│   │
│   ├── remotion-project/          # Remotion動画テンプレート
│   │   └── src/
│   │       ├── compositions/      # 構成の型別テンプレート
│   │       │   ├── ugc.tsx
│   │       │   ├── drama.tsx
│   │       │   ├── anime.tsx
│   │       │   ├── vlog.tsx
│   │       │   ├── corporate.tsx
│   │       │   ├── illustration.tsx
│   │       │   └── banner-video.tsx
│   │       ├── components/        # 共通コンポーネント
│   │       │   ├── Subtitle.tsx   # テロップ
│   │       │   ├── BGM.tsx
│   │       │   ├── SoundEffect.tsx
│   │       │   └── Transition.tsx
│   │       └── schemas/           # 編集概要→Remotion変換スキーマ
│   │
│   └── api/                       # APIサーバー
│       └── src/
│           ├── routes/
│           │   ├── webhook.ts     # Notion/Slack Webhook
│           │   ├── health.ts
│           │   └── trigger.ts     # 手動トリガー
│           └── middleware/
│               ├── auth.ts
│               └── tenant.ts      # テナント解決
│
├── supabase/                      # Supabase設定
│   ├── migrations/                # マイグレーション
│   └── seed.sql
│
├── docker-compose.yml             # ローカル開発用（Redis + Supabase）
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

### 2.2 環境変数

```env
# Claude API
ANTHROPIC_API_KEY=

# Notion
NOTION_API_KEY=
NOTION_WORKSPACE_ID=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=

# Slack
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=

# Meta Ads
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=

# TikTok Ads
TIKTOK_ACCESS_TOKEN=
TIKTOK_ADVERTISER_ID=

# Remotion
REMOTION_SERVE_URL=

# TTS
TTS_API_KEY=
TTS_PROVIDER=elevenlabs  # elevenlabs / voicevox / openai

# Redis
REDIS_URL=redis://localhost:6379
```

---

## 3. Notion API制約と設計上の考慮事項

### 3.1 主要制約

| 制約 | 詳細 | 対策 |
|---|---|---|
| レート制限 | 3リクエスト/秒（Integration単位） | リクエストキューイング + exponential backoff |
| ページサイズ | 1リクエストで100件まで | ページネーション対応 |
| ブロック数制限 | 1ページあたり最大1000ブロック | 大きなデータはSupabaseに格納 |
| リッチテキスト | 1ブロックあたり2000文字まで | 台本は分割格納 or Supabase |
| Webhook | 公式Webhookなし（2026年3月時点） | ポーリング（30秒間隔）で代替 |
| フィルタ | 複雑なクエリは非対応 | Supabaseで複雑クエリを処理 |
| ファイル | URLは1時間で期限切れ | Google Driveを永続ストレージとして使用 |

### 3.2 Notion vs Supabaseの使い分け

| データ種別 | 格納先 | 理由 |
|---|---|---|
| 案件/訴求/企画/台本/編集概要 | **Notion** | 人間が閲覧・編集・承認するデータ |
| 素材リスト | **Notion** | 人間が管理・選択するデータ |
| レギュレーション | **Notion** | 人間が確認・更新するデータ |
| 発注/納品/スケジュール | **Notion** | 人間が閲覧するデータ |
| 目標管理 | **Notion** | 人間が閲覧するデータ |
| 広告パフォーマンスデータ | **Supabase** | 高頻度書き込み（5分間隔×複数媒体×複数広告） |
| クリエイティブタグ | **Supabase** | 分析クエリ（集計/結合）が多い |
| ナレッジベース | **Supabase** | ベクトル検索が必要 |
| レギュレーションナレッジ | **Supabase** | ベクトル検索が必要 |
| 運用ルール・ログ | **Supabase** | 5分間隔の高速判断 |

### 3.3 Notionポーリング設計

```typescript
// 承認状態の監視（Webhookが無いため）
const POLLING_INTERVAL = 30_000; // 30秒

async function pollApprovalStatus() {
  const pendingApprovals = await notion.databases.query({
    database_id: APPROVAL_DB_ID,
    filter: {
      property: "承認ステータス",
      select: { equals: "承認待ち" }
    }
  });

  for (const approval of pendingApprovals.results) {
    const status = getProperty(approval, "承認ステータス");
    if (status === "承認済") {
      await orchestrator.onApproved(approval);
    } else if (status === "差し戻し") {
      await orchestrator.onRejected(approval);
    }
  }
}
```

---

## 4. エージェント技術仕様

### 4.1 共通インターフェース

```typescript
import { z } from "zod";

interface AgentInput<T> {
  tenantId: string;
  data: T;
  context?: Record<string, unknown>;
}

interface AgentOutput<T> {
  success: boolean;
  data?: T;
  error?: string;
  notionPageIds?: string[];
  nextPhase?: string;
  notifications?: NotificationPayload[];
}

abstract class BaseAgent<TInput, TOutput> {
  abstract name: string;
  abstract inputSchema: z.ZodSchema<TInput>;
  abstract outputSchema: z.ZodSchema<TOutput>;

  abstract execute(input: AgentInput<TInput>): Promise<AgentOutput<TOutput>>;

  protected async notifySlackAndNotion(payload: NotificationPayload): Promise<void> { ... }
  protected async updateApprovalStatus(pageId: string, status: string): Promise<void> { ... }
  protected async logExecution(result: AgentOutput<TOutput>): Promise<void> { ... }
}
```

### 4.2 オーケストレーター仕様

```typescript
const WORKFLOW_PHASES = [
  { id: "setup",      agent: "SetupAgent",      requiresApproval: true },
  { id: "research",   agent: "ResearchAgent",    requiresApproval: true },
  { id: "appeal",     agent: "AppealAgent",      requiresApproval: true },
  { id: "planning",   agent: "PlanningAgent",    requiresApproval: true },
  { id: "script",     agent: "ScriptAgent",      requiresApproval: true },
  { id: "edit_brief", agent: "EditBriefAgent",   requiresApproval: true },
  { id: "video",      agent: "VideoAgent",       requiresApproval: true },
  { id: "submission", agent: "SubmissionAgent",   requiresApproval: true },
  { id: "operation",  agent: "OperationAgent",   requiresApproval: true },
] as const;

class WorkflowEngine {
  async onApproved(phaseId: string, tenantId: string): Promise<void> {
    const currentIndex = WORKFLOW_PHASES.findIndex(p => p.id === phaseId);
    const nextPhase = WORKFLOW_PHASES[currentIndex + 1];

    if (!nextPhase) {
      await this.startReportingCycle(tenantId);
      return;
    }

    const agent = this.getAgent(nextPhase.agent);
    const previousData = await this.getPreviousPhaseData(phaseId, tenantId);
    const result = await agent.execute({ tenantId, data: previousData });

    if (result.success && nextPhase.requiresApproval) {
      await this.requestApproval(nextPhase.id, tenantId, result);
    }
  }
}
```

### 4.3 スケジューラー仕様

```typescript
import { Queue, Worker } from "bullmq";

const schedules = {
  "operation-check":  { cron: "*/5 * * * *",   description: "運用自動化: 5分間隔" },
  "fetch-ad-data":    { cron: "0 * * * *",      description: "広告データ取得: 1時間間隔" },
  "daily-report":     { cron: "0 9 * * *",      description: "日次レポート: 毎朝9時" },
  "weekly-report":    { cron: "0 9 * * 1",      description: "週次レポート: 毎週月曜9時" },
  "monthly-report":   { cron: "0 9 1 * *",      description: "月次レポート: 毎月1日9時" },
  "approval-polling": { cron: "*/1 * * * *",    description: "承認ポーリング: 1分間隔" },
};
```

---

## 5. Remotion動画生成仕様

### 5.1 アーキテクチャ

```
編集概要DB → [RemotionSkill] → Remotion Props変換
    ├── 構成の型 → テンプレート選択
    ├── カット割り → シーケンス定義
    ├── 素材URL → メディアソース
    ├── テロップ → Subtitleコンポーネント
    ├── BGM → Audio指定
    ├── SE/ME → SoundEffectタイミング
    └── エフェクト → Transition/Motion定義
        ↓
[Remotion Lambda / Cloud Run] → MP4 → Google Drive格納
```

### 5.2 Remotion Propsスキーマ

```typescript
const EditBriefPropsSchema = z.object({
  templateType: z.enum([
    "ugc", "drama", "anime", "vlog", "corporate",
    "illustration", "banner_video", "influencer", "trivia", "ai"
  ]),
  durationInFrames: z.number(), // 30fps × 秒数
  fps: z.literal(30),
  width: z.literal(1080),
  height: z.literal(1920), // 9:16縦型

  audio: z.object({
    narration: z.object({
      type: z.enum(["recorded", "tts"]),
      url: z.string().optional(),
      ttsText: z.string().optional(),
      ttsVoice: z.string().optional(),
    }),
    bgm: z.object({
      url: z.string(),
      volume: z.number().default(0.3),
    }),
  }),

  cuts: z.array(z.object({
    startFrame: z.number(),
    endFrame: z.number(),
    section: z.enum(["hook", "empathy", "concept", "product", "benefit", "offer", "cta"]),
    media: z.object({
      type: z.enum(["video", "image"]),
      url: z.string(),
      clipStart: z.number().optional(),
      clipEnd: z.number().optional(),
    }),
    subtitle: z.object({
      text: z.string(),
      style: z.enum(["default", "emphasis", "question", "impact"]),
      position: z.enum(["top", "center", "bottom"]).default("bottom"),
      fontSize: z.number().default(48),
    }).optional(),
    effects: z.array(z.object({
      type: z.enum(["fade_in", "fade_out", "zoom_in", "zoom_out", "slide_left", "slide_right", "shake", "flash"]),
      durationFrames: z.number(),
    })).default([]),
    soundEffects: z.array(z.object({
      url: z.string(),
      triggerFrame: z.number(),
      volume: z.number().default(0.8),
    })).default([]),
  })),
});
```

---

## 6. 広告API連携仕様

### 6.1 Meta入稿フロー

```typescript
async function submitToMeta(input: SubmissionInput): Promise<SubmissionResult> {
  const videoId = await metaApi.adVideos.create({
    ad_account_id: accountId,
    file_url: input.videoUrl,
    title: input.videoName,
  });

  const creativeId = await metaApi.adCreatives.create({
    ad_account_id: accountId,
    name: input.creativeName,
    object_story_spec: {
      page_id: input.pageId,
      video_data: {
        video_id: videoId,
        call_to_action: { type: "LEARN_MORE", value: { link: input.lpUrl } },
        message: input.adText,
      },
    },
  });

  const adId = await metaApi.ads.create({
    ad_account_id: accountId,
    adset_id: input.adsetId,
    name: input.adName,
    creative: { creative_id: creativeId },
    status: "PAUSED",
  });

  return { platform: "meta", adId, creativeId, videoId };
}
```

### 6.2 TikTok入稿フロー

```typescript
async function submitToTikTok(input: SubmissionInput): Promise<SubmissionResult> {
  const videoId = await tiktokApi.uploadVideo({
    advertiser_id: advertiserId,
    video_url: input.videoUrl,
    file_name: input.videoName,
  });

  const adId = await tiktokApi.createAd({
    advertiser_id: advertiserId,
    adgroup_id: input.adgroupId,
    ad_name: input.adName,
    ad_format: "SINGLE_VIDEO",
    ad_text: input.adText,
    video_id: videoId,
    landing_page_url: input.lpUrl,
    operation_status: "DISABLE",
  });

  return { platform: "tiktok", adId, videoId };
}
```

### 6.3 運用自動化（5分間隔判断）

```typescript
async function executeOperationCheck(tenantId: string): Promise<void> {
  const rules = await supabase
    .from("operation_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("enabled", true)
    .order("priority");

  const activeAds = await getActiveAds(tenantId);

  for (const ad of activeAds) {
    const performance = await getAdPerformance(ad);

    for (const rule of rules.data) {
      if (evaluateRule(rule, performance)) {
        switch (rule.rule_type) {
          case "stop":   await pauseAd(ad.platform, ad.ad_id); break;
          case "expand":  await increaseBudget(ad.platform, ad.adgroup_id, rule.action.budget_multiplier); break;
          case "shrink":  await decreaseBudget(ad.platform, ad.adgroup_id, rule.action.budget_multiplier); break;
        }

        await logOperationAction(tenantId, ad, rule, performance);
        await notifySlackAndNotion(tenantId, {
          type: "operation",
          message: `${ad.ad_name} を${rule.rule_type}しました（CPA: ${performance.cpa}, CV: ${performance.cv}）`,
        });
        break;
      }
    }
  }
}

function evaluateRule(rule: OperationRule, perf: AdPerformance): boolean {
  const { metric, operator, threshold, cv_threshold } = rule.condition;
  switch (operator) {
    case "cpa_no_cv":  return perf.cost >= perf.target_cpa * threshold && perf.cv <= cv_threshold;
    case "roi_above":  return perf.roi >= threshold;
    case "roi_below":  return perf.roi < threshold;
    default: return false;
  }
}
```

---

## 7. 広告データ取得定義

### 7.1 取得指標

| カテゴリ | 指標 | 備考 |
|---|---|---|
| **コスト** | Cost, CPM, CPC, MCPA（中間CPA）, CPA | Gross/Net両方計算 |
| **効果** | CTR, CVR, MCVR（中間CVR） | MCV = Content View |
| **結果** | Impression, Click, MCV, CV | 1円以上のデータのみ |
| **動画再生** | 2秒視聴率（or 3秒：媒体依存）, 25%/50%/75%/100%再生, 平均視聴時間, 視聴維持率 | フック評価の基幹指標 |
| **属性** | 曜日, 時間帯, 年齢, 性別, 地域 | 取得可能な範囲で全媒体 |

### 7.2 連結情報

| フィールド | ソース | 備考 |
|---|---|---|
| 広告名 | 媒体API | - |
| 日付 | 媒体API | - |
| キャンペーン名 | 媒体API | - |
| 広告セット名 | 媒体API | - |
| 商材名 | 案件DB | テナント名と紐付け |
| CR担当者 | 案件DB | クリエイティブプランナー |
| 運用担当者 | 案件DB | メディアプランナー |
| 営業担当者 | 案件DB | アカウントプランナー |
| 記事担当者 | 案件DB | - |
| 媒体 | 媒体API | Meta/TikTok/YouTube等 |
| 広告コード | 広告名から抽出 | 命名規則に基づくパース |

### 7.3 Gross/Net計算

```typescript
// 手数料率は案件DBで管理（基本は媒体共通、例外的に媒体別あり）
interface FeeConfig {
  tenant_id: string;
  default_fee_rate: number;        // 例: 0.10 (10%)
  platform_overrides?: {           // 例外的に媒体別の場合
    [platform: string]: number;
  };
  period_start?: Date;             // 期間指定（レート変更対応）
  period_end?: Date;
}

// Gross = Net × (1 + fee_rate)
function calcGross(netCost: number, feeRate: number): number {
  return netCost * (1 + feeRate);
}
```

### 7.4 取得スケジュール

| 対象 | 頻度 | 条件 |
|---|---|---|
| 当日データ | 5分間隔 | Cost >= 1円のみ |
| 過去日データ | 1時間間隔 | 直近7日分を差分更新 |
| 属性データ（年齢/性別/地域） | 日次 | 前日分をバッチ取得 |
| 属性データ（曜日/時間帯） | 日次 | パフォーマンスデータから自動計算 |

### 7.4.1 広告データフロー（Supabase + BQデュアル書き込み）

```
Meta/TikTok/YouTube API
    ↓
[データ取得ワーカー]
    ├── Supabase（リアルタイム用）
    │   ├── 当日データ: 5分間隔UPSERT
    │   ├── 運用自動化Agent: ここから読む（低レイテンシ）
    │   └── 直近7日分を保持（古いデータはBQのみ）
    │
    └── BigQuery（長期蓄積・大規模分析用）
        ├── 全データを日次バッチ投入
        ├── レポートAgent: 月次/年次の大規模集計はここから読む
        ├── 案件横断分析/トレンド分析
        └── 将来100社+スケール時もコスト効率◎

※MVP段階ではBQのコストはほぼゼロ（従量課金で月数ドル）
※最初から流しておくことで将来のスケール時に移行不要
```

### 7.5 Supabaseスキーマ（広告データ）

```sql
-- メインパフォーマンステーブル
ad_performance (
    id UUID PK,
    tenant_id UUID FK,
    platform TEXT,              -- meta/tiktok/youtube/line/x
    date DATE,
    hour INT,                   -- 時間帯（0-23）、当日5分更新時はNULL
    campaign_name TEXT,
    adset_name TEXT,
    ad_name TEXT,
    ad_code TEXT,               -- 広告コード（命名規則からパース）
    creative_name TEXT,
    -- 連結情報
    product_name TEXT,
    cr_manager TEXT,
    operation_manager TEXT,
    sales_manager TEXT,
    article_manager TEXT,
    -- コスト
    cost_net DECIMAL,
    cost_gross DECIMAL,
    fee_rate DECIMAL,
    -- 結果
    impressions INT,
    clicks INT,
    mcv INT,                    -- 中間CV（Content View）
    cv INT,                     -- CATS計測CV
    cv_actual INT,              -- 実CV（EC Force等から取得）
    -- 動画再生
    video_view_2s INT,          -- 2秒視聴（or 3秒：媒体依存）
    video_view_25 INT,
    video_view_50 INT,
    video_view_75 INT,
    video_view_100 INT,
    avg_watch_time DECIMAL,     -- 平均視聴時間（秒）
    retention_data JSONB,       -- 視聴維持率カーブ（秒ごとの維持率）
    -- タイムスタンプ
    fetched_at TIMESTAMP,       -- データ取得時刻
    created_at TIMESTAMP
);

-- 属性データ（日次バッチ、別テーブルで管理して本体を軽くする）
ad_demographics (
    id UUID PK,
    tenant_id UUID FK,
    platform TEXT,
    date DATE,
    ad_name TEXT,
    dimension_type TEXT,        -- age/gender/region
    dimension_value TEXT,       -- 18-24/male/Tokyo等
    impressions INT,
    clicks INT,
    cost_net DECIMAL,
    cv INT,
    created_at TIMESTAMP
);
```

### 7.6 CV計測とCATS

```
現状:
  広告クリック → 記事 → LP → CV
  └── CATS（計測ツール）が媒体にCV数をAPI返送
  └── CATSのCV数 ≠ 実CV数（乖離あり）

実CV取得フロー:
  1. 案件DBに「実CV取得元」を設定
     ├── EC Force API: EC案件の実CV
     ├── その他ASPツール: 案件別に設定
     └── 手動入力: 自動取得不可の場合
  2. 日次で実CVを取得 → ad_performance.cv_actual に格納
  3. CATS CV vs 実CV の乖離率を自動計算 → レポートに表示

将来構想:
  CATS自体を自社CV計測基盤に置き換え
  → 媒体APIに直接実CVを返送
  → 計測精度向上 + CATS依存からの脱却
```

---

## 8. マルチモーダルエンベディング仕様

### 8.1 エンベディング対象

| 対象 | 方式 | 用途 |
|---|---|---|
| テキスト（台本/ナレッジ/レギュ） | Vertex AI (Gemini Embedding 2) → 3072次元 | ナレッジ検索、レギュチェック |
| 動画素材（映像） | 2秒間隔フレーム抽出 → Gemini Multimodal Embedding | 素材マッチング |
| 動画素材（テキスト説明） | Vertex AI (Gemini Embedding 2) → 3072次元 | テキスト×素材マッチング |
| 完成動画 | 2秒間隔フレーム抽出 → Gemini Multimodal Embedding | 過去動画との類似検索 |
| 音声素材 | Whisper → テキスト変換 → Vertex AI (Gemini Embedding 2) | 音声コンテンツ検索 |
| 市場広告（動画広告分析Pro） | テキスト + フレーム → Gemini Multimodal Embedding | 競合分析、トレンド把握 |

### 8.2 素材マッチング3軸

```
台本テキスト → エンベディング
        │
        ├── [軸1: 過去実績マッチ]
        │   台本の各セクション ←→ 過去の類似台本で使用された素材
        │   └── ベクトル類似度でランキング
        │
        ├── [軸2: 市場データマッチ]
        │   台本の内容 ←→ 動画広告分析Proの高再生数広告の素材パターン
        │   └── MCP経由でデータ取得 → ベクトル類似度
        │
        └── [軸3: コンテンツマッチ]
            台本テキスト ←→ 素材のテキスト説明 + 映像エンベディング
            └── 抽象マッチ（例：「自由に働く」→ 海外で仕事するシーン）
            └── 具体マッチ優先（具体的に一致する素材があればそちらを選択）

スコアリング:
  total_score = w1 * 過去実績スコア + w2 * 市場データスコア + w3 * コンテンツスコア
  ※具体マッチがある場合はボーナス加算
```

### 8.3 フレーム抽出処理

```typescript
// 素材登録時に自動実行
async function extractAndEmbedFrames(
  materialUrl: string,
  materialId: string
): Promise<void> {
  // 1. FFmpegで2秒間隔フレーム抽出
  const frames = await extractFrames(materialUrl, { intervalSec: 2 });

  // 2. 各フレームをCLIPでエンベディング
  for (const frame of frames) {
    const embedding = await geminiMultimodalEmbed(frame.imageBuffer);

    await supabase.from("material_embeddings").insert({
      material_id: materialId,
      frame_timestamp: frame.timestamp,
      embedding: embedding,
      frame_url: await uploadFrame(frame), // フレーム画像を保存
    });
  }

  // 3. テキスト説明もエンベディング
  const description = await generateMaterialDescription(frames);
  const textEmbedding = await generateEmbedding(description);

  await supabase.from("material_text_embeddings").insert({
    material_id: materialId,
    description: description,
    embedding: textEmbedding,
  });
}
```

### 8.4 Supabaseスキーマ（エンベディング）

```sql
-- 素材の映像エンベディング（2秒間隔フレーム）
material_embeddings (
    id UUID PK,
    tenant_id UUID FK,
    material_id UUID FK,
    frame_timestamp DECIMAL,     -- 素材内の秒数
    embedding VECTOR(3072),       -- Gemini Multimodal Embedding
    frame_url TEXT,              -- フレーム画像URL
    created_at TIMESTAMP
);

-- 素材のテキストエンベディング
material_text_embeddings (
    id UUID PK,
    tenant_id UUID FK,
    material_id UUID FK,
    description TEXT,            -- AI生成の素材説明
    embedding VECTOR(3072),      -- Gemini Embedding 2
    created_at TIMESTAMP
);

-- 完成動画のエンベディング（分析用）
video_embeddings (
    id UUID PK,
    tenant_id UUID FK,
    video_id UUID FK,
    frame_timestamp DECIMAL,
    section TEXT,                 -- hook/empathy/concept/product/benefit/offer/cta
    embedding VECTOR(3072),
    created_at TIMESTAMP
);
```

---

## 9. コミュニケーション自動取り込み仕様

### 9.1 監視対象

| チャネル | 監視方式 | 取り込み対象 |
|---|---|---|
| Chatwork | 全メッセージポーリング（1分間隔） | テキスト + 共有リンク |
| Slack | 全メッセージポーリング（1分間隔） | テキスト + 共有リンク |
| Gmail | 特定ラベル/送信元のメール監視 | 契約書添付 + 本文 |
| tl;dv（or 後継） | ミーティング完了後 | サマリー + 全文リンク |
| Google Drive | 共有リンク検知時 | 素材ファイル |
| Dropbox | 共有リンク検知時 | 素材ファイル |

### 9.2 メッセージ分類（LLMベース）

```typescript
// LLMでメッセージを分類
async function classifyMessage(message: ChatMessage): Promise<Classification> {
  const result = await llm.classify({
    prompt: `以下のクライアントメッセージを分類してください。
    分類: material（素材共有）/ regulation（レギュ更新）/ contract（契約情報）/
          strategy（施策/方針）/ feedback（フィードバック）/ general（一般）/ unknown（不明）

    確信度が低い場合はunknownとし、確認が必要な理由を添えてください。`,
    message: message.text,
  });

  // 確信度が低い場合は担当者に確認
  if (result.confidence < 0.7 || result.category === "unknown") {
    await notifyForConfirmation(message, result);
  }

  return result;
}
```

### 9.3 自動格納フロー

```
メッセージ受信
    │
    ▼
[LLM分類]
    │
    ├── material → 共有リンク解析
    │   ├── Google Drive: APIでファイル取得 → 案件別素材フォルダに格納
    │   └── Dropbox: APIでファイル取得 → Google Driveに転送 → 素材フォルダに格納
    │   └── 素材DB自動登録（AIがメタデータ付与: 形式/ジャンル/概要/登場人物）
    │
    ├── regulation → レギュDB更新
    │   └── 既存レギュレーションとの差分を検出 → 更新箇所をハイライト
    │
    ├── contract → 案件DB更新
    │   └── 契約内容をパース → 該当フィールドに格納
    │
    ├── strategy → ナレッジDB蓄積
    │   └── 施策/方針情報をベクトル化して格納
    │
    ├── feedback → ナレッジDB蓄積 + 関連タスク更新
    │
    └── unknown → 担当者にSlack/Notion通知で確認依頼
        └── 担当者の判断結果をフィードバックとしてLLMの精度向上に活用
```

### 9.4 tl;dv議事録取り込み

```typescript
async function importMeetingNotes(meetingId: string, tenantId: string): Promise<void> {
  // 1. tl;dvからミーティング情報取得
  const meeting = await tldv.getMeeting(meetingId);
  const highlights = await tldv.getMeetingHighlights(meetingId);

  // 2. サマリーを生成（or tl;dvのサマリーを使用）
  const summary = highlights.summary || await generateSummary(meeting.transcript);

  // 3. Notion ナレッジDBに格納
  await notion.pages.create({
    parent: { database_id: KNOWLEDGE_DB_ID },
    properties: {
      title: meeting.title,
      category: "meeting",
      tenant_id: tenantId,
      content: summary,
      source_url: meeting.url,  // 全文が見れるtl;dvリンク
      date: meeting.date,
    },
  });

  // 4. サマリーをベクトル化してSupabaseにも格納
  const embedding = await generateEmbedding(summary);
  await supabase.from("knowledge_base").insert({
    tenant_id: tenantId,
    category: "meeting",
    content: summary,
    metadata: { meeting_id: meetingId, url: meeting.url },
    embedding,
  });
}
```

---

## 10. 注釈（レギュレーション）自動挿入仕様

### 10.1 注釈挿入フロー

```
台本完成時:
  1. 案件のレギュレーションDB（最新版）を取得
  2. 薬機法/景表法の一般ルール + クライアント固有ルールを統合
  3. 台本の各パートに対して注釈必要箇所を自動検出
  4. 該当箇所に注釈テキストを自動挿入
  5. 注釈漏れチェック → 漏れ候補があればアラート表示
  6. 過去の同案件台本の注釈パターンも参照（類似箇所の注釈を提案）
```

### 10.2 注釈検出ロジック

```typescript
async function detectAnnotationPoints(
  script: ScriptData,
  tenantId: string
): Promise<AnnotationPoint[]> {
  // 1. レギュレーションDB取得（案件固有 + 共通）
  const regulations = await getRegulations(tenantId);

  // 2. 過去の同案件台本の注釈パターン取得
  const pastAnnotations = await getPastAnnotations(tenantId);

  // 3. LLMで注釈必要箇所を検出
  const points = await llm.analyze({
    prompt: `台本の各パートを分析し、以下の観点で注釈が必要な箇所を特定してください。

    注釈判断基準:
    - 効果効能に関する表現 → 「※個人の感想です」等
    - 体験談/口コミ引用 → 「※個人の感想であり、効果を保証するものではありません」等
    - 価格/オファー表示 → 「※◯月◯日時点の価格です」等
    - ビフォーアフター表現 → 適切な注釈
    - クライアント固有のNG/注意表現 → レギュレーションシート参照
    - 過去の同案件台本で注釈が入っていたパターン → 同様の注釈を提案

    漏れがないように、疑わしい箇所はすべてフラグを立ててください。`,
    script: script,
    regulations: regulations,
    pastAnnotations: pastAnnotations,
  });

  return points;
}
```

### 10.3 レギュレーション自動更新

```
クライアントからの連絡（Chatwork/Slack）
    │
    ▼
[LLM分類: regulation]
    │
    ▼
[差分検出]
  ├── 新規ルール → レギュDB追加
  ├── 既存ルール変更 → レギュDB更新 + 変更履歴記録
  └── ルール削除 → レギュDBアーカイブ
    │
    ▼
[通知: Slack + Notion]
  「[案件名] レギュレーションが更新されました。変更点: ◯◯」
    │
    ▼
[次回台本から自動適用]
  └── 注釈テンプレートも自動更新
```

---

## 11. ベクトル検索仕様

### 7.1 Supabase pgvector

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX ON knowledge_base
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON knowledge_base
  USING (tenant_id = current_setting('app.tenant_id')::uuid OR tenant_id IS NULL);
```

### 7.2 ナレッジ検索

```typescript
async function searchSimilarKnowledge(
  tenantId: string,
  query: string,
  category: string,
  topK: number = 10
): Promise<KnowledgeEntry[]> {
  const embedding = await generateEmbedding(query);

  const { data } = await supabase.rpc("match_knowledge", {
    query_embedding: embedding,
    match_count: topK,
    filter_tenant_id: tenantId,
    filter_category: category,
  });

  return data;
}
```

---

## 12. セキュリティ要件

### 8.1 認証・認可

| 対象 | 方式 |
|---|---|
| Notion API | Internal Integration Token（環境変数） |
| 広告API | OAuth 2.0（リフレッシュトークン暗号化保存） |
| Supabase | Service Role Key + RLSでテナント分離 |
| Slack | Bot Token（環境変数） |
| Google Drive | OAuth 2.0（リフレッシュトークン） |

### 8.2 データ保護

- 秘密情報: 環境変数 → 本番はクラウドシークレットマネージャー
- APIキーローテーション: 90日間隔
- テナント分離:
  - Supabase: RLS（Row Level Security）でDB層で強制分離
  - Notion: NotionSkillの全メソッドにtenant_idを必須パラメータとして強制（フィルタなしクエリはエラー）
  - Google Drive: テナント別フォルダ構造 + IAM
- アクセスログ: 全API呼び出しを記録

### 12.3 Notionテナント分離の強制実装

```typescript
// NotionSkillの全クエリメソッドでtenant_idフィルタを構造的に強制
class NotionSkill {
  async query(databaseId: string, tenantId: string, filters?: any) {
    if (!tenantId) throw new Error("tenant_id is required");
    return this.client.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          { property: "テナントID", rich_text: { equals: tenantId } },
          ...(filters ? [filters] : []),
        ],
      },
    });
  }
  // create/updateも同様にtenant_id必須
}
```

---

## 13. 非機能要件

### 9.1 パフォーマンス

| 項目 | 要件 |
|---|---|
| 運用判断レイテンシ | 5分間隔 × 全テナント処理完了 < 3分 |
| 広告データ取得 | 1時間間隔、全媒体×全テナント < 10分 |
| レポート生成 | 日次レポート < 5分/テナント |
| 動画レンダリング | 60秒動画 < 10分 |
| Notion API | 3req/秒以内 |
| エラー率 | エージェント実行成功率 > 95% |
| データ保持期間 | パフォーマンスデータ: 2年、ナレッジ: 無期限 |

### 9.2 スケーラビリティ

```
MVP（10社）:
├── 単一サーバー（Cloud Run / Railway）
├── Redis 1インスタンス
├── Supabase Free/Pro プラン
└── Notion 1ワークスペース

スケール時（50社+）:
├── Cloud Run オートスケール
├── Redis Cluster
├── Supabase Team プラン
└── テナント別の処理分散
```

---

## 14. デプロイ・運用

### 10.1 CI/CD

```
GitHub Actions:
├── PR作成時: lint + typecheck + unit test
├── mainマージ時: ビルド + デプロイ（staging）
├── tag作成時: デプロイ（production）
└── Remotionテンプレート更新時: 再デプロイ
```

### 10.2 モニタリング

| 対象 | アラート条件 |
|---|---|
| エージェント実行 | 失敗率 > 5% |
| API制限 | Notion/広告APIのレート制限接近 |
| ジョブキュー | キュー滞留 > 100件 |
| 広告データ | データ取得欠損（1時間以上） |
| 動画レンダリング | レンダリング失敗 |

### 10.3 ログ構造

```typescript
interface AgentLog {
  timestamp: string;
  level: "info" | "warn" | "error";
  tenantId: string;
  agentName: string;
  phase: string;
  action: string;
  duration_ms: number;
  input_summary: string;
  output_summary: string;
  error?: string;
}
```

---

## 15. 既存プロジェクトとの統合方針

### 15.1 現状の3プロジェクト

| プロジェクト | 担当 | Supabase | エンベディング | 主要機能 |
|---|---|---|---|---|
| Ad Orchestration | 社内開発 | ozhldqebkxxkctmrfngq | 3072次元(Gemini) | Meta入稿/データ取得/26テーブル稼働 |
| video-material-selector | 業務委託 | 別プロジェクト | 768次元 | 素材ベクトル検索+フィードバック |
| ureru-buzz-ai（本件） | 横野さん主導 | **既存に統合** | Vertex AI (Gemini Embedding) | 全Phase統合AIエージェント |

### 15.2 統合方針（最初から統合）

```
方針: 既存Ad OrchestrationのSupabase（ozhldqebkxxkctmrfngq）に統合して進める
理由: 後から統合するより最初からやる方が効率的

Ad Orchestration Supabase (ozhldqebkxxkctmrfngq)
├── 既存26テーブル（そのまま活用）
│   ├── clients / projects / ad_accounts
│   ├── campaigns / adsets / ads
│   ├── ad_daily_metrics / ad_action_stats
│   ├── ad_daily_conversions (VIEW)
│   ├── creatives（3072次元エンベディング済み）
│   ├── 入稿系（ad_submissions / submission_*）
│   └── アカウント設定系（account_assets / account_rules等）
│
├── 追加するテーブル（売れるBUZZ AI用）
│   ├── 制作系: appeals / plans / scripts / edit_briefs / videos
│   ├── ナレッジ系: knowledge_base / regulation_knowledge（pgvector）
│   ├── 素材系: material_embeddings / material_text_embeddings
│   ├── 運用系: operation_rules / operation_logs
│   └── 承認系: approval_logs
│
├── video-material-selectorのデータも移行
│   └── material_vectors → 統一エンベディングモデルで再生成（1-2日工数）
│
└── BQ連携
    └── Supabaseの広告データを日次バッチでBQに投入（長期蓄積・大規模分析用）
```

### 15.3 統合時のマイグレーション計画

| 対象 | 作業内容 | 工数 |
|---|---|---|
| Ad Orchestration → ureru-buzz-ai | テーブル構造マッピング + データ移行スクリプト | 3-5日 |
| video-material-selector → ureru-buzz-ai | エンベディング再生成バッチ + テーブルマッピング | 1-2日 |
| エンベディング次元数統一 | 全素材を新モデルで再エンベディング | 1-2日（数百件なら数時間） |

### 15.4 注意事項

- 業務委託（video-material-selector）には影響を出さない（未相談のため）
- 社内担当者（Ad Orchestration）とは統合前に設計すり合わせが必要
- 統合タイミングはMVP完成後を想定
