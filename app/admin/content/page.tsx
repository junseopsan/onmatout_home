"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";

type RecordRow = {
  id: string;
  user_id: string | null;
  title: string;
  memo: string | null;
  photos: unknown;
  asanas: unknown;
  practice_date: string;
  created_at: string | null;
  hidden_at: string | null;
  hidden_reason: string | null;
};

type CommentRow = {
  id: string;
  user_id: string | null;
  record_id: string | null;
  parent_id: string | null;
  content: string;
  created_at: string | null;
  hidden_at: string | null;
  hidden_reason: string | null;
};

type UserInfo = { user_id: string; phone: string | null; name: string | null };

type Tab = "records" | "comments";
type StatusFilter = "all" | "visible" | "hidden";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "visible", label: "노출" },
  { value: "hidden", label: "숨김" },
];

const LIMIT = 300;

function arrLen(v: unknown) {
  return Array.isArray(v) ? v.length : 0;
}

export default function AdminContentPage() {
  const [tab, setTab] = useState<Tab>("records");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [users, setUsers] = useState<Map<string, UserInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [hideOpenFor, setHideOpenFor] = useState<string | null>(null);
  const [hideReason, setHideReason] = useState("");

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [{ data: rec, error: rErr }, { data: com, error: cErr }] =
        await Promise.all([
          supabase
            .from("practice_records")
            .select(
              "id, user_id, title, memo, photos, asanas, practice_date, created_at, hidden_at, hidden_reason",
            )
            .order("created_at", { ascending: false })
            .limit(LIMIT),
          supabase
            .from("feed_comments")
            .select(
              "id, user_id, record_id, parent_id, content, created_at, hidden_at, hidden_reason",
            )
            .order("created_at", { ascending: false })
            .limit(LIMIT),
        ]);
      if (rErr) throw rErr;
      if (cErr) throw cErr;
      const recs = (rec ?? []) as RecordRow[];
      const coms = (com ?? []) as CommentRow[];
      setRecords(recs);
      setComments(coms);

      const userIds = Array.from(
        new Set(
          [...recs, ...coms]
            .map((x) => x.user_id)
            .filter((x): x is string => !!x),
        ),
      );
      if (userIds.length > 0) {
        const { data: infos, error: iErr } = await supabase.rpc(
          "admin_get_users_info",
          { p_user_ids: userIds },
        );
        if (!iErr && infos) {
          const map = new Map<string, UserInfo>();
          for (const row of infos as UserInfo[]) map.set(row.user_id, row);
          setUsers(map);
        }
      }
    } catch (e: any) {
      setError(
        e?.message ??
          "데이터를 불러오지 못했어요. (어드민 RLS/컬럼 적용 여부를 확인하세요)",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const userName = (uid: string | null) => {
    if (!uid) return "탈퇴/익명";
    const u = users.get(uid);
    return u?.name ?? u?.phone ?? uid.slice(0, 8);
  };

  const matchStatus = (hidden_at: string | null) =>
    statusFilter === "all" ||
    (statusFilter === "hidden" ? !!hidden_at : !hidden_at);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter(
      (r) =>
        matchStatus(r.hidden_at) &&
        (!q ||
          r.title.toLowerCase().includes(q) ||
          (r.memo ?? "").toLowerCase().includes(q) ||
          userName(r.user_id).toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, query, statusFilter, users]);

  const filteredComments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return comments.filter(
      (c) =>
        matchStatus(c.hidden_at) &&
        (!q ||
          c.content.toLowerCase().includes(q) ||
          userName(c.user_id).toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, query, statusFilter, users]);

  const hiddenCount = (tab === "records" ? records : comments).filter(
    (x) => x.hidden_at,
  ).length;

  const hide = async (table: Tab, id: string, reason: string) => {
    setBusyId(id);
    try {
      const sess = await supabase.auth.getSession();
      const { error: err } = await supabase
        .from(table === "records" ? "practice_records" : "feed_comments")
        .update({
          hidden_at: new Date().toISOString(),
          hidden_by: sess.data.session?.user.id ?? null,
          hidden_reason: reason.trim() || null,
        })
        .eq("id", id);
      if (err) throw err;
      setHideOpenFor(null);
      setHideReason("");
      await load();
    } catch (e: any) {
      alert(`숨김에 실패했어요: ${e?.message ?? "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  const unhide = async (table: Tab, id: string) => {
    setBusyId(id);
    try {
      const { error: err } = await supabase
        .from(table === "records" ? "practice_records" : "feed_comments")
        .update({ hidden_at: null, hidden_by: null, hidden_reason: null })
        .eq("id", id);
      if (err) throw err;
      await load();
    } catch (e: any) {
      alert(`숨김 해제에 실패했어요: ${e?.message ?? "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminShell>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
            콘텐츠
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">콘텐츠 모더레이션</h1>
          <p className="mt-1 text-sm text-neutral-400">
            피드(수련 기록·댓글)를 조회하고, 문제되는 콘텐츠를 숨길 수 있어요.
            {hiddenCount > 0 ? (
              <span className="ml-2 text-red-300">현재 탭 숨김 {hiddenCount}건</span>
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

      {/* 탭 + 필터 */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-1">
          {(
            [
              { value: "records", label: `수련 기록 (${records.length})` },
              { value: "comments", label: `댓글 (${comments.length})` },
            ] as { value: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setTab(t.value);
                setHideOpenFor(null);
              }}
              className={
                "rounded-md border px-3 py-1.5 text-sm transition " +
                (tab === t.value
                  ? "border-violet-500 bg-violet-600/20 text-violet-200"
                  : "border-neutral-700 text-neutral-400 hover:bg-neutral-800")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={
                  "rounded-md border px-2.5 py-1 text-xs transition " +
                  (statusFilter === f.value
                    ? "border-violet-500 bg-violet-600/20 text-violet-200"
                    : "border-neutral-700 text-neutral-400 hover:bg-neutral-800")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="내용·작성자 검색…"
            className="w-56 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm placeholder-neutral-600 outline-none focus:border-violet-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/60 text-left text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">작성자</th>
              <th className="px-4 py-2.5">{tab === "records" ? "제목·메모" : "댓글 내용"}</th>
              <th className="px-4 py-2.5">{tab === "records" ? "구성" : "원본"}</th>
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

            {!loading && tab === "records" && filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  조건에 맞는 기록이 없어요.
                </td>
              </tr>
            ) : null}
            {!loading && tab === "comments" && filteredComments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  조건에 맞는 댓글이 없어요.
                </td>
              </tr>
            ) : null}

            {tab === "records" &&
              filteredRecords.map((r) => (
                <ContentRow
                  key={r.id}
                  id={r.id}
                  author={userName(r.user_id)}
                  primary={r.title}
                  secondary={r.memo ?? ""}
                  meta={`아사나 ${arrLen(r.asanas)} · 사진 ${arrLen(r.photos)}`}
                  date={(r.created_at ?? r.practice_date ?? "").slice(0, 10)}
                  hiddenAt={r.hidden_at}
                  hiddenReason={r.hidden_reason}
                  busy={busyId === r.id}
                  hideOpen={hideOpenFor === r.id}
                  hideReason={hideReason}
                  onHideReasonChange={setHideReason}
                  onOpenHide={() => {
                    setHideOpenFor(r.id);
                    setHideReason("");
                  }}
                  onCancelHide={() => {
                    setHideOpenFor(null);
                    setHideReason("");
                  }}
                  onHide={() => hide("records", r.id, hideReason)}
                  onUnhide={() => unhide("records", r.id)}
                />
              ))}

            {tab === "comments" &&
              filteredComments.map((c) => (
                <ContentRow
                  key={c.id}
                  id={c.id}
                  author={userName(c.user_id)}
                  primary={c.content}
                  secondary=""
                  meta={
                    (c.parent_id ? "대댓글 · " : "") +
                    (c.record_id ? `기록 ${c.record_id.slice(0, 8)}` : "—")
                  }
                  date={(c.created_at ?? "").slice(0, 10)}
                  hiddenAt={c.hidden_at}
                  hiddenReason={c.hidden_reason}
                  busy={busyId === c.id}
                  hideOpen={hideOpenFor === c.id}
                  hideReason={hideReason}
                  onHideReasonChange={setHideReason}
                  onOpenHide={() => {
                    setHideOpenFor(c.id);
                    setHideReason("");
                  }}
                  onCancelHide={() => {
                    setHideOpenFor(null);
                    setHideReason("");
                  }}
                  onHide={() => hide("comments", c.id, hideReason)}
                  onUnhide={() => unhide("comments", c.id)}
                />
              ))}
          </tbody>
        </table>
        {(tab === "records" ? records.length : comments.length) >= LIMIT ? (
          <p className="border-t border-neutral-800 px-4 py-2 text-[11px] text-neutral-500">
            최근 {LIMIT}건만 표시합니다.
          </p>
        ) : null}
      </div>
      <p className="mt-3 text-[11px] text-neutral-600">
        ※ 숨김은 soft-hide(hidden_at)로 기록되며 데이터는 보존됩니다. 앱 피드에서 실제로
        가려지려면 앱 조회 쿼리에 hidden_at IS NULL 조건이 필요합니다.
      </p>
    </AdminShell>
  );
}

function ContentRow(props: {
  id: string;
  author: string;
  primary: string;
  secondary: string;
  meta: string;
  date: string;
  hiddenAt: string | null;
  hiddenReason: string | null;
  busy: boolean;
  hideOpen: boolean;
  hideReason: string;
  onHideReasonChange: (v: string) => void;
  onOpenHide: () => void;
  onCancelHide: () => void;
  onHide: () => void;
  onUnhide: () => void;
}) {
  const hidden = !!props.hiddenAt;
  return (
    <tr className="border-t border-neutral-800 align-top transition hover:bg-neutral-900/50">
      <td className="px-4 py-3 text-neutral-200">{props.author}</td>
      <td className="px-4 py-3">
        <p className={"font-medium " + (hidden ? "text-neutral-500 line-through" : "text-neutral-100")}>
          {props.primary}
        </p>
        {props.secondary ? (
          <p className="mt-1 max-w-md truncate text-[11px] text-neutral-500">
            {props.secondary}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-[11px] text-neutral-500">{props.meta}</td>
      <td className="px-4 py-3">
        {hidden ? (
          <div>
            <span className="inline-flex items-center rounded-md border border-red-900/60 bg-red-950/40 px-2 py-0.5 text-[11px] font-medium text-red-300">
              숨김
            </span>
            {props.hiddenReason ? (
              <p className="mt-1 max-w-[10rem] truncate text-[11px] text-neutral-500">
                {props.hiddenReason}
              </p>
            ) : null}
          </div>
        ) : (
          <span className="inline-flex items-center rounded-md border border-emerald-800/60 bg-emerald-900/30 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
            노출
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-neutral-400">{props.date || "—"}</td>
      <td className="px-4 py-3 text-right">
        {props.hideOpen ? (
          <div className="flex flex-col items-end gap-2">
            <textarea
              autoFocus
              value={props.hideReason}
              onChange={(e) => props.onHideReasonChange(e.target.value)}
              placeholder="숨김 사유(선택)"
              rows={2}
              className="w-44 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs placeholder-neutral-600 outline-none focus:border-violet-500"
            />
            <div className="flex gap-2">
              <button
                onClick={props.onCancelHide}
                disabled={props.busy}
                className="rounded-md border border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-300 transition hover:bg-neutral-800"
              >
                취소
              </button>
              <button
                onClick={props.onHide}
                disabled={props.busy}
                className="rounded-md border border-red-900/60 bg-red-950/40 px-2.5 py-1 text-[11px] text-red-300 transition hover:bg-red-900/40 disabled:opacity-40"
              >
                {props.busy ? "처리 중…" : "숨김 확정"}
              </button>
            </div>
          </div>
        ) : hidden ? (
          <button
            onClick={props.onUnhide}
            disabled={props.busy}
            className="rounded-md border border-emerald-800/60 px-2.5 py-1 text-[11px] text-emerald-300 transition hover:bg-emerald-950/40 disabled:opacity-40"
          >
            {props.busy ? "처리 중…" : "숨김 해제"}
          </button>
        ) : (
          <button
            onClick={props.onOpenHide}
            disabled={props.busy}
            className="rounded-md border border-red-900/60 px-2.5 py-1 text-[11px] text-red-300 transition hover:bg-red-950/40 disabled:opacity-40"
          >
            숨김
          </button>
        )}
      </td>
    </tr>
  );
}
