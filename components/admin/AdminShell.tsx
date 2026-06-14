"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { adminAuth, type BoContext } from "@/lib/adminAuth";
import { menuKeyForPath } from "@/lib/boMenus";

interface AdminShellProps {
  children: React.ReactNode;
}

const BoCtx = createContext<BoContext | null>(null);

// 페이지에서 역할/메뉴 분기에 사용
export function useBoContext(): BoContext | null {
  return useContext(BoCtx);
}

export function AdminShell({ children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);
  const [ctx, setCtx] = useState<BoContext | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const c = await adminAuth.getBoContext();
      if (!mounted) return;
      if (!c) {
        router.replace("/admin/login");
      } else {
        setCtx(c);
      }
      setAuthChecked(true);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSignOut = async () => {
    await adminAuth.signOut();
    router.replace("/admin/login");
  };

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-neutral-500">
        잠시만요…
      </div>
    );
  }
  if (!ctx) return null;

  // 현재 경로의 메뉴 접근 권한 판정
  const currentKey = menuKeyForPath(pathname);
  const allowedKeys = new Set(ctx.menus.map((m) => m.key));
  const hasAccess = currentKey === null || allowedKeys.has(currentKey);
  const firstMenu = ctx.menus[0];

  return (
    <BoCtx.Provider value={ctx}>
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-neutral-800 bg-neutral-950 p-5 md:flex md:flex-col">
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
              ONMATOUT
            </p>
            <p className="text-base font-semibold tracking-tight">
              {ctx.role === "super_admin" ? "어드민" : "요가원 관리"}
            </p>
          </div>
          <nav className="space-y-1">
            {ctx.menus.map((n) => {
              const active = pathname?.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={
                    "block rounded-md px-3 py-2 text-sm transition " +
                    (active
                      ? "bg-violet-600/20 text-violet-200"
                      : "text-neutral-300 hover:bg-neutral-800/60")
                  }
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-2">
            <span
              className={
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium " +
                (ctx.role === "super_admin"
                  ? "border-violet-800/60 bg-violet-900/30 text-violet-200"
                  : "border-sky-800/60 bg-sky-900/30 text-sky-200")
              }
            >
              {ctx.role === "super_admin" ? "수퍼관리자" : "원장"}
            </span>
            {ctx.identifier ? (
              <p className="break-all text-[11px] text-neutral-500">
                {ctx.identifier}
              </p>
            ) : null}
            <button
              onClick={handleSignOut}
              className="w-full rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-300 transition hover:bg-neutral-800"
            >
              로그아웃
            </button>
          </div>
        </aside>

        <main className="flex-1 px-6 py-8 md:px-10 md:py-10">
          {hasAccess ? (
            children
          ) : (
            <div className="mx-auto max-w-md rounded-lg border border-neutral-800 bg-neutral-900/30 p-8 text-center">
              <p className="text-lg font-semibold text-neutral-100">
                접근 권한이 없습니다
              </p>
              <p className="mt-2 text-sm text-neutral-400">
                이 메뉴에 대한 권한이 없어요. 권한이 필요하면 관리자에게 문의하세요.
              </p>
              {firstMenu ? (
                <Link
                  href={firstMenu.href}
                  className="mt-4 inline-block rounded-md border border-violet-700/60 bg-violet-600/20 px-4 py-2 text-sm text-violet-200 transition hover:bg-violet-600/30"
                >
                  {firstMenu.label}(으)로 이동
                </Link>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </BoCtx.Provider>
  );
}
