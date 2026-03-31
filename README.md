# 売れるBUZZ AI

ショート動画広告の完全自動PDCA AIエージェントシステム

## 構成

### packages/ (TypeScript)

| パッケージ | 説明 |
|-----------|------|
| `packages/web` | Next.js Webアプリケーション |
| `packages/agents` | AIエージェント（EditBriefAgent等） |
| `packages/skills` | スキル（Kling, Material-Match, LLM, Notion等） |
| `packages/orchestrator` | ワークフローオーケストレーション |
| `packages/api` | APIレイヤー |
| `packages/core` | 共通型・ユーティリティ |

### services/ (Python)

| サービス | 説明 |
|---------|------|
| `services/ad-orchestration/meta-ads-fetcher` | 広告データパイプライン・入稿自動化・CR分析 |
| `services/ad-orchestration/google-workspace-mcp` | Google Workspace MCP（Sheets/Drive） |

## セットアップ

```bash
# TypeScript packages
pnpm install
pnpm build

# Python services
cd services/ad-orchestration/meta-ads-fetcher
pip install -r requirements.txt
```

## 技術スタック

- **TypeScript**: Next.js, Turbo, pnpm, Vitest
- **Python**: Meta/TikTok Marketing API, Playwright, Supabase
- **DB**: Supabase (PostgreSQL + pgvector)
- **AI**: Anthropic Claude SDK, Gemini Embedding, Kling
