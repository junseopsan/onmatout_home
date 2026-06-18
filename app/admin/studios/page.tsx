"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";

type Studio = {
  id: string;
  owner_id: string;
  name: string;
  location: string | null;
  phone: string | null;
  hours_text: string | null;
  website_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type ApplicationStatus =
  | "pending"
  | "auto_approved"
  | "approved"
  | "rejected"
  | "suspended";

type Application = {
  id: string;
  applicant_user_id: string;
  name: string;
  location: string | null;
  phone: string | null;
  hours_text: string | null;
  website_url: string | null;
  description: string | null;
  status: ApplicationStatus;
  studio_id: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type ApplicantInfo = {
  user_id: string;
  phone: string | null;
  name: string | null;
};

type StatusFilter = "all" | ApplicationStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "pending", label: "pending" },
  { value: "auto_approved", label: "자동승인" },
  { value: "suspended", label: "정지" },
  { value: "rejected", label: "반려" },
];

export default function AdminStudiosPage() {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicants, setApplicants] = useState<Map<string, ApplicantInfo>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [{ data: s, error: sErr }, { data: a, error: aErr }] = await Promise.all([
        supabase
          .from("pivot_studios")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("studio_applications")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      if (sErr) throw sErr;
      if (aErr) throw aErr;
      const studiosData = (s ?? []) as Studio[];
      const applicationsData = (a ?? []) as Application[];
      setStudios(studiosData);
      setApplications(applicationsData);

      // 신청자 정보 batch 조회
      const userIds = Array.from(
        new Set([
          ...applicationsData.map((x) => x.applicant_user_id),
          ...studiosData.map((x) => x.owner_id),
        ]),
      );
      if (userIds.length > 0) {
        const { data: infos, error: infoErr } = await supabase.rpc(
          "admin_get_users_info",
          { p_user_ids: userIds },
        );
        if (!infoErr && infos) {
          const map = new Map<string, ApplicantInfo>();
          for (const row of infos as ApplicantInfo[]) {
            map.set(row.user_id, row);
          }
          setApplicants(map);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredStudios = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return studios;
    return studios.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").includes(q) ||
        (applicants.get(s.owner_id)?.phone ?? "").includes(q),
    );
  }, [studios, query, applicants]);

  const filteredApplications = useMemo(() => {
    if (statusFilter === "all") return applications;
    return applications.filter((a) => a.status === statusFilter);
  }, [applications, statusFilter]);

  const handleSuspend = async (appId: string, note: string) => {
    setBusyId(appId);
    try {
      const app = applications.find((a) => a.id === appId);
      if (!app) throw new Error("not found");
      if (app.studio_id) {
        const { error: studioErr } = await supabase
          .from("pivot_studios")
          .delete()
          .eq("id", app.studio_id);
        if (studioErr) throw studioErr;
      }
      const { error: appErr } = await supabase
        .from("studio_applications")
        .update({
          status: "suspended",
          review_note: note.trim() || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", appId);
      if (appErr) throw appErr;
      setNoteOpenFor(null);
      setNoteDraft("");
      await load();
    } catch (e: any) {
      alert(`정지에 실패했어요: ${e?.message ?? "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteStudio = async (studioId: string) => {
    if (
      !confirm(
        "정말 이 요가원을 삭제할까요? 연결된 클래스/회원도 함께 정리됩니다.",
      )
    )
      return;
    setBusyId(studioId);
    try {
      const { error } = await supabase
        .from("pivot_studios")
        .delete()
        .eq("id", studioId);
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(`삭제에 실패했어요: ${e?.message ?? "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminShell>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-ink">
            요가원
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">요가원 관리</h1>
          <p className="mt-1 text-sm text-muted-ink">
            등록 신청은 자동 승인되며, 의심스러운 요가원만 여기서 정지·삭제하세요.
          </p>
        </div>
        <button
          onClick={load}
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

      <section className="mb-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              신청 ({filteredApplications.length} / 전체 {applications.length})
            </h2>
            <p className="text-[11px] text-muted-ink">
              자동승인 후에도 의심스러운 곳은 정지해서 스튜디오를 삭제하세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value;
              const count =
                f.value === "all"
                  ? applications.length
                  : applications.filter((a) => a.status === f.value).length;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={
                    "rounded-md border px-2.5 py-1 text-xs transition " +
                    (active
                      ? "border-coral bg-coral/12 text-coral-active"
                      : "border-hairline text-muted-ink hover:bg-surface-strong")
                  }
                >
                  {f.label} {count > 0 ? <span className="ml-1 text-[10px] text-muted-ink">{count}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-hairline">
          <table className="w-full text-sm">
            <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-wider text-muted-ink">
              <tr>
                <th className="px-4 py-2.5">상호명</th>
                <th className="px-4 py-2.5">신청자</th>
                <th className="px-4 py-2.5">주소·연락처</th>
                <th className="px-4 py-2.5">상태</th>
                <th className="px-4 py-2.5">메모</th>
                <th className="px-4 py-2.5">신청일</th>
                <th className="px-4 py-2.5 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredApplications.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-muted-ink"
                  >
                    {statusFilter === "all"
                      ? "아직 신청이 없어요."
                      : `'${STATUS_FILTERS.find((s) => s.value === statusFilter)?.label}' 상태 신청이 없어요.`}
                  </td>
                </tr>
              ) : null}
              {filteredApplications.map((a) => {
                const ap = applicants.get(a.applicant_user_id);
                return (
                  <tr
                    key={a.id}
                    className="border-t border-hairline transition hover:bg-surface-soft"
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-ink">{a.name}</p>
                      {a.description ? (
                        <p className="mt-1 max-w-xs truncate text-[11px] text-muted-ink">
                          {a.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-ink">{ap?.name ?? "—"}</p>
                      <p className="mt-1 text-[11px] text-muted-ink">
                        {ap?.phone ?? a.applicant_user_id.slice(0, 8)}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top text-body">
                      <p>{a.location ?? "—"}</p>
                      <p className="mt-1 text-[11px] text-muted-ink">
                        {a.phone ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 align-top text-body">
                      {noteOpenFor === a.id ? (
                        <textarea
                          autoFocus
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="정지 사유"
                          rows={2}
                          className="w-44 rounded-md border border-hairline bg-canvas px-2 py-1 text-xs placeholder-muted-soft outline-none focus:border-coral"
                        />
                      ) : a.review_note ? (
                        <p className="max-w-xs whitespace-pre-wrap text-xs text-muted-ink">
                          {a.review_note}
                        </p>
                      ) : (
                        <span className="text-[11px] text-muted-soft">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-ink">
                      {a.created_at.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      {a.status !== "suspended" && a.studio_id ? (
                        noteOpenFor === a.id ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setNoteOpenFor(null);
                                setNoteDraft("");
                              }}
                              disabled={busyId === a.id}
                              className="rounded-md border border-hairline px-2.5 py-1 text-[11px] text-body transition hover:bg-surface-strong"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => handleSuspend(a.id, noteDraft)}
                              disabled={busyId === a.id}
                              className="rounded-md border border-error/40 bg-error/10 px-2.5 py-1 text-[11px] text-error transition hover:bg-error/10 disabled:opacity-40"
                            >
                              {busyId === a.id ? "처리 중…" : "정지 확정"}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setNoteOpenFor(a.id);
                              setNoteDraft(a.review_note ?? "");
                            }}
                            className="rounded-md border border-error/40 px-2.5 py-1 text-[11px] text-error transition hover:bg-error/10"
                          >
                            정지 + 삭제
                          </button>
                        )
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              전체 요가원 ({studios.length})
            </h2>
            <p className="text-[11px] text-muted-ink">
              생성된 모든 스튜디오. 이름·주소·전화·원장 전화로 검색할 수 있어요.
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색…"
            className="w-60 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm placeholder-muted-soft outline-none focus:border-coral"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-hairline">
          <table className="w-full text-sm">
            <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-wider text-muted-ink">
              <tr>
                <th className="px-4 py-2.5">상호명</th>
                <th className="px-4 py-2.5">원장</th>
                <th className="px-4 py-2.5">주소·연락처</th>
                <th className="px-4 py-2.5">운영시간</th>
                <th className="px-4 py-2.5">홈페이지</th>
                <th className="px-4 py-2.5">생성일</th>
                <th className="px-4 py-2.5 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-ink"
                  >
                    불러오는 중…
                  </td>
                </tr>
              ) : null}
              {!loading && filteredStudios.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-ink"
                  >
                    조건에 맞는 요가원이 없어요.
                  </td>
                </tr>
              ) : null}
              {filteredStudios.map((s) => {
                const owner = applicants.get(s.owner_id);
                return (
                  <tr
                    key={s.id}
                    className="border-t border-hairline transition hover:bg-surface-soft"
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-ink">{s.name}</p>
                      {s.description ? (
                        <p className="mt-1 max-w-xs truncate text-[11px] text-muted-ink">
                          {s.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-ink">{owner?.name ?? "—"}</p>
                      <p className="mt-1 text-[11px] text-muted-ink">
                        {owner?.phone ?? s.owner_id.slice(0, 8)}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top text-body">
                      <p>{s.location ?? "—"}</p>
                      <p className="mt-1 text-[11px] text-muted-ink">
                        {s.phone ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top text-muted-ink">
                      {s.hours_text ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {s.website_url ? (
                        <a
                          href={s.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-coral-active underline-offset-2 hover:underline"
                        >
                          링크
                        </a>
                      ) : (
                        <span className="text-muted-soft">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-ink">
                      {s.created_at.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <button
                        onClick={() => handleDeleteStudio(s.id)}
                        disabled={busyId === s.id}
                        className="rounded-md border border-error/40 px-2.5 py-1 text-[11px] text-error transition hover:bg-error/10 disabled:opacity-40"
                      >
                        {busyId === s.id ? "삭제 중…" : "삭제"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const map: Record<ApplicationStatus, { label: string; cls: string }> = {
    pending: {
      label: "pending",
      cls: "border-warning/40 bg-warning/15 text-warning",
    },
    auto_approved: {
      label: "자동승인",
      cls: "border-success/30 bg-success/12 text-success",
    },
    approved: {
      label: "승인",
      cls: "border-success/30 bg-success/12 text-success",
    },
    rejected: {
      label: "반려",
      cls: "border-hairline bg-surface-card text-muted-ink",
    },
    suspended: {
      label: "정지",
      cls: "border-error/40 bg-error/10 text-error",
    },
  };
  const m = map[status];
  return (
    <span
      className={
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium " +
        m.cls
      }
    >
      {m.label}
    </span>
  );
}
