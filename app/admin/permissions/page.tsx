"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { AdminShell, useBoContext } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";
import {
  BO_MENUS,
  resolveMenuKeys,
  type BoRole,
  type MenuKey,
  type MenuOverride,
} from "@/lib/boMenus";

type BoUser = { user_id: string; role: BoRole; created_at: string | null };
type UserInfo = { user_id: string; phone: string | null; name: string | null };
type Override = { user_id: string; menu_key: string; allowed: boolean };

const ROLE_LABEL: Record<BoRole, string> = {
  super_admin: "수퍼관리자",
  studio_owner: "원장",
};

export default function AdminPermissionsPage() {
  return (
    <AdminShell>
      <PermissionsInner />
    </AdminShell>
  );
}

function PermissionsInner() {
  const ctx = useBoContext();
  const myId = ctx?.session.user.id ?? null;

  const [boUsers, setBoUsers] = useState<BoUser[]>([]);
  const [info, setInfo] = useState<Map<string, UserInfo>>(new Map());
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // 사용자 추가용 검색
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<UserInfo[]>([]);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [{ data: users, error: uErr }, { data: ovr, error: oErr }] =
        await Promise.all([
          supabase
            .from("bo_users")
            .select("user_id, role, created_at")
            .order("created_at", { ascending: true }),
          supabase
            .from("bo_menu_overrides")
            .select("user_id, menu_key, allowed"),
        ]);
      if (uErr) throw uErr;
      if (oErr) throw oErr;
      const us = (users ?? []) as BoUser[];
      setBoUsers(us);
      setOverrides((ovr ?? []) as Override[]);

      const ids = us.map((u) => u.user_id);
      if (ids.length > 0) {
        const { data: infos } = await supabase.rpc("admin_get_users_info", {
          p_user_ids: ids,
        });
        const map = new Map<string, UserInfo>();
        for (const r of (infos ?? []) as UserInfo[]) map.set(r.user_id, r);
        setInfo(map);
      }
    } catch (e: any) {
      setError(
        e?.message ??
          "데이터를 불러오지 못했어요. (admin_rbac.sql 적용 여부 확인)",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const superCount = useMemo(
    () => boUsers.filter((u) => u.role === "super_admin").length,
    [boUsers],
  );

  const overridesByUser = useMemo(() => {
    const m = new Map<string, MenuOverride[]>();
    for (const o of overrides) {
      if (!m.has(o.user_id)) m.set(o.user_id, []);
      m.get(o.user_id)!.push({ menu_key: o.menu_key, allowed: o.allowed });
    }
    return m;
  }, [overrides]);

  const runSearch = async () => {
    const q = searchQ.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data, error: err } = await supabase
        .from("user_profiles")
        .select("user_id, name, phone")
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(20);
      if (err) throw err;
      const existing = new Set(boUsers.map((u) => u.user_id));
      setSearchResults(
        ((data ?? []) as UserInfo[]).filter((u) => !existing.has(u.user_id)),
      );
    } catch (e: any) {
      alert(`검색 실패: ${e?.message ?? "unknown"}`);
    } finally {
      setSearching(false);
    }
  };

  const addUser = async (userId: string, role: BoRole) => {
    setBusyId(userId);
    try {
      const { error: err } = await supabase
        .from("bo_users")
        .upsert({ user_id: userId, role, created_by: myId });
      if (err) throw err;
      setSearchResults((r) => r.filter((u) => u.user_id !== userId));
      setSearchQ("");
      await load();
    } catch (e: any) {
      alert(`추가 실패: ${e?.message ?? "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = async (u: BoUser, role: BoRole) => {
    if (role === u.role) return;
    if (
      u.role === "super_admin" &&
      role !== "super_admin" &&
      superCount <= 1
    ) {
      alert("마지막 수퍼관리자의 역할은 변경할 수 없어요.");
      return;
    }
    if (u.user_id === myId && role !== "super_admin") {
      alert("자기 자신의 수퍼관리자 역할은 변경할 수 없어요.");
      return;
    }
    setBusyId(u.user_id);
    try {
      const { error: err } = await supabase
        .from("bo_users")
        .update({ role })
        .eq("user_id", u.user_id);
      if (err) throw err;
      await load();
    } catch (e: any) {
      alert(`역할 변경 실패: ${e?.message ?? "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async (u: BoUser) => {
    if (u.user_id === myId) {
      alert("자기 자신은 제거할 수 없어요.");
      return;
    }
    if (u.role === "super_admin" && superCount <= 1) {
      alert("마지막 수퍼관리자는 제거할 수 없어요.");
      return;
    }
    if (!confirm("이 BO 사용자의 접근 권한을 제거할까요?")) return;
    setBusyId(u.user_id);
    try {
      const { error: err } = await supabase
        .from("bo_users")
        .delete()
        .eq("user_id", u.user_id);
      if (err) throw err;
      await load();
    } catch (e: any) {
      alert(`제거 실패: ${e?.message ?? "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  // 메뉴 토글: 원하는 상태가 역할 기본과 같으면 override 삭제, 다르면 upsert
  const toggleMenu = async (
    u: BoUser,
    key: MenuKey,
    desired: boolean,
  ) => {
    const isDefault = BO_MENUS.find((m) => m.key === key)?.defaultRoles.includes(
      u.role,
    );
    setBusyId(u.user_id + key);
    try {
      if (desired === isDefault) {
        const { error: err } = await supabase
          .from("bo_menu_overrides")
          .delete()
          .eq("user_id", u.user_id)
          .eq("menu_key", key);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from("bo_menu_overrides")
          .upsert({ user_id: u.user_id, menu_key: key, allowed: desired });
        if (err) throw err;
      }
      await load();
    } catch (e: any) {
      alert(`메뉴 권한 변경 실패: ${e?.message ?? "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
            권한
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">권한 관리</h1>
          <p className="mt-1 text-sm text-neutral-400">
            BO 접근 사용자와 역할, 메뉴 노출 권한을 관리하세요. (수퍼관리자 전용)
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-800"
        >
          새로고침
        </button>
      </header>

      {error ? (
        <div className="mb-6 rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}

      {/* 사용자 추가 */}
      <section className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900/30 p-4">
        <h2 className="mb-2 text-sm font-semibold text-neutral-200">BO 사용자 추가</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="추가할 사용자 이름·전화 검색…"
            className="w-64 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm placeholder-neutral-600 outline-none focus:border-violet-500"
          />
          <button
            onClick={runSearch}
            disabled={searching}
            className="rounded-md border border-violet-700/60 bg-violet-600/20 px-3 py-1.5 text-xs text-violet-200 transition hover:bg-violet-600/30 disabled:opacity-40"
          >
            {searching ? "검색 중…" : "검색"}
          </button>
        </div>
        {searchResults.length > 0 ? (
          <div className="mt-3 space-y-1">
            {searchResults.map((u) => (
              <div
                key={u.user_id}
                className="flex items-center justify-between rounded-md border border-neutral-800 px-3 py-2"
              >
                <div>
                  <span className="text-sm text-neutral-100">{u.name ?? "—"}</span>
                  <span className="ml-2 text-[11px] text-neutral-500">
                    {u.phone ?? u.user_id.slice(0, 8)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => addUser(u.user_id, "studio_owner")}
                    disabled={busyId === u.user_id}
                    className="rounded-md border border-sky-800/60 px-2.5 py-1 text-[11px] text-sky-300 transition hover:bg-sky-950/40 disabled:opacity-40"
                  >
                    원장으로 추가
                  </button>
                  <button
                    onClick={() => addUser(u.user_id, "super_admin")}
                    disabled={busyId === u.user_id}
                    className="rounded-md border border-violet-700/60 px-2.5 py-1 text-[11px] text-violet-300 transition hover:bg-violet-950/40 disabled:opacity-40"
                  >
                    수퍼관리자로 추가
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* BO 사용자 목록 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">
          BO 사용자 ({boUsers.length})
        </h2>
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/60 text-left text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">사용자</th>
                <th className="px-4 py-2.5">역할</th>
                <th className="px-4 py-2.5">메뉴</th>
                <th className="px-4 py-2.5 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                    불러오는 중…
                  </td>
                </tr>
              ) : null}
              {boUsers.map((u) => {
                const ui = info.get(u.user_id);
                const ovr = overridesByUser.get(u.user_id) ?? [];
                const effective = resolveMenuKeys(u.role, ovr);
                const isSelf = u.user_id === myId;
                const open = expanded === u.user_id;
                return (
                  <Fragment key={u.user_id}>
                    <tr className="border-t border-neutral-800 align-top">
                      <td className="px-4 py-3">
                        <p className="text-neutral-100">
                          {ui?.name ?? "—"}
                          {isSelf ? (
                            <span className="ml-1 text-[10px] text-violet-400">(나)</span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          {ui?.phone ?? u.user_id.slice(0, 8)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u, e.target.value as BoRole)}
                          disabled={busyId === u.user_id}
                          className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs outline-none focus:border-violet-500"
                        >
                          <option value="super_admin">{ROLE_LABEL.super_admin}</option>
                          <option value="studio_owner">{ROLE_LABEL.studio_owner}</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpanded(open ? null : u.user_id)}
                          className="rounded-md border border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-300 transition hover:bg-neutral-800"
                        >
                          {effective.size}개 메뉴 {open ? "▲" : "▼"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => removeUser(u)}
                          disabled={busyId === u.user_id || isSelf}
                          className="rounded-md border border-red-900/60 px-2.5 py-1 text-[11px] text-red-300 transition hover:bg-red-950/40 disabled:opacity-40"
                        >
                          제거
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="bg-neutral-950/40">
                        <td colSpan={4} className="px-4 py-3">
                          <p className="mb-2 text-[11px] text-neutral-500">
                            메뉴 노출 권한 (체크 = 노출). 역할 기본과 다르면 예외로
                            저장됩니다.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {BO_MENUS.map((m) => {
                              const on = effective.has(m.key);
                              const isDefault = m.defaultRoles.includes(u.role);
                              const overridden = on !== isDefault;
                              return (
                                <button
                                  key={m.key}
                                  onClick={() => toggleMenu(u, m.key, !on)}
                                  disabled={busyId === u.user_id + m.key}
                                  className={
                                    "rounded-md border px-2.5 py-1 text-[11px] transition disabled:opacity-40 " +
                                    (on
                                      ? "border-emerald-800/60 bg-emerald-900/30 text-emerald-200"
                                      : "border-neutral-700 text-neutral-500 hover:bg-neutral-800")
                                  }
                                  title={
                                    overridden ? "역할 기본과 다름(예외 적용)" : "역할 기본"
                                  }
                                >
                                  {on ? "✓ " : ""}
                                  {m.label}
                                  {overridden ? (
                                    <span className="ml-1 text-amber-400">*</span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-neutral-600">
          ※ <span className="text-amber-400">*</span> = 역할 기본값과 다른 예외 설정. 원장은
          데이터도 본인 요가원으로 제한됩니다(메뉴를 추가로 켜도 다른 요가원 데이터는 보이지
          않음).
        </p>
      </section>
    </>
  );
}
