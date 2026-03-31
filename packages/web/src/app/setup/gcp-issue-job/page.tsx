"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  ChevronRight,
  ClipboardList,
} from "lucide-react";

const LINKS = {
  githubFineGrained:
    "https://github.com/settings/personal-access-tokens?type=fine_grained",
  githubClassic: "https://github.com/settings/tokens",
  gcpHome: "https://console.cloud.google.com/welcome",
  secretManager: "https://console.cloud.google.com/security/secret-manager",
} as const;

function OpenLinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#9333EA] hover:bg-[#7c2dca] transition-colors shadow-sm"
    >
      {children}
      <ExternalLink className="w-4 h-4 opacity-90" />
    </a>
  );
}

export default function GcpIssueJobSetupPage() {
  const [projectId, setProjectId] = useState("");
  const [region, setRegion] = useState("asia-northeast1");
  const [secretName, setSecretName] = useState("github-token");
  const [repoFull, setRepoFull] = useState("BONNOU-inc/ureru-buzz-ai");
  const [tokenMemo, setTokenMemo] = useState("");
  const [copied, setCopied] = useState(false);

  const deployReadmeUrl = useMemo(() => {
    const r = repoFull.trim() || "owner/repo";
    return `https://github.com/${r}/blob/main/deploy/github-issue-job/README.md`;
  }, [repoFull]);

  const engineerNote = useMemo(() => {
    return `【Cloud Run Job セットアップ依頼】

以下の値で deploy/github-issue-job/README.md の手順を進めてください。

- GCP プロジェクトID: ${projectId || "（未記入）"}
- リージョン: ${region || "（未記入）"}
- Artifact Registry リポジトリ名: （README の AR_REPO、例: ureru-buzz）
- Secret Manager シークレット名: ${secretName || "（未記入）"}
- GitHub リポジトリ (owner/repo): ${repoFull || "（未記入）"}

※ PAT は Secret Manager にのみ保存済みであること。
※ イメージビルド・Job デプロイ・IAM（secretAccessor）はエンジニア作業。`;
  }, [projectId, region, secretName, repoFull]);

  async function copyEngineerNote() {
    await navigator.clipboard.writeText(engineerNote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto pb-16">
      <div className="mb-2">
        <Link
          href="/projects"
          className="text-[13px] text-[#9333EA] font-medium hover:underline inline-flex items-center gap-1"
        >
          ← 制作一覧に戻る
        </Link>
      </div>

      <div className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
          <ClipboardList className="w-6 h-6 text-[#9333EA]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#1A1A2E] leading-tight">
            GitHub 連携の準備（かんたん）
          </h1>
          <p className="text-sm text-[#1A1A2E]/50 mt-1">
            Google にトークンだけ預けて、あとはエンジニアに任せる流れです。順番に画面を開いて記入してください。
          </p>
        </div>
      </div>

      <div className="content-card rounded-xl p-4 mb-6 border-l-4 border-amber-400 bg-amber-50/40">
        <div className="flex gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[13px] text-[#1A1A2E]/80 leading-relaxed">
            <p className="font-bold text-amber-900 mb-1">大切なお願い</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                下の「トークン用メモ欄」は<strong>あなたのブラウザの中だけ</strong>に保存されます（サーバーには送られません）。
              </li>
              <li>
                それでも<strong>作業が終わったら消す</strong>か、ブラウザを閉じるのが安全です。
              </li>
              <li>
                <strong>Google の Secret Manager の画面</strong>にトークンを貼り付けて保存してください（そこが正規の保管場所です）。
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 記入欄（全体） */}
      <section className="content-card rounded-xl p-5 mb-8">
        <h2 className="text-sm font-bold text-[#1A1A2E] mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-[#9333EA]/10 text-[#9333EA] text-xs font-black flex items-center justify-center">
            0
          </span>
          先にメモ（いつでも戻って編集できます）
        </h2>
        <div className="grid gap-4">
          <label className="block">
            <span className="text-[12px] font-semibold text-[#1A1A2E]/60">GCP プロジェクト ID</span>
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="例: my-company-prod"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-black/[0.08] text-sm text-[#1A1A2E] placeholder:text-[#1A1A2E]/25"
            />
            <span className="text-[11px] text-[#1A1A2E]/35 mt-1 block">
              Google Cloud 画面上部の「プロジェクトを選択」からコピーできます。
            </span>
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-[#1A1A2E]/60">リージョン（そのままでOKなことが多いです）</span>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-black/[0.08] text-sm text-[#1A1A2E]"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-[#1A1A2E]/60">Secret Manager の名前（英語・推奨）</span>
            <input
              value={secretName}
              onChange={(e) => setSecretName(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-black/[0.08] text-sm text-[#1A1A2E]"
            />
            <span className="text-[11px] text-[#1A1A2E]/35 mt-1 block">
              迷ったら <code className="bg-black/[0.04] px-1 rounded">github-token</code> のままで大丈夫です。
            </span>
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-[#1A1A2E]/60">GitHub リポジトリ（会社のリポ名）</span>
            <input
              value={repoFull}
              onChange={(e) => setRepoFull(e.target.value)}
              placeholder="例: 組織名/リポジトリ名"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-black/[0.08] text-sm text-[#1A1A2E]"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-[#1A1A2E]/60">
              トークン用メモ欄（一時的・ブラウザ内だけ）
            </span>
            <textarea
              value={tokenMemo}
              onChange={(e) => setTokenMemo(e.target.value)}
              rows={3}
              placeholder="GitHub で表示された ghp_ または github_pat_ で始まる文字列を、ここに一時的に貼ってから Secret Manager に移す…"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-black/[0.08] text-sm text-[#1A1A2E] placeholder:text-[#1A1A2E]/25 font-mono"
            />
          </label>
        </div>
      </section>

      {/* Step 1 */}
      <StepCard
        step={1}
        title="GitHub で「トークン」を発行する"
        body={
          <>
            <p className="text-[13px] text-[#1A1A2E]/70 mb-4">
              会社の GitHub にログインした状態で、次のどちらかを開きます（わからなければ上の「Fine-grained」を試してください）。
            </p>
            <ul className="space-y-3 mb-4">
              <li className="flex flex-wrap items-center gap-2">
                <OpenLinkButton href={LINKS.githubFineGrained}>
                  Fine-grained トークンを作る
                </OpenLinkButton>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <a
                  href={LINKS.githubClassic}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#9333EA] font-medium underline underline-offset-2"
                >
                  Classic トークン（従来型）を開く
                </a>
              </li>
            </ul>
            <div className="rounded-lg bg-[#1A1A2E]/[0.03] p-3 text-[12px] text-[#1A1A2E]/75 space-y-2">
              <p className="font-bold text-[#1A1A2E]">記入・チェックのポイント</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <strong>Fine-grained</strong> の場合: 対象のリポジトリ（
                  <code className="bg-white/80 px-1 rounded">{repoFull}</code>
                  ）だけに絞ると安全です。
                </li>
                <li>
                  権限に <strong>Issues: Read and write</strong>（読み取りと書き込み）を付けます。
                </li>
                <li>
                  「生成」後に<strong>一度だけ</strong>全文が表示されるので、その文字列をコピーして、上の「トークン用メモ欄」に貼り付けます。
                </li>
              </ul>
            </div>
          </>
        }
      />

      {/* Step 2 */}
      <StepCard
        step={2}
        title="Google Cloud を開く"
        body={
          <>
            <p className="text-[13px] text-[#1A1A2E]/70 mb-4">
              会社の Google アカウントで入れる画面です。プロジェクトがまだなら、上司またはエンジニアに「どのプロジェクトを使うか」聞いてから進めてください。
            </p>
            <OpenLinkButton href={LINKS.gcpHome}>Google Cloud コンソールを開く</OpenLinkButton>
            <p className="text-[12px] text-[#1A1A2E]/45 mt-3">
              画面上部のプロジェクト名をクリック → <strong>プロジェクト ID</strong> をコピーし、ページ上部の「GCP プロジェクト ID」欄に貼り付け。
            </p>
          </>
        }
      />

      {/* Step 3 */}
      <StepCard
        step={3}
        title="Secret Manager にトークンを保存する"
        body={
          <>
            <p className="text-[13px] text-[#1A1A2E]/70 mb-4">
              トークンは<strong>ここが本番の保管場所</strong>です。メモ欄からコピーして、Google の画面に貼ります。
            </p>
            <OpenLinkButton href={LINKS.secretManager}>Secret Manager を開く</OpenLinkButton>
            <div className="rounded-lg bg-[#1A1A2E]/[0.03] p-3 text-[12px] text-[#1A1A2E]/75 space-y-2 mt-4">
              <p className="font-bold text-[#1A1A2E]">画面での操作（目安）</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>
                  <strong>シークレットを作成</strong>（または Create secret）
                </li>
                <li>
                  名前: <code className="bg-white/80 px-1 rounded">{secretName || "github-token"}</code>
                </li>
                <li>
                  値: メモ欄にあったトークンを貼り付け → 保存
                </li>
              </ol>
            </div>
          </>
        }
      />

      {/* Step 4 */}
      <StepCard
        step={4}
        title="エンジニアに依頼する（コピーして送る）"
        body={
          <>
            <p className="text-[13px] text-[#1A1A2E]/70 mb-4">
              ここまで終わったら、あとは Docker イメージのビルドと Cloud Run Job の設定が必要です。下の文を Slack やメールに貼って送ってください。
            </p>
            <pre className="text-[12px] bg-[#151528] text-white/90 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
              {engineerNote}
            </pre>
            <button
              type="button"
              onClick={copyEngineerNote}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#1A1A2E] hover:bg-[#2d2d44] transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "コピーしました" : "この文をコピー"}
            </button>
            <p className="text-[12px] text-[#1A1A2E]/45 mt-3">
              技術手順の全文:{" "}
              <a
                href={deployReadmeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#9333EA] font-medium underline underline-offset-2 break-all"
              >
                GitHub 上の README（deploy/github-issue-job）
                <ExternalLink className="w-3 h-3 inline ml-0.5 opacity-70" />
              </a>
            </p>
          </>
        }
      />

      <p className="text-center text-[12px] text-[#1A1A2E]/35 mt-10">
        わからないときは、画面のスクリーンショットを撮ってエンジニアに共有してください。
      </p>
    </div>
  );
}

function StepCard({
  step,
  title,
  body,
}: {
  step: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <section className="content-card rounded-xl p-5 mb-5">
      <h2 className="text-sm font-bold text-[#1A1A2E] mb-3 flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-[#9333EA] text-white text-xs font-black flex items-center justify-center shrink-0">
          {step}
        </span>
        <span className="flex items-center gap-1">
          {title}
          <ChevronRight className="w-4 h-4 text-[#1A1A2E]/20" />
        </span>
      </h2>
      {body}
    </section>
  );
}
