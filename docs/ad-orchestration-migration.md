# ad-orchestration リポジトリ統合ドキュメント

## 概要

`BONNOU-inc/ad-orchestration` リポジトリの全コンテンツを `ureru-buzz-ai` モノレポの `services/ad-orchestration/` に統合した。

## 移行理由

- **同一プロダクト**: ad-orchestration（広告運用自動化）と ureru-buzz-ai（ショート動画広告PDCA）は「売れるBUZZ AI」の両輪
- **管理効率化**: issue管理・CI/CD・コードレビューを1リポジトリで一元化
- **チーム連携**: 横野さん（TypeScript/フロント+エージェント）と羽田さん（Python/広告API+データパイプライン）の作業を同一リポジトリで可視化

## ad-orchestration で何がされていたか

羽田さん（hasez）が構築した **広告運用自動化プラットフォーム**。

### 主要コンポーネント

| コンポーネント | 説明 | 主要ファイル |
|--------------|------|-------------|
| **広告データパイプライン** | Meta/TikTok APIから30分間隔でパフォーマンスデータを取得・Supabaseに格納 | `main.py`, `fetcher.py`, `database.py` |
| **入稿自動化** | CATS→Beyond→Meta/TikTok の E2E 広告入稿フロー | `orchestrator.py`, `submission_engine.py`, `submission_wizard.py` |
| **TikTok統合** | TikTok Marketing API連携（認証・データ取得・入稿） | `tiktok_*.py` |
| **CR分析** | Gemini Embedding(3072d)によるクリエイティブのベクトル化・CPA分析 | `cr_vectorize_pipeline.py`, `cr_cpa_similarity.py`, `cr_structure_labeler.py` |
| **競合分析** | 動画分析PRO連携、競合クリエイティブの収集・重複排除 | `competitor_analysis.py`, `dpro_vectorize_pipeline.py` |
| **データ同期** | Google Sheets ↔ Notion ↔ Supabase 間の双方向同期 | `sync_*.py`（8ファイル） |
| **CATS/Beyond自動化** | Playwright によるブラウザ操作で広告トラッカー登録・LP管理 | `cats_automation.py`, `beyond_*.py` |
| **Google Workspace MCP** | Claude Code用カスタムMCPサーバー（Sheets/Drive操作） | `google-workspace-mcp/` |
| **DBゲートキーパー** | DB整合性チェッカー（FK検証・孤立レコード検出） | `db_gatekeeper.py` |
| **音声素材** | AI音声クローン/TTS用リファレンス音声 | `voice_work/` |

### 技術スタック

- **言語**: Python（メイン）、TypeScript（MCP）
- **DB**: Supabase（PostgreSQL + pgvector）
- **外部API**: Meta Marketing API、TikTok Marketing API、Gemini（Embedding/Flash）
- **ブラウザ自動化**: Playwright（CATS: l-ad.net、Squad Beyond）
- **マイグレーション**: SQL 20ファイル（001〜020）

### 対応クライアント

ローコスト矯正歯科、REDEN、バルクオム、キャリドラ、ウェブフリ、オリパ堂 等

## 移行先ディレクトリ構造

```
ureru-buzz-ai/
├── packages/              # TypeScript（横野さん）
│   ├── agents/            # AIエージェント
│   ├── api/               # APIレイヤー
│   ├── core/              # 共通型・ユーティリティ
│   ├── orchestrator/      # オーケストレーション
│   ├── skills/            # Kling, Material-Match, LLM, Notion等
│   └── web/               # Next.js Webアプリ
├── services/              # Python（羽田さん）← 新規追加
│   └── ad-orchestration/
│       ├── meta-ads-fetcher/    # 広告パイプライン・入稿・分析
│       ├── google-workspace-mcp/ # Google Workspace MCP
│       ├── voice_work/          # 音声素材
│       └── CLAUDE.md            # Claude Code設定
├── docs/                  # ドキュメント
├── deploy/                # デプロイ設定
├── scripts/               # ユーティリティスクリプト
└── supabase/              # DBマイグレーション
```

## 移行日

2026-03-31

## 関連Issue

- BONNOU-inc/ureru-buzz-ai#42: 羽田さんのリポジトリ確認・統合
- BONNOU-inc/ureru-buzz-ai#43: 羽田さんのドキュメント統合
