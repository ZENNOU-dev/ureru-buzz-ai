"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type HealthPayload =
  | { ok: true; skipped: true }
  | { ok: true; skipped: false; status: number; checkedUrl: string }
  | { ok: false; skipped: false; checkedUrl: string };

export function LocalBackendStatusBanner() {
  const [visible, setVisible] = useState(false);
  const [checkedUrl, setCheckedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      fetch("/api/backend-health", { cache: "no-store" })
        .then((r) => r.json() as Promise<HealthPayload>)
        .then((data) => {
          if (cancelled) return;
          if ("skipped" in data && data.skipped) {
            setVisible(false);
            setCheckedUrl(null);
            return;
          }
          if (data.ok) {
            setVisible(false);
            setCheckedUrl(null);
            return;
          }
          setVisible(true);
          setCheckedUrl(data.checkedUrl);
        })
        .catch(() => {
          if (cancelled) return;
          setVisible(true);
          setCheckedUrl(null);
        });
    };

    run();
    const id = setInterval(run, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-950"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-2.5 text-[13px] leading-snug">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-amber-900">
            ローカルホストの API に接続できません
          </p>
          <p className="mt-0.5 text-[12px] text-amber-800/90">
            接続が拒否されているか、バックエンドが起動していない可能性があります。別ターミナルで{" "}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 font-mono text-[11px]">
              pnpm --filter @ureru-buzz-ai/api dev
            </code>{" "}
            を実行するか、環境変数{" "}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 font-mono text-[11px]">
              BACKEND_INTERNAL_URL
            </code>{" "}
            （デフォルトは{" "}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 font-mono text-[11px]">
              http://127.0.0.1:8787
            </code>
            ）を確認してください。
          </p>
          {checkedUrl ? (
            <p className="mt-1.5 break-all font-mono text-[11px] text-amber-700/80">
              確認先: {checkedUrl}
            </p>
          ) : null}
          <p className="mt-1.5 text-[11px] text-amber-700/80">
            チェックを無効にする場合は{" "}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 font-mono">
              SKIP_BACKEND_HEALTH_CHECK=1
            </code>
            。
          </p>
        </div>
      </div>
    </div>
  );
}
