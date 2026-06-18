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
      <div className="flex h-screen items-center justify-center text-sm text-muted-ink">
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
        <aside className="hidden w-60 shrink-0 border-r border-hairline bg-surface-soft p-5 md:flex md:flex-col">
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-[0.2em] text-coral-active">
              ONMATOUT
            </p>
            <p className="font-display text-xl font-semibold tracking-tight text-ink">
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
                      ? "bg-coral/12 text-coral-active"
                      : "text-body hover:bg-surface-strong")
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
                  ? "border-coral/40 bg-coral/12 text-coral-active"
                  : "border-accent-teal/40 bg-accent-teal/15 text-accent-teal")
              }
            >
              {ctx.role === "super_admin" ? "수퍼관리자" : "원장"}
            </span>
            {ctx.identifier ? (
              <p className="break-all text-[11px] text-muted-ink">
                {ctx.identifier}
              </p>
            ) : null}
            <button
              onClick={handleSignOut}
              className="w-full rounded-md border border-hairline px-3 py-2 text-xs text-body transition hover:bg-surface-strong"
            >
              로그아웃
            </button>
          </div>
        </aside>

        <main className="flex-1 px-6 py-8 md:px-10 md:py-10">
          {hasAccess ? (
            children
          ) : (
            <div className="mx-auto max-w-md rounded-lg border border-hairline bg-surface-soft p-8 text-center">
              <p className="text-lg font-semibold text-ink">
                접근 권한이 없습니다
              </p>
              <p className="mt-2 text-sm text-muted-ink">
                이 메뉴에 대한 권한이 없어요. 권한이 필요하면 관리자에게 문의하세요.
              </p>
              {firstMenu ? (
                <Link
                  href={firstMenu.href}
                  className="mt-4 inline-block rounded-md border border-coral/40 bg-coral/12 px-4 py-2 text-sm text-coral-active transition hover:bg-coral/20"
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
