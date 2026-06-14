"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";

type RequestStatus = "pending" | "in_progress" | "resolved" | "closed";
type RequestCategory = "bug" | "feature" | "question" | "other";

type SupportRequest = {
  id: string;
  user_id: string | null;
  title: string;
  content: string;
  category: RequestCategory | null;
  status: RequestStatus | null;
  admin_response: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type UserInfo = {
  user_id: string;
  phone: string | null;
  name: string | null;
};

type StatusFilter = "all" | RequestStatus;
type CategoryFilter = "all" | RequestCategory;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "pending", label: "대기" },
  { value: "in_progress", label: "처리중" },
  { value: "resolved", label: "해결" },
  { value: "closed", label: "종료" },
];

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "bug", label: "버그" },
  { value: "feature", label: "기능요청" },
  { value: "question", label: "문의" },
  { value: "other", label: "기타" },
];

const STATUS_OPTIONS: { value: RequestStatus; label: string }[] = [
  { value: "pending", label: "대기" },
  { value: "in_progress", label: "처리중" },
  { value: "resolved", label: "해결" },
  { value: "closed", label: "종료" },
];

// 미처리 우선 정렬용 가중치
const STATUS_ORDER: Record<RequestStatus, number> = {
  pending: 0,
  in_progress: 1,
  resolved: 2,
  closed: 3,
};

export default function AdminSupportPage() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [users, setUsers] = useState<Map<string, UserInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [responseDraft, setResponseDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<RequestStatus>("in_progress");

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("support_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      const rows = (data ?? []) as SupportRequest[];
      setRequests(rows);

      const userIds = Array.from(
        new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x)),
      );
      if (userIds.length > 0) {
        const { data: infos, error: infoErr } = await supabase.rpc(
          "admin_get_users_info",
          { p_user_ids: userIds },
        );
        if (!infoErr && infos) {
          const map = new Map<string, UserInfo>();
          for (const row of infos as UserInfo[]) {
            map.set(row.user_id, row);
          }
          setUsers(map);
        }
      }
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
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests
      .filter((r) => statusFilter === "all" || (r.status ?? "pending") === statusFilter)
      .filter((r) => categoryFilter === "all" || (r.category ?? "other") === categoryFilter)
      .filter((r) => {
        if (!q) return true;
        const u = r.user_id ? users.get(r.user_id) : undefined;
        return (
          r.title.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          (u?.name ?? "").toLowerCase().includes(q) ||
          (u?.phone ?? "").includes(q)
        );
      })
      .sort((a, b) => {
        const sa = STATUS_ORDER[(a.status ?? "pending") as RequestStatus];
        const sb = STATUS_ORDER[(b.status ?? "pending") as RequestStatus];
        if (sa !== sb) return sa - sb; // 미처리 우선
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      });
  }, [requests, query, statusFilter, categoryFilter, users]);

  const pendingCount = useMemo(
    () => requests.filter((r) => (r.status ?? "pending") === "pending").length,
    [requests],
  );

  const openEditor = (r: SupportRequest) => {
    setOpenFor(r.id);
    setResponseDraft(r.admin_response ?? "");
    // 응답을 작성하면 보통 처리중/해결 상태로 넘어감
    setStatusDraft(
      (r.status ?? "pending") === "pending"
        ? "in_progress"
        : ((r.status ?? "in_progress") as RequestStatus),
    );
  };

  const handleSave = async (id: string) => {
    setBusyId(id);
    try {
      const { error: err } = await supabase
        .from("support_requests")
        .update({
          admin_response: responseDraft.trim() || null,
          status: statusDraft,
        })
        .eq("id", id);
      if (err) throw err;
      setOpenFor(null);
      setResponseDraft("");
      await load();
    } catch (e: any) {
      alert(`저장에 실패했어요: ${e?.message ?? "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  // 응답 없이 상태만 빠르게 변경
  const handleQuickStatus = async (id: string, status: RequestStatus) => {
    setBusyId(id);
    try {
      const { error: err } = await supabase
        .from("support_requests")
        .update({ status })
        .eq("id", id);
      if (err) throw err;
      await load();
    } catch (e: any) {
      alert(`상태 변경에 실패했어요: ${e?.message ?? "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminShell>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
            지원
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">지원·신고 관리</h1>
          <p className="mt-1 text-sm text-neutral-400">
            사용자 문의·버그·기능요청에 답변하고 상태를 관리하세요.
            {pendingCount > 0 ? (
              <span className="ml-2 text-amber-300">미처리 {pendingCount}건</span>
            ) : null}
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

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[11px] uppercase tracking-wider text-neutral-500">
                상태
              </span>
              {STATUS_FILTERS.map((f) => {
                const active = statusFilter === f.value;
                const count =
                  f.value === "all"
                    ? requests.length
                    : requests.filter((r) => (r.status ?? "pending") === f.value).length;
                return (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={
                      "rounded-md border px-2.5 py-1 text-xs transition " +
                      (active
                        ? "border-violet-500 bg-violet-600/20 text-violet-200"
                        : "border-neutral-700 text-neutral-400 hover:bg-neutral-800")
                    }
                  >
                    {f.label}
                    {count > 0 ? (
                      <span className="ml-1 text-[10px] text-neutral-500">{count}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[11px] uppercase tracking-wider text-neutral-500">
                분류
              </span>
              {CATEGORY_FILTERS.map((f) => {
                const active = categoryFilter === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setCategoryFilter(f.value)}
                    className={
                      "rounded-md border px-2.5 py-1 text-xs transition " +
                      (active
                        ? "border-violet-500 bg-violet-600/20 text-violet-200"
                        : "border-neutral-700 text-neutral-400 hover:bg-neutral-800")
                    }
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목·내용·요청자 검색…"
            className="w-64 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm placeholder-neutral-600 outline-none focus:border-violet-500"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/60 text-left text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">요청자</th>
                <th className="px-4 py-2.5">분류</th>
                <th className="px-4 py-2.5">제목·내용</th>
                <th className="px-4 py-2.5">상태</th>
                <th className="px-4 py-2.5">작성일</th>
                <th className="px-4 py-2.5 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                    불러오는 중…
                  </td>
                </tr>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                    조건에 맞는 지원 요청이 없어요.
                  </td>
                </tr>
              ) : null}
              {filtered.map((r) => {
                const u = r.user_id ? users.get(r.user_id) : undefined;
                const status = (r.status ?? "pending") as RequestStatus;
                const isOpen = openFor === r.id;
                return (
                  <tr
                    key={r.id}
                    className="border-t border-neutral-800 align-top transition hover:bg-neutral-900/50"
                  >
                    <td className="px-4 py-3">
                      <p className="text-neutral-200">{u?.name ?? "—"}</p>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        {u?.phone ?? (r.user_id ? r.user_id.slice(0, 8) : "탈퇴/익명")}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge category={r.category} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-100">{r.title}</p>
                      {isOpen ? (
                        <p className="mt-1 max-w-xl whitespace-pre-wrap text-xs text-neutral-400">
                          {r.content}
                        </p>
                      ) : (
                        <p className="mt-1 max-w-md truncate text-[11px] text-neutral-500">
                          {r.content}
                        </p>
                      )}
                      {!isOpen && r.admin_response ? (
                        <p className="mt-1 max-w-md truncate text-[11px] text-emerald-400/80">
                          답변: {r.admin_response}
                        </p>
                      ) : null}

                      {isOpen ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            autoFocus
                            value={responseDraft}
                            onChange={(e) => setResponseDraft(e.target.value)}
                            placeholder="답변 내용을 입력하세요"
                            rows={3}
                            className="w-full max-w-xl rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-xs placeholder-neutral-600 outline-none focus:border-violet-500"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-neutral-500">상태</span>
                            <select
                              value={statusDraft}
                              onChange={(e) =>
                                setStatusDraft(e.target.value as RequestStatus)
                              }
                              className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs outline-none focus:border-violet-500"
                            >
                              {STATUS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {r.created_at ? r.created_at.slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isOpen ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setOpenFor(null);
                              setResponseDraft("");
                            }}
                            disabled={busyId === r.id}
                            className="rounded-md border border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-300 transition hover:bg-neutral-800"
                          >
                            취소
                          </button>
                          <button
                            onClick={() => handleSave(r.id)}
                            disabled={busyId === r.id}
                            className="rounded-md border border-violet-700/60 bg-violet-600/20 px-2.5 py-1 text-[11px] text-violet-200 transition hover:bg-violet-600/30 disabled:opacity-40"
                          >
                            {busyId === r.id ? "저장 중…" : "답변 저장"}
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          {status !== "closed" ? (
                            <button
                              onClick={() => handleQuickStatus(r.id, "closed")}
                              disabled={busyId === r.id}
                              className="rounded-md border border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-400 transition hover:bg-neutral-800 disabled:opacity-40"
                            >
                              종료
                            </button>
                          ) : null}
                          <button
                            onClick={() => openEditor(r)}
                            className="rounded-md border border-violet-700/60 px-2.5 py-1 text-[11px] text-violet-300 transition hover:bg-violet-950/40"
                          >
                            {r.admin_response ? "답변 수정" : "답변"}
                          </button>
                        </div>
                      )}
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

function StatusBadge({ status }: { status: RequestStatus }) {
  const map: Record<RequestStatus, { label: string; cls: string }> = {
    pending: {
      label: "대기",
      cls: "border-amber-700/60 bg-amber-900/30 text-amber-200",
    },
    in_progress: {
      label: "처리중",
      cls: "border-sky-800/60 bg-sky-900/30 text-sky-200",
    },
    resolved: {
      label: "해결",
      cls: "border-emerald-800/60 bg-emerald-900/30 text-emerald-200",
    },
    closed: {
      label: "종료",
      cls: "border-neutral-700 bg-neutral-900 text-neutral-400",
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

function CategoryBadge({ category }: { category: RequestCategory | null }) {
  const map: Record<RequestCategory, { label: string; cls: string }> = {
    bug: { label: "버그", cls: "border-red-900/60 bg-red-950/40 text-red-300" },
    feature: {
      label: "기능요청",
      cls: "border-violet-800/60 bg-violet-900/30 text-violet-200",
    },
    question: {
      label: "문의",
      cls: "border-sky-800/60 bg-sky-900/30 text-sky-200",
    },
    other: {
      label: "기타",
      cls: "border-neutral-700 bg-neutral-900 text-neutral-400",
    },
  };
  const m = map[category ?? "other"];
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
