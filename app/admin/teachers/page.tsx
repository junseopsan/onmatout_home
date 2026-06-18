"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";

type Studio = {
  id: string;
  owner_id: string;
  name: string;
  location: string | null;
};

type StudioTeacher = {
  studio_id: string;
  teacher_id: string;
  status: "active" | "suspended";
  added_at: string;
  added_by: string | null;
};

type UserInfo = {
  user_id: string;
  phone: string | null;
  name: string | null;
};

type Row = {
  studio: Studio;
  owner: UserInfo | null;
  teachers: { st: StudioTeacher; info: UserInfo | null }[];
};

export default function AdminTeachersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [{ data: studios, error: sErr }, { data: sts, error: tErr }] =
        await Promise.all([
          supabase
            .from("pivot_studios")
            .select("id, owner_id, name, location")
            .order("created_at", { ascending: false }),
          supabase
            .from("studio_teachers")
            .select("*")
            .order("added_at", { ascending: false }),
        ]);
      if (sErr) throw sErr;
      if (tErr) throw tErr;

      const studiosData = (studios ?? []) as Studio[];
      const stsData = (sts ?? []) as StudioTeacher[];

      const userIds = Array.from(
        new Set([
          ...studiosData.map((s) => s.owner_id),
          ...stsData.map((s) => s.teacher_id),
        ]),
      );

      const infoMap = new Map<string, UserInfo>();
      if (userIds.length > 0) {
        const { data: infos, error: iErr } = await supabase.rpc(
          "admin_get_users_info",
          { p_user_ids: userIds },
        );
        if (iErr) throw iErr;
        for (const row of (infos ?? []) as UserInfo[]) {
          infoMap.set(row.user_id, row);
        }
      }

      const stByStudio = new Map<string, StudioTeacher[]>();
      for (const t of stsData) {
        if (!stByStudio.has(t.studio_id)) stByStudio.set(t.studio_id, []);
        stByStudio.get(t.studio_id)!.push(t);
      }

      const built: Row[] = studiosData.map((s) => ({
        studio: s,
        owner: infoMap.get(s.owner_id) ?? null,
        teachers: (stByStudio.get(s.id) ?? []).map((st) => ({
          st,
          info: infoMap.get(st.teacher_id) ?? null,
        })),
      }));
      setRows(built);
    } catch (e: any) {
      setError(e?.message ?? "데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      if (r.studio.name.toLowerCase().includes(q)) return true;
      if ((r.studio.location ?? "").toLowerCase().includes(q)) return true;
      if ((r.owner?.name ?? "").toLowerCase().includes(q)) return true;
      if ((r.owner?.phone ?? "").includes(q)) return true;
      for (const t of r.teachers) {
        if ((t.info?.name ?? "").toLowerCase().includes(q)) return true;
        if ((t.info?.phone ?? "").includes(q)) return true;
      }
      return false;
    });
  }, [rows, query]);

  const handleRemove = async (studioId: string, teacherId: string) => {
    if (
      !confirm("이 지도자를 스튜디오에서 강제 해제할까요? 관련 권한이 회수됩니다.")
    )
      return;
    const key = `${studioId}|${teacherId}`;
    setBusy(key);
    try {
      const { error } = await supabase
        .from("studio_teachers")
        .delete()
        .eq("studio_id", studioId)
        .eq("teacher_id", teacherId);
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(`해제에 실패했어요: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-ink">
            지도자
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">지도자 관리</h1>
          <p className="mt-1 text-sm text-muted-ink">
            스튜디오별 원장과 지도자 명단입니다. 문제가 있는 지도자는 강제 해제할
            수 있어요.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색…"
            className="w-60 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm placeholder-muted-soft outline-none focus:border-coral"
          />
          <button
            onClick={load}
            className="rounded-md border border-hairline px-3 py-1.5 text-xs text-body transition hover:bg-surface-strong"
          >
            새로고침
          </button>
        </div>
      </header>

      {error ? (
        <div className="mb-6 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-ink">불러오는 중…</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-ink">
          조건에 맞는 스튜디오가 없어요.
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <div
              key={r.studio.id}
              className="overflow-hidden rounded-lg border border-hairline bg-canvas"
            >
              <div className="flex items-center justify-between gap-4 border-b border-hairline px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {r.studio.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-ink">
                    {r.studio.location ?? "주소 미기재"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider text-muted-ink">
                    원장
                  </p>
                  <p className="text-sm text-ink">
                    {r.owner?.name ?? "—"}
                  </p>
                  <p className="text-[11px] text-muted-ink">
                    {r.owner?.phone ?? r.studio.owner_id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between border-b border-hairline px-4 py-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-ink">
                    지도자 ({r.teachers.length})
                  </p>
                </div>
                {r.teachers.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-muted-ink">
                    등록된 지도자가 없어요.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-wider text-muted-ink">
                      <tr>
                        <th className="px-4 py-2">이름</th>
                        <th className="px-4 py-2">전화</th>
                        <th className="px-4 py-2">상태</th>
                        <th className="px-4 py-2">등록일</th>
                        <th className="px-4 py-2 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.teachers.map(({ st, info }) => {
                        const busyKey = `${st.studio_id}|${st.teacher_id}`;
                        return (
                          <tr
                            key={st.teacher_id}
                            className="border-t border-hairline"
                          >
                            <td className="px-4 py-2 text-ink">
                              {info?.name ?? "—"}
                            </td>
                            <td className="px-4 py-2 text-muted-ink">
                              {info?.phone ?? st.teacher_id.slice(0, 8)}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={
                                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium " +
                                  (st.status === "active"
                                    ? "border-success/30 bg-success/12 text-success"
                                    : "border-error/40 bg-error/10 text-error")
                                }
                              >
                                {st.status === "active" ? "active" : "suspended"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-muted-ink">
                              {st.added_at.slice(0, 10)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={() =>
                                  handleRemove(st.studio_id, st.teacher_id)
                                }
                                disabled={busy === busyKey}
                                className="rounded-md border border-error/40 px-2.5 py-1 text-[11px] text-error transition hover:bg-error/10 disabled:opacity-40"
                              >
                                {busy === busyKey ? "처리 중…" : "강제 해제"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
