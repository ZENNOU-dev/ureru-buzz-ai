# 売れるBUZZ AI - テスト指示書

## 1. テスト戦略

### 1.1 テストピラミッド

```
        /  E2E  \          ← 統合テスト（全Phase通し）
       / Integration \      ← スキル + エージェント結合
      /   Unit Tests   \    ← 各モジュール単体
```

| レベル | 対象 | カバレッジ | ツール |
|---|---|---|---|
| Unit | core, skills, agents | 80%以上 | Vitest |
| Integration | スキル→外部API、エージェント→スキル | 主要パス | Vitest + MSW |
| E2E | Phase 1〜10の一連フロー | ハッピーパス + 主要エラーパス | Vitest + テスト用Notion DB |

---

## 2. ユニットテスト

### 2.1 core（共通モジュール）

| テスト対象 | テスト項目 |
|---|---|
| retry.ts | 成功時返却 / リトライ後成功 / 最大回数超過 / 429でbackoff / 401はリトライなし |
| rate-limiter.ts | 3req/秒制限 / キューイング順次実行 |
| tenant.ts | テナントID→DB ID解決 / 不正ID時エラー |
| notification.ts | Slack+Notion両方送信 / 片方失敗時もう片方は送信 |

### 2.2 skills（スキル群）

| テスト対象 | テスト項目 |
|---|---|
| NotionSkill | テナントフィルタ付きクエリ / 100件超ページネーション / ページ作成・更新 / 承認ステータス更新 |
| MaterialMatchSkill | 素材候補返却 / 利用禁止除外 / 他テナント提供素材除外 / 汎用素材利用可 / 具体マッチボーナス / 過去実績優先 |
| Scoring | 3軸重み付け計算 / 具体マッチボーナス加算 / 全軸0でも最低スコア |
| MetaAdsFetcher | 正しい指標取得 / Cost<1円フィルタ / Gross/Net計算 / 媒体別手数料例外 / 属性データ取得 |
| TikTokAdsFetcher | 同上（TikTok API形式） |
| RuleEvaluator | CPA×1でCV0→停止 / ROI100%→継続 / ROI150%→拡大 / 優先度順マッチ |

### 2.3 agents（エージェント群）

| テスト対象 | テスト項目 |
|---|---|
| AnnotationInserter | 効果効能注釈 / 体験談注釈 / 価格注釈 / クライアントNG / 過去パターン反映 / 漏れフラグ / 安全表現スキップ |
| EditBriefAgent | 台本→編集概要生成 / 素材→カット割り / BGM/SE選定 / レギュチェック実行 / Notion登録 / Slack+Notion通知 |
| ScriptAgent | 企画→台本生成 / 注釈挿入 / 3フック生成 / 文字数チェック / レギュチェック |
| SubmissionAgent | 動画名→入稿完了 / Meta API正しい呼出 / TikTok API正しい呼出 / 入稿DBログ / リトライ / アラート |
| OperationAgent | 停止判定実行 / 拡大判定実行 / 継続時無アクション / ログ記録 / 通知 |
| RegulationAgent | 台本チェック / 動画チェック / レギュ更新反映 |
| AnalysisAgent | マクロ分析(訴求/型) / ミクロ分析(フック2秒視聴率/構成要素CVR/CTA CTR) / 離脱率検出 |

---

## 3. インテグレーションテスト

### 3.1 スキル→外部API結合（MSWモック使用）

| テスト名 | 検証内容 |
|---|---|
| NotionSkill Integration | Notion APIフォーマットでCRUD / 承認ポーリング検知 |
| Ad Data Pipeline | Meta/TikTokレスポンス→Supabaseスキーマ変換 / Gross/Net計算 / 当日5分更新 / 実CV取得 |
| Communication Intake | Chatwork/Slack分類 / Drive/Dropboxリンク解析→素材取得・登録 / レギュ更新反映 / 不確実分類→確認通知 / tl;dvサマリー格納 |
| Material Embedding | FFmpegフレーム抽出 / CLIPエンベディング / テキスト説明生成 / Supabase格納 |

### 3.2 エージェント→スキル結合

| テスト名 | 検証内容 |
|---|---|
| EditBrief Flow | 台本→素材選定→テロップ→BGM/SE→カット割り→DB登録の全フロー / 具体マッチ優先 / 注釈正しく挿入 / レギュNG検出 |
| Script Flow | 企画→台本生成→注釈→フックバリエーション→レギュチェック→DB登録 |
| Submission Flow | 動画名入力→DB逆引き→入稿設定取得→API呼出→ログ→通知 |
| Operation Flow | データ取得→ルール評価→判断実行→ログ→通知 |

---

## 4. E2Eテスト

### 4.1 全Phase通しテスト

テスト用Notion DB + Supabaseテスト環境を使用。

```
Phase 1（セットアップ）→ 承認
  ↓
Phase 2（リサーチ）→ 承認
  ↓
Phase 3（訴求開発）→ 4案から選択 → 承認
  ↓
Phase 4（広告企画）→ 承認
  ↓
Phase 5（台本）→ 3フック確認 + 注釈確認 → 承認
  ↓
Phase 6（編集概要）→ カット/素材/BGM確認 → 承認
  ↓
Phase 7（動画生成）→ Remotionモック → 承認
  ↓
Phase 8（入稿）→ APIモック → 承認
  ↓
Phase 9（運用）→ モックパフォーマンスデータ → 判断確認
  ↓
Phase 10（レポート）→ レポート生成確認
```

### 4.2 マルチテナント分離テスト

| テスト項目 | 検証内容 |
|---|---|
| 素材分離 | テナントAの提供素材がテナントBから見えない |
| 汎用素材共有 | 汎用素材は全テナントで利用可能 |
| 広告データ分離 | テナントAのデータがテナントBのレポートに含まれない |
| ナレッジ分離 | テナント固有ナレッジが他テナントに漏れない |
| 共通ナレッジ共有 | tenant_id=NULLのナレッジは全テナントで検索可能 |

### 4.3 承認フローテスト

| テスト項目 | 検証内容 |
|---|---|
| 承認→次フェーズ | ステータス変更→ポーリング検知→次Agent起動 |
| 差し戻し→再実行 | コメント付き差し戻し→Agent再実行（コメント反映） |
| 承認者変更 | 新しい承認者に通知が行く |
| 通知二重送信 | Slack + Notion両方に確実に送信 |

---

## 5. テストデータ

### 5.1 テスト用案件

```
案件名: テスト育毛剤案件
コンセプト: 頭皮環境を根本から変える育毛剤
WHO: 40代男性、抜け毛に悩み始めた会社員
WHAT: 医薬部外品成分配合の育毛剤
WHY: 毎朝枕の抜け毛を見て不安を感じている
KPI: CPA 5,000円 / CV 100件/月
予算: 500万円/月
媒体: Meta, TikTok
手数料率: 10%
```

### 5.2 テスト用素材

| 素材名 | 形式 | ジャンル | ステータス |
|---|---|---|---|
| 頭皮ケアシーン | 動画 | 商品使用 | 利用可（汎用） |
| 抜け毛悩みシーン | 動画 | 日常 | 利用可（汎用） |
| 商品パッケージ | 画像 | 商品 | クライアント提供 |
| 利用者インタビュー | 動画 | UGC | クライアント提供 |
| NG素材 | 動画 | 商品使用 | 利用禁止 |

### 5.3 テスト用レギュレーション

| ルール種別 | NG表現 | OK代替 | 理由 |
|---|---|---|---|
| 薬機法 | 「治る」 | 「※個人の感想です」 | 医薬品ではないため |
| クライアント固有 | 他社比較 | なし（表現禁止） | クライアントNG |
| 景表法 | 「業界No.1」 | 出典明記が必要 | 根拠なき最上級表現 |

---

## 6. CI/CD統合

```yaml
# GitHub Actions
PR時: lint + typecheck + unit test
mainマージ時: + integration test
タグ作成時: + e2e test + デプロイ
```

```json
// package.json scripts
{
  "test:unit": "vitest run --config vitest.unit.config.ts",
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "test:e2e": "vitest run --config vitest.e2e.config.ts",
  "test": "pnpm run test:unit && pnpm run test:integration"
}
```

---

## 7. テスト環境

| 環境 | 用途 | 設定 |
|---|---|---|
| ローカル | 開発中のユニットテスト | docker-compose（Redis + Supabase local） |
| CI | PR時の自動テスト | GitHub Actions + Supabase test project |
| Staging | E2E + 統合テスト | Cloud Run staging + Notion test DB + Supabase test |
| Production | 本番 | Cloud Run prod + Notion本番DB + Supabase prod |
