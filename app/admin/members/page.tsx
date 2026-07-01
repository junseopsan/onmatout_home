"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell, useBoContext } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";

// 회원(student_profiles) 관리 — 선생님(teacher_id = auth.uid()) 본인 회원만.
// invite_code 는 DB 트리거(set_student_invite_code)가 자동 생성.

type Member = {
  id: string;
  teacher_id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  memo: string | null;
  status: string;
  custom_status: string | null;
  invite_code: string;
  invite_code_used_at: string | null;
  created_at: string;
};

type FormState = {
  id: string | null;
  name: string;
  phone: string;
  memo: string;
  status: string;
  custom_status: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  phone: "",
  memo: "",
  status: "active",
  custom_status: "",
};

const STATUS_OPTIONS = [
  { value: "active", label: "활성" },
  { value: "inactive", label: "비활성" },
  { value: "paused", label: "휴면" },
];

const PAGE_LIMIT = 1000;

function normalizePhone(raw: string) {
  return raw.replace(/[^0-9]/g, "");
}
function fmtPhone(p: string | null) {
  if (!p) return "—";
  const d = p.replace(/[^0-9]/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  return p;
}
function statusLabel(m: Member) {
  if (m.custom_status) return m.custom_status;
  return STATUS_OPTIONS.find((s) => s.value === m.status)?.label ?? m.status;
}

export default function AdminMembersPage() {
  const ctx = useBoContext();
  const role = ctx?.role ?? "studio_owner";
  const uid = ctx?.session.user.id ?? null;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState<FormState | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      let req = supabase
        .from("student_profiles")
        .select(
          "id, teacher_id, user_id, name, phone, memo, status, custom_status, invite_code, invite_code_used_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(PAGE_LIMIT);
      // 본인 명의 회원만 (super_admin 도 본인 명의만 — 정책상 전체 관리 아님)
      if (uid) req = req.eq("teacher_id", uid);
      const { data, error: err } = await req;
      if (err) throw err;
      setMembers((data ?? []) as Member[]);
    } catch (e: any) {
      setError(e?.message ?? "회원을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ctx) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.session.user.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.phone ?? "").includes(q) ||
        (m.memo ?? "").toLowerCase().includes(q) ||
        m.invite_code.toLowerCase().includes(q)
      );
    });
  }, [members, query, statusFilter]);

  const openNew = () => setForm({ ...EMPTY_FORM });
  const openEdit = (m: Member) =>
    setForm({
      id: m.id,
      name: m.name,
      phone: m.phone ?? "",
      memo: m.memo ?? "",
      status: m.status,
      custom_status: m.custom_status ?? "",
    });

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      alert("이름은 필수예요.");
      return;
    }
    if (!uid) {
      alert("세션을 확인할 수 없어요. 다시 로그인해주세요.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const payload = {
        name: form.name.trim(),
        phone: normalizePhone(form.phone) || null,
        memo: form.memo.trim() || null,
        status: form.status,
        custom_status: form.custom_status.trim() || null,
      };
      if (form.id) {
        const { error: err } = await supabase
          .from("student_profiles")
          .update(payload)
          .eq("id", form.id);
        if (err) throw err;
        setNotice(`'${payload.name}' 수정 완료`);
      } else {
        // teacher_id 는 본인. invite_code 는 트리거가 생성.
        const { error: err } = await supabase
          .from("student_profiles")
          .insert({ ...payload, teacher_id: uid });
        if (err) throw err;
        setNotice(`'${payload.name}' 등록 완료`);
      }
      setForm(null);
      await load();
    } catch (e: any) {
      alert(`저장 실패: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: Member) => {
    if (!confirm(`'${m.name}' 회원을 삭제할까요?`)) return;
    setBusy(true);
    try {
      const { error: err } = await supabase
        .from("student_profiles")
        .delete()
        .eq("id", m.id);
      if (err) throw err;
      await load();
    } catch (e: any) {
      alert(`삭제 실패: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-ink">
            회원
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            회원 관리
          </h1>
          <p className="mt-1 text-sm text-muted-ink">
            내 회원을 등록·수정·삭제합니다. 초대코드는 등록 시 자동 생성돼요.
            {role === "super_admin"
              ? " (어드민 계정 명의로 등록된 회원만 표시됩니다.)"
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openNew}
            className="rounded-md border border-coral/40 bg-coral/12 px-3 py-1.5 text-xs text-coral-active transition hover:bg-coral/20"
          >
            + 새 회원
          </button>
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
      {notice ? (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-md border border-success/30 bg-success/12 px-3 py-2 text-xs text-success">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-success">
            ✕
          </button>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-hairline bg-canvas px-2 py-1.5 text-xs outline-none focus:border-coral"
          >
            <option value="all">전체 상태</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted-ink">
            {filtered.length} / {members.length}
          </span>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·전화·메모·초대코드 검색…"
          className="w-64 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm placeholder-muted-soft outline-none focus:border-coral"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-hairline">
        <table className="w-full text-sm">
          <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-wider text-muted-ink">
            <tr>
              <th className="px-4 py-2.5">이름</th>
              <th className="px-4 py-2.5">전화</th>
              <th className="px-4 py-2.5">상태</th>
              <th className="px-4 py-2.5">초대코드</th>
              <th className="px-4 py-2.5">연결</th>
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
                  회원이 없어요. ‘+ 새 회원’ 또는 ‘회원 일괄등록’으로 추가하세요.
                </td>
              </tr>
            ) : null}
            {filtered.map((m) => (
              <tr
                key={m.id}
                className="border-t border-hairline align-middle transition hover:bg-surface-soft"
              >
                <td className="px-4 py-2">
                  <p className="font-medium text-ink">{m.name}</p>
                  {m.memo ? (
                    <p className="line-clamp-1 text-[11px] text-muted-ink">
                      {m.memo}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-body">{fmtPhone(m.phone)}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      "rounded-md border px-2 py-0.5 text-[10px] " +
                      (m.status === "active"
                        ? "border-success/40 bg-success/12 text-success"
                        : "border-hairline text-muted-ink")
                    }
                  >
                    {statusLabel(m)}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-[11px] text-muted-ink">
                  {m.invite_code}
                </td>
                <td className="px-4 py-2">
                  {m.invite_code_used_at || m.user_id ? (
                    <span className="text-[11px] text-success">앱 연결됨</span>
                  ) : (
                    <span className="text-[11px] text-muted-soft">미연결</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openEdit(m)}
                      className="rounded-md border border-coral/40 px-2.5 py-1 text-[11px] text-coral-active transition hover:bg-coral/[0.08]"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => remove(m)}
                      disabled={busy}
                      className="rounded-md border border-error/40 px-2.5 py-1 text-[11px] text-error transition hover:bg-error/10 disabled:opacity-40"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form ? (
        <MemberEditor
          form={form}
          setForm={setForm}
          busy={busy}
          onCancel={() => setForm(null)}
          onSave={save}
        />
      ) : null}
    </AdminShell>
  );
}

function MemberEditor({
  form,
  setForm,
  busy,
  onCancel,
  onSave,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = (k: keyof FormState, v: string) => setForm({ ...form, [k]: v });
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 md:p-8">
      <div className="w-full max-w-lg rounded-lg border border-hairline bg-canvas p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">
            {form.id ? "회원 수정" : "새 회원"}
          </h2>
          <button
            onClick={onCancel}
            className="rounded-md border border-hairline px-2.5 py-1 text-xs text-muted-ink transition hover:bg-surface-strong"
          >
            닫기
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="이름 *">
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="전화번호">
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className={inputCls}
              placeholder="01012345678"
            />
          </Field>
          <Field label="상태">
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className={inputCls}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="커스텀 상태(선택)">
            <input
              value={form.custom_status}
              onChange={(e) => set("custom_status", e.target.value)}
              className={inputCls}
              placeholder="예: 3개월권"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="메모">
              <textarea
                value={form.memo}
                onChange={(e) => set("memo", e.target.value)}
                rows={3}
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-hairline px-3 py-1.5 text-xs text-body transition hover:bg-surface-strong"
          >
            취소
          </button>
          <button
            onClick={onSave}
            disabled={busy}
            className="rounded-md border border-coral/40 bg-coral/12 px-4 py-1.5 text-xs text-coral-active transition hover:bg-coral/20 disabled:opacity-40"
          >
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-hairline bg-canvas px-2.5 py-1.5 text-sm text-ink placeholder-muted-soft outline-none focus:border-coral";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wider text-muted-ink">
        {label}
      </span>
      {children}
    </label>
  );
}
