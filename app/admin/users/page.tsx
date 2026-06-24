"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";
import type { BoRole } from "@/lib/boMenus";

type Profile = {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

type Ban = {
  id: string;
  user_id: string;
  reason: string | null;
  banned_at: string;
};

type RoleFilter = "all" | "teacher" | "student" | "bo" | "banned";
const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "teacher", label: "지도자" },
  { value: "student", label: "회원" },
  { value: "bo", label: "BO 권한" },
  { value: "banned", label: "정지" },
];

const PROFILE_LIMIT = 500;

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Map<string, Set<string>>>(new Map());
  const [boRoleByUser, setBoRoleByUser] = useState<Map<string, BoRole>>(new Map());
  const [bansByUser, setBansByUser] = useState<Map<string, Ban>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [banOpenFor, setBanOpenFor] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");

  const load = async (q: string) => {
    setError(null);
    setLoading(true);
    try {
      const sess = await supabase.auth.getSession();
      setCurrentUserId(sess.data.session?.user.id ?? null);

      let pq = supabase
        .from("user_profiles")
        .select("id, user_id, name, email, phone, avatar_url, created_at")
        .order("created_at", { ascending: false })
        .limit(PROFILE_LIMIT);
      const term = q.trim();
      if (term) {
        pq = pq.or(
          `name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`,
        );
      }
      const { data: profData, error: pErr } = await pq;
      if (pErr) throw pErr;
      const profs = (profData ?? []) as Profile[];
      setProfiles(profs);
      setTruncated(profs.length >= PROFILE_LIMIT);

      const userIds = profs.map((p) => p.user_id);

      // 역할/정지/BO권한 정보 병렬 조회
      const [rolesRes, bansRes, boRes] = await Promise.all([
        userIds.length
          ? supabase.from("user_roles").select("user_id, role").in("user_id", userIds)
          : Promise.resolve({ data: [], error: null } as any),
        userIds.length
          ? supabase
              .from("user_bans")
              .select("id, user_id, reason, banned_at")
              .is("lifted_at", null)
              .in("user_id", userIds)
          : Promise.resolve({ data: [], error: null } as any),
        supabase.from("bo_users").select("user_id, role"),
      ]);

      const roleMap = new Map<string, Set<string>>();
      for (const r of (rolesRes.data ?? []) as { user_id: string; role: string }[]) {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, new Set());
        roleMap.get(r.user_id)!.add(r.role);
      }
      setRolesByUser(roleMap);

      const banMap = new Map<string, Ban>();
      for (const b of (bansRes.data ?? []) as Ban[]) banMap.set(b.user_id, b);
      setBansByUser(banMap);

      const boMap = new Map<string, BoRole>();
      for (const b of (boRes.data ?? []) as { user_id: string; role: BoRole }[])
        boMap.set(b.user_id, b.role);
      setBoRoleByUser(boMap);
    } catch (e: any) {
      setError(
        e?.message ??
          "데이터를 불러오지 못했어요. (어드민 RLS 적용 여부를 확인하세요)",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("");
  }, []);

  const runSearch = () => {
    setSubmittedQuery(query);
    load(query);
  };

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      switch (roleFilter) {
        case "teacher":
          return rolesByUser.get(p.user_id)?.has("teacher");
        case "student":
          return rolesByUser.get(p.user_id)?.has("student");
        case "bo":
          return boRoleByUser.has(p.user_id);
        case "banned":
          return bansByUser.has(p.user_id);
        default:
          return true;
      }
    });
  }, [profiles, roleFilter, rolesByUser, boRoleByUser, bansByUser]);

  const handleBan = async (userId: string, reason: string) => {
    if (!reason.trim()) {
      alert("정지 사유를 입력하세요.");
      return;
    }
    setBusyId(userId);
    try {
      const { error: err } = await supabase.from("user_bans").insert({
        user_id: userId,
        reason: reason.trim(),
        banned_by: currentUserId,
      });
      if (err) throw err;
      setBanOpenFor(null);
      setBanReason("");
      await load(submittedQuery);
    } catch (e: any) {
      alert(`정지에 실패했어요: ${e?.message ?? "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleUnban = async (userId: string) => {
    setBusyId(userId);
    try {
      const { error: err } = await supabase
        .from("user_bans")
        .update({ lifted_at: new Date().toISOString(), lifted_by: currentUserId })
        .eq("user_id", userId)
        .is("lifted_at", null);
      if (err) throw err;
      await load(submittedQuery);
    } catch (e: any) {
      alert(`정지 해제에 실패했어요: ${e?.message ?? "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  // BO 접근 권한(역할) 부여·회수는 '권한 관리' 페이지에서 관리합니다.

  return (
    <AdminShell>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-ink">
            사용자
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">사용자 관리</h1>
          <p className="mt-1 text-sm text-muted-ink">
            가입자를 검색하고 역할을 확인하며 정지/해제를 관리하세요. (BO 접근 권한은
            ‘권한 관리’에서 설정)
          </p>
        </div>
        <button
          onClick={() => load(submittedQuery)}
          className="rounded-md border border-hairline px-3 py-1.5 text-xs text-body transition hover:bg-surface-strong"
        >
          새로고침
        </button>
      </header>

      {error ? (
        <div className="mb-6 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          {error}
        </div>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {ROLE_FILTERS.map((f) => {
              const active = roleFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setRoleFilter(f.value)}
                  className={
                    "rounded-md border px-2.5 py-1 text-xs transition " +
                    (active
                      ? "border-coral bg-coral/12 text-coral-active"
                      : "border-hairline text-muted-ink hover:bg-surface-strong")
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="이름·전화·이메일 검색…"
              className="w-64 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm placeholder-muted-soft outline-none focus:border-coral"
            />
            <button
              onClick={runSearch}
              className="rounded-md border border-coral/40 bg-coral/12 px-3 py-1.5 text-xs text-coral-active transition hover:bg-coral/20"
            >
              검색
            </button>
          </div>
        </div>

        {truncated ? (
          <p className="mb-2 text-[11px] text-warning/80">
            최근 {PROFILE_LIMIT}명만 표시 중입니다. 검색으로 좁혀주세요.
          </p>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-hairline">
          <table className="w-full text-sm">
            <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-wider text-muted-ink">
              <tr>
                <th className="px-4 py-2.5">사용자</th>
                <th className="px-4 py-2.5">연락처</th>
                <th className="px-4 py-2.5">역할</th>
                <th className="px-4 py-2.5">상태</th>
                <th className="px-4 py-2.5">가입일</th>
                <th className="px-4 py-2.5 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-ink">
                    불러오는 중…
                  </td>
                </tr>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-ink">
                    조건에 맞는 사용자가 없어요.
                  </td>
                </tr>
              ) : null}
              {filtered.map((p) => {
                const roles = rolesByUser.get(p.user_id);
                const boRole = boRoleByUser.get(p.user_id);
                const ban = bansByUser.get(p.user_id);
                const isSelf = p.user_id === currentUserId;
                const banning = banOpenFor === p.user_id;
                return (
                  <tr
                    key={p.user_id}
                    className="border-t border-hairline align-top transition hover:bg-surface-soft"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {p.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.avatar_url}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-strong text-[11px] text-muted-ink">
                            {(p.name ?? "?").slice(0, 1)}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-ink">
                            {p.name ?? "—"}
                            {isSelf ? (
                              <span className="ml-1 text-[10px] text-coral-active">(나)</span>
                            ) : null}
                          </p>
                          <p className="text-[11px] text-muted-soft">
                            {p.user_id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-body">
                      <p>{p.phone ?? "—"}</p>
                      <p className="mt-1 text-[11px] text-muted-ink">{p.email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {roles?.has("teacher") ? <RoleBadge label="지도자" tone="sky" /> : null}
                        {roles?.has("student") ? (
                          <RoleBadge label="회원" tone="emerald" />
                        ) : null}
                        {boRole === "super_admin" ? (
                          <RoleBadge label="수퍼관리자" tone="violet" />
                        ) : null}
                        {boRole === "studio_owner" ? (
                          <RoleBadge label="원장" tone="violet" />
                        ) : null}
                        {!roles?.size && !boRole ? (
                          <span className="text-[11px] text-muted-soft">—</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {ban ? (
                        <div>
                          <span className="inline-flex items-center rounded-md border border-error/40 bg-error/10 px-2 py-0.5 text-[11px] font-medium text-error">
                            정지
                          </span>
                          {ban.reason ? (
                            <p className="mt-1 max-w-[12rem] truncate text-[11px] text-muted-ink">
                              {ban.reason}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-success/30 bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success">
                          정상
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-ink">
                      {p.created_at ? p.created_at.slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {banning ? (
                        <div className="flex flex-col items-end gap-2">
                          <textarea
                            autoFocus
                            value={banReason}
                            onChange={(e) => setBanReason(e.target.value)}
                            placeholder="정지 사유"
                            rows={2}
                            className="w-48 rounded-md border border-hairline bg-canvas px-2 py-1 text-xs placeholder-muted-soft outline-none focus:border-coral"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setBanOpenFor(null);
                                setBanReason("");
                              }}
                              disabled={busyId === p.user_id}
                              className="rounded-md border border-hairline px-2.5 py-1 text-[11px] text-body transition hover:bg-surface-strong"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => handleBan(p.user_id, banReason)}
                              disabled={busyId === p.user_id}
                              className="rounded-md border border-error/40 bg-error/10 px-2.5 py-1 text-[11px] text-error transition hover:bg-error/10 disabled:opacity-40"
                            >
                              {busyId === p.user_id ? "처리 중…" : "정지 확정"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          {ban ? (
                            <button
                              onClick={() => handleUnban(p.user_id)}
                              disabled={busyId === p.user_id}
                              className="rounded-md border border-success/30 px-2.5 py-1 text-[11px] text-success transition hover:bg-success/12 disabled:opacity-40"
                            >
                              {busyId === p.user_id ? "처리 중…" : "정지 해제"}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setBanOpenFor(p.user_id);
                                setBanReason("");
                              }}
                              disabled={busyId === p.user_id}
                              className="rounded-md border border-error/40 px-2.5 py-1 text-[11px] text-error transition hover:bg-error/10 disabled:opacity-40"
                            >
                              정지
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-soft">
          ※ 정지는 이력(user_bans)에 기록됩니다. 정지된 사용자의 앱 접근 차단은 앱/RLS 연동이
          별도로 필요합니다(is_user_banned 헬퍼 제공).
        </p>
      </section>
    </AdminShell>
  );
}

function RoleBadge({
  label,
  tone,
}: {
  label: string;
  tone: "sky" | "emerald" | "violet";
}) {
  const cls = {
    sky: "border-accent-teal/40 bg-accent-teal/15 text-accent-teal",
    emerald: "border-success/30 bg-success/12 text-success",
    violet: "border-coral/40 bg-coral/12 text-coral-active",
  }[tone];
  return (
    <span
      className={
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium " +
        cls
      }
    >
      {label}
    </span>
  );
}
