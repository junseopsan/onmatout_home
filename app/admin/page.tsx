"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminAuth } from "@/lib/adminAuth";

export default function AdminIndexPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ctx = await adminAuth.getBoContext();
      if (!mounted) return;
      if (ctx && ctx.menus.length > 0) router.replace(ctx.menus[0].href);
      else if (ctx) router.replace("/admin/login");
      else router.replace("/admin/login");
    })().finally(() => {
      if (mounted) setChecking(false);
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center text-sm text-muted-ink">
      {checking ? "잠시만요…" : ""}
    </div>
  );
}
