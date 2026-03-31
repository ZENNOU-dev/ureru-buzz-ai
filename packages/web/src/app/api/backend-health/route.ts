import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

/**
 * ブラウザの CORS を避け、サーバーからバックエンドの生存確認のみ行う。
 * 接続拒否・タイムアウト時は ok: false。
 */
export async function GET() {
  if (process.env.SKIP_BACKEND_HEALTH_CHECK === "1") {
    return NextResponse.json({ ok: true, skipped: true as const });
  }

  const base =
    process.env.BACKEND_INTERNAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_BACKEND_URL?.trim() ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8787" : "");

  if (!base) {
    return NextResponse.json({ ok: true, skipped: true as const });
  }

  const url = `${stripTrailingSlash(base)}/health`;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(id);
    return NextResponse.json({
      ok: res.ok,
      skipped: false as const,
      status: res.status,
      checkedUrl: url,
    });
  } catch {
    return NextResponse.json({
      ok: false,
      skipped: false as const,
      checkedUrl: url,
    });
  }
}
