# Cloud Run Job: 要件ギャップ Issue 一括作成（Secret Manager のみに PAT）

ローカルに PAT を置かず、**Google Secret Manager** に保存した `GITHUB_TOKEN` を **Cloud Run Job** 実行時だけコンテナ環境変数に注入して `scripts/create-requirement-gap-issues.mjs` を走らせる。

## 前提

- GCP プロジェクトと課金有効
- `gcloud` CLI と Docker（または Cloud Build のみ）
- GitHub PAT（Fine-grained なら対象リポで **Issues: Read and write**。Classic なら `repo` 相当）

## 変数（自分の環境に合わせて置き換え）

```bash
export PROJECT_ID="gen-lang-client-0001618902"
export REGION="asia-northeast1"
export AR_REPO="ureru-buzz"                    # Artifact Registry リポジトリ名（任意）
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/github-issue-job:latest"
export SECRET_ID="github-token"               # Secret Manager の名前
export JOB_NAME="requirement-gap-issues"
export SA_ID="issue-job-runner"                # 実行用サービスアカウント
export GITHUB_REPOSITORY="BONNOU-inc/ureru-buzz-ai"
```

## 1. Secret Manager に PAT を登録（初回のみ）

既に `github-token` が登録済みなら **スキップ**。
ターミナルに履歴を残したくない場合は、先頭にスペースを入れるか、GCP コンソールの UI を利用。

```bash
gcloud config set project "${PROJECT_ID}"

# 新規作成
echo -n "ghp_またはgithub_pat_で始まるトークン" | gcloud secrets create "${SECRET_ID}" --data-file=-

# 既にシークレットがある場合はバージョン追加:
# echo -n "..." | gcloud secrets versions add "${SECRET_ID}" --data-file=-
```

## 2. API 有効化と Artifact Registry

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com

gcloud artifacts repositories create "${AR_REPO}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="ureru-buzz-ai deploy" 2>/dev/null || true
```

## 3. Cloud Build でイメージをビルド・プッシュ

```bash
gcloud builds submit . \
  --config deploy/github-issue-job/cloudbuild.yaml \
  --substitutions=_IMAGE="${IMAGE}"
```

（ローカル Docker の例: `docker build -f deploy/github-issue-job/Dockerfile -t "${IMAGE}" .` → `docker push "${IMAGE}"`）

## 4. 実行用サービスアカウントと権限

```bash
gcloud iam service-accounts create "${SA_ID}" \
  --display-name="Cloud Run job: GitHub issue creator" 2>/dev/null || true

SA_EMAIL="${SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

# SA が Secret を読めるようにする
gcloud secrets add-iam-policy-binding "${SECRET_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"
```

## 5. Cloud Run Job の作成

```bash
gcloud run jobs deploy "${JOB_NAME}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --service-account="${SA_EMAIL}" \
  --set-secrets="GITHUB_TOKEN=${SECRET_ID}:latest" \
  --set-env-vars="GITHUB_REPOSITORY=${GITHUB_REPOSITORY}" \
  --max-retries=0 \
  --task-timeout=10m \
  --tasks=1
```

## 6. 実行（端末に PAT は出ない）

```bash
gcloud run jobs execute "${JOB_NAME}" --region="${REGION}" --wait
```

ログ確認:

```bash
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=${JOB_NAME}" \
  --limit=50 --format=json --project="${PROJECT_ID}"
```

## チームメンバーへの実行権限の付与

Job の実行だけ許可し、Secret（PAT）の中身は見せない構成。

```bash
# メンバーの Google アカウントに Job 実行権限を付与
gcloud run jobs add-iam-policy-binding "${JOB_NAME}" \
  --region="${REGION}" \
  --member="user:someone@example.com" \
  --role="roles/run.invoker"

# 複数人をまとめて管理したい場合は Google Group を作って group: で指定
# gcloud run jobs add-iam-policy-binding "${JOB_NAME}" \
#   --region="${REGION}" \
#   --member="group:dev-team@bonnou.co.jp" \
#   --role="roles/run.invoker"
```

**権限の整理:**

| ロール | 誰が持つ | できること |
|--------|----------|------------|
| `roles/run.invoker` | チームメンバー | Job の実行のみ |
| `roles/run.developer` | 管理者 | Job の作成・更新・実行 |
| `roles/secretmanager.secretAccessor` | SA のみ | Secret の読み取り（人間には付けない） |

メンバーは `gcloud run jobs execute requirement-gap-issues --region=asia-northeast1 --wait` で実行できるが、PAT の生値にはアクセスできない。

## セキュリティメモ

- PAT はローテーション時に Secret Manager に **新バージョン** を追加し、Job は `latest` で取る。
- 同一イメージで別リポ向けにしたい場合は `GITHUB_REPOSITORY` を Job の env で変更。
- `roles/secretmanager.secretAccessor` は SA にだけ付与する。人間のアカウントには付けない。

## トラブルシュート

| 症状 | 確認 |
|------|------|
| `GITHUB_TOKEN が空` | `--set-secrets` のキー名が `GITHUB_TOKEN` か、SA に `secretAccessor` があるか |
| `401/403` | PAT の権限・対象リポジトリ（Fine-grained）。リポ名がリネーム前の旧名になっていないか |
| イシューが増えない | 既に同タイトル＋ラベル `要件ギャップ` でスキップされている（仕様） |
| `Cannot convert argument to a ByteString` | GITHUB_TOKEN に日本語や全角文字が混入。`ghp_` / `github_pat_` で始まるトークンのみ貼る |

## 将来用: GitHub Actions から Job を実行する（WIF）

Workload Identity Federation（WIF）で GitHub Actions → GCP の認証を行い、`gcloud run jobs execute` を叩く構成。SA キーの発行は不要。

```yaml
# .github/workflows/run-issue-job.yml（案）
name: Run requirement-gap-issues
on:
  workflow_dispatch:
permissions:
  id-token: write
  contents: read
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
          service_account: "issue-job-runner@gen-lang-client-0001618902.iam.gserviceaccount.com"
      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud run jobs execute requirement-gap-issues --region=asia-northeast1 --wait
```

WIF プール・プロバイダの作成手順は [公式ドキュメント](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines) を参照。
