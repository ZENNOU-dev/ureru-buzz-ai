# 売れるBUZZ AI - Phase別完全自動化懸念点 & 素材AI生成設計

## Part 1: Phase別 完全自動化の懸念点

各Phaseについて「完全自動化を阻む壁」と「対策案」を整理する。
懸念は3段階で評価: 🔴 致命的（自動化不可能な人間依存） / 🟡 要工夫（設計で解決可能） / 🟢 問題なし

---

### Phase 1: 案件セットアップ

| # | 懸念点 | 深刻度 | 詳細 | 対策案 |
|---|--------|--------|------|--------|
| 1-1 | APの入力が必須 | 🔴 | 背景/目的/KPI/予算など、営業が商談でヒアリングした情報を手動入力する必要がある。AIでは代替不可。 | MVP: Notionフォームで入力効率化。将来: CRM連携 or 商談録音(tl;dv)からの自動抽出を検討 |
| 1-2 | MPの運用方針設定が必須 | 🔴 | キャンペーン構造/除外設定/検証期・拡大期ルールは運用者の経験に基づく判断。 | テンプレート化（業界別/媒体別）で入力を最小化。AIが過去案件から推奨設定を提案 |
| 1-3 | クライアント固有のレギュレーション収集 | 🔴 | 初回の情報はクライアントから受領するしかない。 | 受領後のDB登録は自動化可能。以降の更新はコミュニケーション自動取り込みで対応 |

**Phase 1 総評**: 自動化率 20%程度。本質的に「人間からの情報インプット」フェーズのため完全自動化は困難。**入力UI最適化 + AIの推奨提案**が現実的。

---

### Phase 2: リサーチ

| # | 懸念点 | 深刻度 | 詳細 | 対策案 |
|---|--------|--------|------|--------|
| 2-1 | Web検索の網羅性・鮮度 | 🟡 | AI検索は「何を検索すべきか」を正しく判断できるかが鍵。表層的な検索に留まるリスク。 | リサーチシート項目に沿って検索クエリを体系的に生成。CP（クリエイティブプランナー）がレビューで補完 |
| 2-2 | 広告ライブラリのスクレイピング制限 | 🟡 | Meta/TikTok広告ライブラリの取得制限。ページネーション上限、レート制限がある。 | 動画広告分析Pro MCP経由で市場データを取得。直接ライブラリ検索は補助的に利用 |
| 2-3 | クライアント提供資料の解析精度 | 🟡 | PDF/PPT/画像など多様なフォーマット。レイアウトが崩れる、表の読み取りミスなど。 | マルチモーダルLLM（Claude/Gemini）でPDF/画像直接解析。構造化後に人間レビュー |
| 2-4 | N1インタビューは人間依存 | 🔴 | 現状は人間がインタビュー実施。AIアバターインタビューは将来構想。 | MVP: N1欄は空欄 or 手動入力。将来: AIアバターインタビュー（技術成熟待ち） |
| 2-5 | SNS情報のノイズ | 🟡 | SNS上の情報は玉石混交。信頼性の低い情報を拾ってしまうリスク。 | 情報ソースの信頼度スコアリング + 複数ソース突合で信頼性を担保 |
| 2-6 | リサーチの「深さ」の限界 | 🟡 | 表面的なファクト収集はできるが、「ターゲットの感情の機微」「暗黙の常識」などはAIが弱い領域。 | CPが承認時にレビュー。差し戻しコメントをナレッジ蓄積してAIの精度を段階的に向上 |

**Phase 2 総評**: 自動化率 60-70%。情報収集の70%は自動化可能だが、**深いインサイト抽出とN1インタビューは人間依存**。

---

### Phase 3: 訴求開発

| # | 懸念点 | 深刻度 | 詳細 | 対策案 |
|---|--------|--------|------|--------|
| 3-1 | 「刺さる訴求」の発見はクリエイティブ能力 | 🟡 | AIは過去パターンの組み合わせは得意だが、従来にない斬新な切り口を発見する能力は限定的。 | 過去効果データ + 市場トレンドに基づく提案（CPA×CV軸で実証済みパターン優先）。斬新な訴求はCPが追加 |
| 3-2 | 人間の選択が必要 | 🟡 | 4案からの選択は人間判断。ただしAIが「推奨理由」を提示すれば判断コストは低い。 | 各訴求に過去類似訴求の実績データ + 推奨スコアを付与。将来的にはAIセルフ選択→人間は結果レビューのみ |
| 3-3 | コンセプトの質に依存 | 🟡 | Phase 1で入力されたコンセプトの質が低いと、訴求も低品質になる。 | コンセプト入力時にAIがフィードバック（不足情報の指摘、改善提案）を出す |

**Phase 3 総評**: 自動化率 70%。AI提案 + 人間選択のハイブリッドが最適。**ナレッジ蓄積が進めば80%+に改善**。

---

### Phase 4: 広告企画

| # | 懸念点 | 深刻度 | 詳細 | 対策案 |
|---|--------|--------|------|--------|
| 4-1 | 興味の型 × 構成の型の組み合わせ爆発 | 🟡 | 8興味 × 11構成 = 88通り。全パターンの品質を担保するのは困難。 | 過去データで効果の高い組み合わせに絞り込み。案件カテゴリ別の推奨パターンをナレッジ化 |
| 4-2 | 4つの壁仮説の精度 | 🟡 | 「見ない壁」「自分ごと化の壁」「信じない壁」「行動しない壁」の仮説生成精度。 | リサーチデータ + 過去の高効果企画の仮説パターンをFew-shotで提供。承認時のフィードバックを蓄積 |
| 4-3 | FV（ファーストビュー）の映像イメージ記述 | 🟡 | テキストで映像イメージを記述する必要がある。抽象的になりがち。 | 過去の同構成型のFV事例をビジュアル参照として添付。素材ライブラリの画像サムネイルも提示 |

**Phase 4 総評**: 自動化率 80%。パターン化しやすいフェーズ。**ナレッジ蓄積との相性が最も良い**。

---

### Phase 5: 台本制作

| # | 懸念点 | 深刻度 | 詳細 | 対策案 |
|---|--------|--------|------|--------|
| 5-1 | 「刺さるコピー」のクオリティ | 🟡 | AIの言語生成能力は高いが、広告コピーの「切れ味」は経験あるCPに劣る場合がある。 | 過去の高CVR台本をFew-shotで大量に提供。差し戻しフィードバックで継続改善 |
| 5-2 | 構成の型によるプロンプト複雑度 | 🟡 | UGC型、ドラマ型、アニメ型等で台本構成が大きく異なる。型別プロンプトの品質管理が必要。 | 各構成型のプロンプトを個別に最適化。型別のテスト台本でバリデーション |
| 5-3 | 注釈挿入の漏れリスク | 🟡 | 薬機法/景表法の判断はグレーゾーンが多い。AIの判断ミスが法的リスクになる。 | 5段階チェック（クライアント固有→過去パターン→薬機法→景表法→他案件）。漏れ候補は全てフラグ表示。最終的に人間が確認 |
| 5-4 | 60秒以内の文字数制御 | 🟢 | LLMは文字数制御が苦手。指定通りの尺に収まらないリスク。 | 文字数を後処理でバリデーション。超過時は自動リライト or 人間に通知 |
| 5-5 | フック3パターンの差別化 | 🟡 | 3パターンが似通ってしまうリスク。 | 異なる興味の型を明示的に指定（例: 商品興味 / エピソード興味 / 恐怖興味）。類似度チェックで閾値以上なら再生成 |

**Phase 5 総評**: 自動化率 75%。台本生成自体は高精度だが、**注釈の最終確認は人間必須**（法的リスク回避）。

---

### Phase 6: 編集概要（MVP最優先）

| # | 懸念点 | 深刻度 | 詳細 | 対策案 |
|---|--------|--------|------|--------|
| 6-1 | 素材マッチングの精度 | 🟡 | 台本テキストから適切な映像素材を選ぶのは高度なタスク。「意味的に合う」と「映像的に映える」は別。 | 3軸マッチング（過去実績/市場データ/コンテンツ）+ 具体マッチボーナスで精度確保。CDレビューで最終調整 |
| 6-2 | 素材の在庫不足 | 🔴 | クライアントの素材数が少ない場合、マッチする素材がない。AI生成で補完が必要。 | **NanoBanana(画像) + Kling AI(動画化)で不足素材をAI生成**（後述Part 2で詳細設計） |
| 6-3 | カット割り・テンポ感 | 🟡 | 秒数配分やカット切り替えタイミングの「気持ちよさ」は感覚的要素が大きい。 | 過去の高効果動画のカット割りパターンをナレッジ化。構成型別のテンポテンプレート |
| 6-4 | BGM/SE選定 | 🟢 | BGM/SEライブラリが整備されていればテキストマッチで十分な精度。 | ライブラリにタグ付け（雰囲気/BPM/ジャンル）。台本のセクション属性に基づいて自動選定 |
| 6-5 | テロップスタイルの最適化 | 🟡 | テロップの色/サイズ/位置/アニメーションは動画の印象を大きく左右する。 | 構成型別のデフォルトスタイル定義。過去の高効果動画のテロップパターンを学習 |

**Phase 6 総評**: 自動化率 70%。**素材不足時のAI生成がキー**。素材があれば80%+に改善。

---

### Phase 7: 動画編集（Remotion）

| # | 懸念点 | 深刻度 | 詳細 | 対策案 |
|---|--------|--------|------|--------|
| 7-1 | Remotionテンプレートの表現力限界 | 🟡 | 11構成型 × 無数のバリエーション。テンプレートでは表現しきれないケースがある。 | 初期は6-8型に絞りテンプレート品質を高める。特殊なケースは人間編集にフォールバック |
| 7-2 | 映像素材のフィット感 | 🟡 | 素材の解像度/アスペクト比/色調がバラバラで統一感が出ない。 | Remotion内でリサイズ/クロップ/カラー補正の自動処理。AI生成素材は最初から9:16/1080x1920 |
| 7-3 | ナレーション音声のクオリティ | 🟡 | TTS音声の自然さ。広告では「人間っぽさ」が重要。 | ElevenLabs（高品質）をデフォルト。案件によってはVOICEVOX/OpenAI TTS。声優録音のアップロードにも対応 |
| 7-4 | 音声と映像の同期 | 🟡 | ナレーション尺と映像カット割りのタイミングずれ。 | TTS生成後の音声尺をフレーム数に変換してRemotionに反映。セクション単位で同期 |
| 7-5 | レンダリングコスト | 🟢 | Remotion Lambda/Cloud Runの従量課金。10社×9本/週=360本/月。 | Remotion Lambdaでオンデマンド。月360本程度ならコスト許容範囲（$100-200/月想定） |
| 7-6 | 動画のセルフレビュー（品質自動判定） | 🟡 | 生成された動画の品質をAIが自動判定する仕組みがない。 | Gemini等のマルチモーダルLLMで完成動画をレビュー（テロップ可読性/素材切り替えの自然さ/音声同期）。スコアが閾値未満なら自動リテイク |

**Phase 7 総評**: 自動化率 60%（MVP時点）。テンプレート整備と**セルフレビューAIの導入**で段階的に80%に向上。

---

### Phase 8: 入稿

| # | 懸念点 | 深刻度 | 詳細 | 対策案 |
|---|--------|--------|------|--------|
| 8-1 | 入稿設定の事前整備 | 🟡 | キャンペーン構造/広告セット/LP URLなどが事前設定されている前提。未設定だと入稿失敗。 | Phase 1で運用方針設定時にキャンペーン構造も定義。未設定項目のバリデーションチェック |
| 8-2 | 媒体APIの仕様変更 | 🟡 | Meta/TikTok/YouTubeのAPI仕様は頻繁に変更される。 | APIバージョニング + 定期的な互換テスト。エラー時は即アラート |
| 8-3 | 媒体審査のリジェクト | 🟡 | 入稿しても媒体側で審査落ちする場合がある（クリエイティブポリシー違反等）。 | 審査ステータスをポーリング監視。リジェクト時は理由を解析してRegulationAgentにフィードバック。自動リライト→再入稿 or 人間通知 |
| 8-4 | LINE/X対応（TBD） | 🟢 | LINE Ads API / X Ads APIはまだ未着手。 | MVP: Meta + TikTokに集中。LINE/Xは後続フェーズで順次追加 |

**Phase 8 総評**: 自動化率 90%。技術的には最も自動化しやすいフェーズ。**事前設定の完備が前提条件**。

---

### Phase 9: 運用

| # | 懸念点 | 深刻度 | 詳細 | 対策案 |
|---|--------|--------|------|--------|
| 9-1 | ルール設計の難しさ | 🟡 | 案件ごとに最適な停止/拡大/縮小条件が異なる。汎用ルールでは判断ミスが起きうる。 | テンプレートルール + 案件個別チューニング。MPが初期ルールを設定し、運用データに基づいてAIがルール改善提案 |
| 9-2 | 予算の暴走リスク | 🔴 | 拡大判断のミスで意図しない大量予算消化が発生するリスク。 | **日次予算上限をハードリミットとして設定**。拡大時も上限の120%を超えない制約。閾値超過時は即停止 + 人間通知 |
| 9-3 | 外部要因への対応 | 🟡 | 季節変動/競合出稿/プラットフォーム変更などの外部要因でKPIが急変する。 | 異常値検知（標準偏差2σ以上の変動）→人間にアラート。ルールベースでは対応しきれない場合は人間判断 |
| 9-4 | CATS CV vs 実CVの乖離 | 🟡 | CATS計測のCVと実際のCVに乖離がある。乖離率が変動するとルール判断が狂う。 | 日次でCATS CV ↔ 実CV突合。乖離率がX%以上変動したらアラート。将来的にはCATS脱却 |
| 9-5 | 複数媒体間の予算配分 | 🟡 | Meta/TikTok/YouTube間の予算最適配分は高度な判断。 | MVP: 媒体別に独立して運用判断。将来: クロスプラットフォーム最適化エンジン |

**Phase 9 総評**: 自動化率 70%。**予算暴走防止のセーフガードが最重要**。初期は人間確認を挟むのが安全。

---

### Phase 10: レポーティング

| # | 懸念点 | 深刻度 | 詳細 | 対策案 |
|---|--------|--------|------|--------|
| 10-1 | データの正確性担保 | 🟡 | 複数媒体 × Gross/Net × CATS/実CV → データ突合ミスが致命的。 | 自動突合チェック + 不整合データのフラグ表示。月次でデータ監査プロセス |
| 10-2 | クライアント向けレポートの表現 | 🟡 | 数値の羅列では伝わらない。「だから何をすべきか」のインサイトが重要。 | AIが数値分析 + ネクストアクション提案を自動生成。MPが最終レビューしてから提出 |
| 10-3 | 視聴維持率データの取得 | 🟡 | 秒単位の視聴維持率はMeta APIでは取得が限定的。TikTokは比較的取得しやすい。 | 取得可能な粒度で分析（25%/50%/75%/100%再生 + 平均視聴時間）。詳細維持率は媒体管理画面から手動取得 or API改善待ち |
| 10-4 | 検証レポートの仮説評価 | 🟡 | 「この訴求は効果があったか」の判定は統計的有意性が必要。サンプルサイズ不足の場合の判断。 | 最低必要CV数を設定（例: 50CV以上で評価確定）。サンプル不足は「評価保留」としてフラグ |

**Phase 10 総評**: 自動化率 80%。データ集計・グラフ生成は完全自動。**インサイト記述の最終レビューは人間**。

---

### 横断的な懸念点

| # | 懸念点 | 深刻度 | 詳細 | 対策案 |
|---|--------|--------|------|--------|
| X-1 | Notionの承認ポーリング遅延 | 🟡 | 30秒間隔ポーリング。承認から最大30秒のラグ。Webhookがないため回避不可。 | 許容範囲内（30秒は業務フローでは問題なし）。将来Notion Webhook対応時に移行 |
| X-2 | Notion APIのレート制限 | 🟡 | 3req/秒。10テナント同時処理時にボトルネック。 | p-queueでキューイング + テナント間の処理分散 |
| X-3 | LLMコスト | 🟡 | 全フェーズでClaude API呼び出し。10社×月80企画=800回+ | Sonnetモデル使用でコスト最適化。キャッシュ活用（同一テナントの同構成型は一部キャッシュ可） |
| X-4 | 障害時のリカバリ | 🟡 | フェーズ途中で障害が発生した場合の復旧。部分的に実行済みのデータ整合性。 | 各フェーズをアトミックに設計（成功/失敗の2値）。失敗時は該当フェーズから再実行可能 |
| X-5 | ナレッジのコールドスタート問題 | 🟡 | 新規案件開始時はナレッジが空。過去実績マッチ（軸1）が機能しない。 | 汎用ナレッジ（業界共通パターン）を事前投入。3サイクル（3週間）でテナント固有ナレッジが蓄積開始 |
| X-6 | コミュニケーション自動取り込みの誤分類 | 🟡 | LLM分類の精度。特にmaterial/regulation/feedbackの境界が曖昧な場合。 | 確信度70%未満は「unknown」→人間確認。誤分類フィードバックをファインチューニングデータとして蓄積 |

---

### Phase別 自動化率サマリー

| Phase | 自動化率（MVP） | 自動化率（成熟期） | ボトルネック |
|-------|-----------------|-------------------|-------------|
| 1. セットアップ | 20% | 40% | 人間のインプットが本質的に必要 |
| 2. リサーチ | 60-70% | 80% | N1インタビュー、深いインサイト |
| 3. 訴求開発 | 70% | 85% | 斬新な切り口の発見力 |
| 4. 広告企画 | 80% | 90% | ナレッジ蓄積次第で向上 |
| 5. 台本制作 | 75% | 85% | 注釈の法的リスク判断 |
| 6. 編集概要 | 70% | 85% | 素材不足時のAI生成 |
| 7. 動画編集 | 60% | 80% | テンプレート表現力、セルフレビュー |
| 8. 入稿 | 90% | 95% | 事前設定の完備が前提 |
| 9. 運用 | 70% | 85% | 予算暴走防止、外部要因 |
| 10. レポーティング | 80% | 90% | インサイト記述の質 |

**全体の加重平均自動化率: MVP時点 約68% → 成熟期 約82%**

---

## Part 2: 素材AI生成（NanoBanana2 + Kling AI）の組み込み設計

### 1. 設計思想: 「実素材ファースト + AI生成オプション」

素材の調達は基本的に人間が行う（撮影/購入/クライアント提供）。
AIは**人間が「この素材はAIで作りたい」と判断した時に使える道具**として組み込む。

```
素材の調達パターン:

1. 実素材あり → そのまま使う（大半のケース）
   └── クライアント提供/撮影素材/ストック素材/過去案件の汎用素材

2. 実素材なし + 人間が「AI生成でOK」と判断 → AI生成
   ├── 画像: NanoBanana2 で生成
   ├── 動画: NanoBanana2 → Kling AI で Image-to-Video
   └── 画像加工: NanoBanana2 edit_image で既存素材を加工

3. 実素材なし + AI生成不適切 → 人間が調達（撮影依頼/ストック購入等）
```

**ポイント**: AI生成は自動で勝手に発動するのではなく、以下の2パターンで使う:
- **パターンA**: 編集概要作成時、素材が不足しているセクションに対してAIが「AI生成で補完可能」と提案 → CDが承認すれば生成
- **パターンB**: CDが直接「このカットはAI生成で」と指示 → 即生成

### 2. 素材ソースの分類と優先順位

```
MaterialMatchSkill の素材選定フロー:

[台本セクション]
    │
    ▼
Step 1: 既存素材の検索（3軸マッチング）
    ├── 軸1: 過去実績マッチ（過去の類似台本で使われた素材）
    ├── 軸2: 市場データマッチ（動画広告分析Pro経由）
    └── 軸3: コンテンツマッチ（テキスト↔素材ベクトル類似度）
    │
    ▼
Step 2: 結果判定
    ├── 十分な候補あり → 既存素材を選定（通常フロー）
    │
    └── 候補不足 or スコア低い
        ├── 既存素材の中でベストを「仮選定」としてセット
        └── 同時に「AI生成候補」を提案として併記
            ├── 画像生成プロンプト案（NanoBanana2用）
            ├── 動画生成の場合はモーション指示案（Kling AI用）
            └── フラグ: needs_material = true
    │
    ▼
Step 3: CD（クリエイティブディレクター）がNotion上で判断
    ├── 「仮選定の既存素材でOK」 → そのまま進行
    ├── 「AI生成で」 → AI生成を実行
    ├── 「別の既存素材を指定」 → 手動で差し替え
    └── 「撮影/購入で調達」 → 調達タスク発行
```

### 3. NanoBanana2 MCP 連携設計

#### 3.1 スキル構成

```
packages/skills/src/nanobanana2/
├── skill.ts              # NanoBanana2Skill本体
├── prompt-generator.ts   # 台本→画像生成プロンプト変換
└── index.ts
```

#### 3.2 NanoBanana2Skill

```typescript
class NanoBanana2Skill {
  /**
   * 新規画像生成
   * 用途: 素材が存在しないカットの画像をAI生成
   */
  async generateImage(
    prompt: string,
    outputPath: string,
  ): Promise<GeneratedMaterial> {
    const result = await mcp.nanobanana.generate_image({
      prompt,
      output_path: outputPath,
    });

    return {
      type: 'image',
      localPath: outputPath,
      prompt,
      generatedAt: new Date(),
    };
  }

  /**
   * 既存画像の編集
   * 用途: 既存素材の背景変更/色調補正/不要要素除去/スタイル変換等
   */
  async editImage(
    imagePath: string,
    editPrompt: string,
    outputPath: string,
  ): Promise<GeneratedMaterial> {
    const result = await mcp.nanobanana.edit_image({
      image_path: imagePath,
      prompt: editPrompt,
      output_path: outputPath,
    });

    return {
      type: 'image',
      localPath: outputPath,
      prompt: editPrompt,
      generatedAt: new Date(),
      isEdit: true,
      sourceImagePath: imagePath,
    };
  }
}
```

#### 3.3 プロンプト生成（台本テキスト → 画像生成プロンプト）

```typescript
async function generateMaterialPrompt(req: {
  section: ScriptSection;
  scriptText: string;
  structureType: StructureType;
  concept: string;
  targetAudience: string;
  styleGuide?: StyleGuide;
}): Promise<string> {
  return await llm.generate({
    systemPrompt: `あなたは広告用ビジュアル素材のプロンプトエンジニアです。
    台本セクションに最適な画像生成プロンプトを作成してください。

    ルール:
    - 9:16の縦型フォーマットを前提
    - 広告らしいクリーンな画像
    - テキストオーバーレイの余白を確保（上部1/4と下部1/4）
    - ブランドカラーがある場合は色調を合わせる
    - 構成の型に合ったスタイル（${req.structureType}）
    - リアルな写真風 or イラスト風は構成の型に従う`,
    userPrompt: `
    セクション: ${req.section}
    台本テキスト: "${req.scriptText}"
    構成の型: ${req.structureType}
    コンセプト: ${req.concept}
    ターゲット: ${req.targetAudience}`,
  });
}
```

#### 3.4 NanoBanana2 活用シーン

| カテゴリ | generate_image | edit_image |
|---------|:---:|:---:|
| 商品イメージ（背景違い） | - | o（背景変更） |
| ライフスタイルシーン | o | - |
| ビフォーアフター比較画像 | o | - |
| アニメ/イラスト素材 | o | o（写真→イラスト変換） |
| テキストバナー/オファー画像 | o | - |
| 既存素材の色調統一 | - | o（カラー補正） |
| 不要ロゴ/テキストの除去 | - | o |
| 背景の差し替え | - | o |

### 4. Kling AI 連携設計

#### 4.1 スキル構成

```
packages/skills/src/kling/
├── skill.ts              # KlingSkill本体（Image-to-Video API）
├── motion-prompt.ts      # 動きプロンプト生成
└── index.ts
```

#### 4.2 KlingSkill

```typescript
class KlingSkill {
  private readonly apiUrl = 'https://api.klingai.com/v1';
  private readonly apiKey: string;

  /**
   * 画像→動画変換
   * 用途: NanoBanana2で生成した画像 or 既存画像を動画化
   */
  async generateVideo(req: {
    imageUrl: string;       // 入力画像URL
    prompt: string;         // 動きの指示（英語）
    duration: 5 | 10;       // 生成尺（秒）
    aspectRatio: '9:16';    // 縦型固定
    mode: 'standard' | 'professional';
  }): Promise<{ videoUrl: string; taskId: string }> {
    // 1. タスク作成
    const task = await this.createTask({
      model: 'kling-v2',
      input: { image_url: req.imageUrl, prompt: req.prompt },
      config: {
        duration: req.duration,
        aspect_ratio: req.aspectRatio,
        mode: req.mode,
      },
    });

    // 2. 完了ポーリング（最大5分）
    const result = await this.pollCompletion(task.id);
    return { videoUrl: result.output.video_url, taskId: task.id };
  }

  private async createTask(params: any): Promise<{ id: string }> { /* API呼び出し */ }
  private async pollCompletion(taskId: string): Promise<any> { /* ポーリング */ }
}
```

#### 4.3 動きプロンプト生成

```typescript
async function generateMotionPrompt(
  section: ScriptSection,
  scriptText: string,
  structureType: StructureType,
): Promise<string> {
  return await llm.generate({
    systemPrompt: `Image-to-Video変換のモーション指示を英語で作成。
    ルール: 短く1-2文。カメラワーク含める。5-10秒向け。広告的な引きを意識。`,
    userPrompt: `セクション: ${section}\n台本: "${scriptText}"\n構成の型: ${structureType}`,
  });
}
```

#### 4.4 Kling AI 利用シーン

| シーン | 入力 | 動画化の効果 |
|--------|------|-------------|
| 人物リアクション | 人物の静止画 | 表情変化/瞬き/溜息 |
| 商品使用 | 商品を手に持つ画像 | 塗布/使用の動き |
| 自然風景 | 風景画像 | 波/光/風の動き |
| ズーム/パン | 商品クローズアップ | カメラワーク |
| パッケージ回転 | 商品正面画像 | 立体的な回転表示 |

### 5. MaterialMatchSkillへの統合

既存のMaterialMatchSkillに「AI生成提案」機能を追加する。独立したMaterialGenerationSkillは作らない。

```typescript
// MaterialMatchSkillの拡張（既存の3軸マッチングに追加）
class MaterialMatchSkill {
  constructor(
    private nanoBanana2: NanoBanana2Skill,
    private kling: KlingSkill,
    private driveSkill: DriveSkill,
    private llm: LLMSkill,
  ) {}

  /**
   * 素材選定のメインメソッド
   * 既存素材マッチング + 不足時にAI生成提案を返す
   */
  async matchWithAiSuggestion(input: {
    sectionText: string;
    section: ScriptSection;
    tenantId: string;
    structureType: StructureType;
    concept: string;
    targetAudience: string;
    topK?: number;
  }): Promise<MaterialMatchResult> {

    // 1. 既存素材から3軸マッチング（従来通り）
    const existingCandidates = await this.matchExisting({
      sectionText: input.sectionText,
      tenantId: input.tenantId,
      topK: input.topK ?? 5,
    });

    const bestMatch = existingCandidates[0];
    const hasSufficientMatch = bestMatch && bestMatch.score >= 0.6;

    // 2. 結果を構築
    const result: MaterialMatchResult = {
      existingCandidates,
      selected: hasSufficientMatch ? bestMatch : bestMatch ?? null,
      needsMaterial: !hasSufficientMatch,
    };

    // 3. 素材不足の場合、AI生成の提案を併記
    if (!hasSufficientMatch) {
      result.aiSuggestion = await this.buildAiSuggestion(input);
    }

    return result;
  }

  /**
   * AI生成提案を構築（実際の生成は行わない、提案のみ）
   */
  private async buildAiSuggestion(input: {
    section: ScriptSection;
    sectionText: string;
    structureType: StructureType;
    concept: string;
    targetAudience: string;
  }): Promise<AiMaterialSuggestion> {
    const imagePrompt = await generateMaterialPrompt({
      section: input.section,
      scriptText: input.sectionText,
      structureType: input.structureType,
      concept: input.concept,
      targetAudience: input.targetAudience,
    });

    const needsVideo = this.shouldGenerateVideo(input.section, input.structureType);

    return {
      type: needsVideo ? 'image_to_video' : 'image_only',
      imagePrompt,
      motionPrompt: needsVideo
        ? await generateMotionPrompt(input.section, input.sectionText, input.structureType)
        : undefined,
      estimatedCost: needsVideo ? '$0.24' : '$0.04',
      reason: `台本「${input.sectionText.substring(0, 30)}...」に適合する既存素材が不足`,
    };
  }

  /**
   * AI生成を実行（CDが承認した後に呼ばれる）
   */
  async executeAiGeneration(
    suggestion: AiMaterialSuggestion,
    tenantId: string,
    section: ScriptSection,
  ): Promise<MaterialCandidate> {

    // 画像生成
    const outputPath = `/tmp/materials/${tenantId}/${crypto.randomUUID()}.png`;
    const image = await this.nanoBanana2.generateImage(suggestion.imagePrompt, outputPath);
    const driveUrl = await this.driveSkill.upload(
      image.localPath,
      `clients/${tenantId}/materials/ai-generated/`,
    );

    // 動画化が必要な場合
    let finalUrl = driveUrl;
    let source: string = 'nanobanana2';

    if (suggestion.type === 'image_to_video' && suggestion.motionPrompt) {
      const video = await this.kling.generateVideo({
        imageUrl: driveUrl,
        prompt: suggestion.motionPrompt,
        duration: 5,
        aspectRatio: '9:16',
        mode: 'professional',
      });

      const videoPath = `/tmp/materials/${tenantId}/${crypto.randomUUID()}.mp4`;
      await downloadFile(video.videoUrl, videoPath);
      finalUrl = await this.driveSkill.upload(
        videoPath,
        `clients/${tenantId}/materials/ai-generated/`,
      );
      source = 'nanobanana2+kling';
    }

    // 素材DBに登録（ステータス: AI生成）
    const materialId = await this.registerMaterial({
      tenantId,
      type: suggestion.type === 'image_to_video' ? 'video' : 'image',
      url: finalUrl,
      prompt: suggestion.imagePrompt,
      section,
      source,
      status: 'ai_generated',
    });

    return { materialId, url: finalUrl, isAiGenerated: true, source };
  }

  private shouldGenerateVideo(section: ScriptSection, structureType: StructureType): boolean {
    // アニメ/イラスト/バナー型は静止画で十分
    if (['anime', 'illustration', 'banner_video'].includes(structureType)) return false;
    // フック/共感/商品紹介は動画が効果的
    return ['hook', 'empathy', 'product'].includes(section);
  }
}
```

### 6. 型定義

```typescript
interface MaterialMatchResult {
  existingCandidates: MaterialCandidate[];  // 既存素材の候補一覧
  selected: MaterialCandidate | null;       // 自動選定された素材（ベスト）
  needsMaterial: boolean;                   // 素材不足フラグ
  aiSuggestion?: AiMaterialSuggestion;      // AI生成の提案（needsMaterial=true時）
}

interface AiMaterialSuggestion {
  type: 'image_only' | 'image_to_video';
  imagePrompt: string;          // NanoBanana2用プロンプト
  motionPrompt?: string;        // Kling AI用モーション指示
  estimatedCost: string;
  reason: string;
}

interface MaterialCandidate {
  materialId: string;
  materialName?: string;
  url: string;
  score: number;
  reason: string;
  isAiGenerated: boolean;
  source?: string;              // 'existing' | 'nanobanana2' | 'nanobanana2+kling'
  editInstructions?: string;    // 既存素材の加工指示（edit_image用）
}
```

### 7. Notion上での素材選定UI（CDのワークフロー）

```
編集概要DB（Notion）:
┌──────────────────────────────────────────────────────────┐
│ カット1: [フック]                                         │
│ 台本: 「毎朝、枕についた大量の抜け毛を見て...」           │
│                                                          │
│ ▼ 素材選定                                               │
│ ┌─ 自動選定: 抜け毛悩みシーン.mp4 (スコア: 0.72) ── [採用]│
│ ├─ 候補2: 朝の洗面台シーン.mp4 (スコア: 0.58)            │
│ └─ 候補3: ※スコア不足                                    │
│                                                          │
│ 💡 AI生成提案:                                           │
│    「40代男性が朝、鏡の前で髪を気にしている写真風画像」    │
│    → Kling AIで動画化（溜息をつく動き）                   │
│    コスト: ~$0.24                                        │
│    [AI生成を実行] [スキップ]                              │
├──────────────────────────────────────────────────────────┤
│ カット2: [自分ごと化]                                     │
│ 台本: 「実はそれ、頭皮環境の悪化サインかも...」           │
│                                                          │
│ ▼ 素材選定                                               │
│ ┌─ 自動選定: 頭皮アップ素材.mp4 (スコア: 0.85) ── [採用] │
│ └─ ※十分なスコア。AI生成提案なし                         │
└──────────────────────────────────────────────────────────┘
```

### 8. AI生成素材の品質管理

```
AI生成素材のライフサイクル:

[生成] → ステータス: "AI生成"
    │
    ▼
[CDレビュー]（Notion上で確認）
    ├── 「利用可」→ ステータス変更 → 素材ライブラリに追加（以後再利用可能）
    ├── 「要修正」→ NanoBanana2 edit_image で修正 → 再レビュー
    └── 「不採用」→ ステータス: "利用禁止" → マッチング対象外

※一度「利用可」になったAI生成素材は、以後の他案件・他動画でも
  3軸マッチングの対象として通常素材と同等に扱われる
```

### 9. スキル一覧（更新版）

```
packages/skills/src/
├── material-match/          # MaterialMatchSkill（既存 + AI生成提案統合）
│   ├── matcher.ts           # 3軸マッチング
│   ├── scoring.ts           # スコアリング
│   ├── ai-suggestion.ts     # AI生成提案ロジック
│   ├── ai-executor.ts       # AI生成実行（NanoBanana2 + Kling呼び出し）
│   ├── embedding.ts         # エンベディング生成
│   ├── frame-extractor.ts   # FFmpegフレーム抽出
│   └── index.ts
│
├── nanobanana2/             # NanoBanana2 MCP連携
│   ├── skill.ts             # generate_image / edit_image
│   ├── prompt-generator.ts  # 台本→画像生成プロンプト変換
│   └── index.ts
│
└── kling/                   # Kling AI API連携
    ├── skill.ts             # Image-to-Video
    ├── motion-prompt.ts     # 動きプロンプト生成
    └── index.ts
```

### 10. 環境変数追加

```env
# Kling AI
KLING_API_KEY=
KLING_API_URL=https://api.klingai.com/v1

# NanoBanana2 (MCP経由のため追加設定不要、.mcp.jsonで設定済み)

# AI素材生成設定
AI_MATERIAL_MATCH_THRESHOLD=0.6     # この閾値未満でAI生成を提案
AI_MATERIAL_MAX_RETRIES=3           # 品質不合格時の再生成上限
```

### 11. コスト見積もり

| サービス | 単価（概算） | 備考 |
|---------|-------------|------|
| NanoBanana2 (Gemini) | ~$0.04/画像 | 画像生成 + 画像編集 |
| Kling AI Professional | ~$0.20/5秒動画 | Image-to-Video |

※実際のコストは「AI生成を選択した回数」に依存。
  全素材をAI生成する想定ではなく、既存素材で足りないカットのみ。
  10社運用で月$50-150程度を想定。

---

## 次のアクション

1. [ ] Part 1の懸念点リストをチームでレビュー（特に🔴の項目）
2. [ ] Phase 9の予算暴走防止セーフガードの詳細設計
3. [ ] Kling AI APIの調査（アカウント作成/API仕様確認/料金プラン）
4. [ ] Sprint 0の実装開始
