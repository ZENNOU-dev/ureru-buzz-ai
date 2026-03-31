# Cloud Run Job: 要件ギャップ Issue 一括作成（Secret Manager のみに PAT）

ローカルに PAT を置かず、**Google Secret Manager** に保存した `GITHUB_TOKEN` を **Cloud Run Job** 実行時だけコンテナ環境変数に注入して `scripts/create-requirement-gap-issues.mjs` を走らせる。

## 前提

- GCP プロジェクトと課金有効
- `gcloud` CLI と Docker（または Cloud Build のみ）
- GitHub PAT（Fine-grained なら対象リポで **Issues: Read and write**。Classic なら `repo` 相当）

## 変数（自分の環境に合わせて置き換え）

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="asia-northeast1"
export AR_REPO="ureru-buzz"                    # Artifact Registry リポジトリ名（任意）
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/github-issue-job:latest"
export SECRET_ID="github-pat-issues"          # Secret Manager の名前
export JOB_NAME="requirement-gap-issues"
export SA_ID="issue-job-runner"                 # 実行用サービスアカウント
export GITHUB_REPOSITORY="owner/repo"       # 例: BONNOU-inc/ureru-buzz-ai
```

## 1. Secret Manager に PAT を 1 回だけ登録

ターミナルに履歴を残したくない場合は、入力後に履歴削除するか、コンソールの「シークレットの値を追加」UIを利用。

```bash
gcloud config set project "${PROJECT_ID}"
echo -n "ghp_またはgithub_pat_で始まるトークン" | gcloud secrets create "${SECRET_ID}" --data-file=-
# 既にシークレットがある場合はバージョン追加:
# echo -n "..." | gcloud secrets versions add "${SECRET_ID}" --data-file=-
```

## 2. Artifact Registry とビルド

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

gcloud artifacts repositories create "${AR_REPO}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="ureru-buzz-ai deploy" 2>/dev/null || true

gcloud builds submit . \
  --config deploy/github-issue-job/cloudbuild.yaml \
  --substitutions=_IMAGE="${IMAGE}"
```

（ローカル Docker の例: `docker build -f deploy/github-issue-job/Dockerfile -t "${IMAGE}" .` のあと `docker push "${IMAGE}"`。）

## 3. 実行用サービスアカウントと権限

```bash
gcloud iam service-accounts create "${SA_ID}" \
  --display-name="Cloud Run job: GitHub issue creator" 2>/dev/null || true

SA_EMAIL="${SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud secrets add-iam-policy-binding "${SECRET_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"
```

## 4. Cloud Run Job の作成・更新

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

## 5. 実行（都度、端末に PAT は出ない）

```bash
gcloud run jobs execute "${JOB_NAME}" --region="${REGION}" --wait
```

ログ確認:

```bash
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=${JOB_NAME}" \
  --limit=50 --format=json --project="${PROJECT_ID}"
```

## セキュリティメモ

- Job を実行できる IAM 主体（開発者のユーザー／グループ）を最小限にする。`roles/run.developer` + 必要なら Invoker は Job には通常不要（`execute` は別権限）。
- PAT はローテーション時に Secret Manager に **新バージョン** を追加し、Job は `latest` で取る。
- 同一イメージで別リポ向けにしたい場合は `GITHUB_REPOSITORY` を Job の env で変更。

## トラブルシュート

| 症状 | 確認 |
|------|------|
| `GITHUB_TOKEN が空` | `--set-secrets` のキー名が `GITHUB_TOKEN` か、SA に `secretAccessor` があるか |
| `401/403` | PAT の権限・対象リポジトリ（Fine-grained） |
| イシューが増えない | 既に同タイトル＋ラベル `要件ギャップ` でスキップされている（仕様） |
