"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#FAF8F5" }}>
      {/* Brand */}
      <h1 className="text-2xl font-black tracking-tight gradient-warm-text mb-8">
        売れるBUZZ AI
      </h1>

      {/* Card */}
      <div className="w-full max-w-md content-card rounded-2xl p-10 shadow-sm">
        <h2 className="text-center text-lg font-bold text-[#1A1A2E] mb-8">
          ログイン
        </h2>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[#1A1A2E]/50 mb-1.5">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@domain.com"
              className="w-full px-4 py-3 rounded-xl bg-[#FAF8F5] border border-black/[0.08] text-sm text-[#1A1A2E] placeholder:text-[#1A1A2E]/25 focus:outline-none focus:ring-2 focus:ring-[#9333EA]/20 focus:border-[#9333EA]/40 transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[#1A1A2E]/50 mb-1.5">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#FAF8F5] border border-black/[0.08] text-sm text-[#1A1A2E] placeholder:text-[#1A1A2E]/25 focus:outline-none focus:ring-2 focus:ring-[#9333EA]/20 focus:border-[#9333EA]/40 transition-colors"
            />
          </div>

          {/* Login button */}
          <button
            type="submit"
            className="w-full py-3.5 rounded-full text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] gradient-warm"
          >
            ログイン
          </button>
        </form>

        <div className="mt-6 space-y-3 text-center">
          <button className="text-sm text-[#1A1A2E]/35 hover:text-[#1A1A2E]/60 transition-colors">
            パスワードを忘れた方
          </button>
          <div>
            <button className="text-sm font-medium text-[#1A1A2E]/50 hover:text-[#1A1A2E]/80 transition-colors">
              新規利用申し込み
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
