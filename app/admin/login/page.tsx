"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAuth } from "@/lib/adminAuth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleRequestOtp = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await adminAuth.requestOtp(phone);
      setHint(
        result.hint ??
          (result.mode === "sms"
            ? "SMS 로 전송된 6자리 코드를 입력하세요."
            : null),
      );
      setStage("code");
    } catch (e: any) {
      setError(e?.message ?? "인증번호를 보내지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setBusy(true);
    try {
      await adminAuth.verifyAndSignIn(phone, code);
      // 역할별 첫 허용 메뉴로 라우팅 (/admin 루트가 처리)
      router.replace("/admin");
    } catch (e: any) {
      setError(e?.message ?? "로그인에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
        <div className="mb-8">
          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-neutral-500">
            ONMATOUT
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">어드민 로그인</h1>
          <p className="mt-2 text-sm text-neutral-400">
            전화번호로 로그인하세요.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-400">
              전화번호
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01000000000"
              autoComplete="tel"
              inputMode="tel"
              disabled={stage === "code"}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm placeholder-neutral-600 outline-none focus:border-violet-500 disabled:opacity-60"
            />
          </label>

          {stage === "code" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-400">
                인증번호
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm tracking-widest placeholder-neutral-600 outline-none focus:border-violet-500"
              />
              {hint ? (
                <span className="mt-1 block text-[11px] text-neutral-500">
                  {hint}
                </span>
              ) : null}
            </label>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          ) : null}

          {stage === "phone" ? (
            <button
              onClick={handleRequestOtp}
              disabled={busy || phone.trim().length < 9}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
            >
              {busy ? "전송 중…" : "인증번호 받기"}
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={handleVerify}
                disabled={busy || code.length < 6}
                className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
              >
                {busy ? "확인 중…" : "로그인"}
              </button>
              <button
                onClick={() => {
                  setStage("phone");
                  setCode("");
                  setError(null);
                  setHint(null);
                }}
                disabled={busy}
                className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-2 text-xs text-neutral-400 transition hover:bg-neutral-800 disabled:opacity-40"
              >
                번호 다시 입력
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
