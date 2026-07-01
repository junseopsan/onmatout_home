"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell, useBoContext } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";

// 수업(classes) 관리 — 선생님(teacher_id = auth.uid()) 본인 수업만.
// classes + class_schedules(요일·시간 반복) + class_students(수강생 배정).
// day_of_week: 0=일 ~ 6=토 (JS/Postgres dow 표준)

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Schedule = {
  day_of_week: number;
  start_time: string; // "HH:MM"
  end_time: string;
};

type ClassRow = {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  location: string | null;
  capacity: number | null;
  is_active: boolean;
  studio_id: string | null;
  class_schedules: { day_of_week: number; start_time: string; end_time: string }[];
  class_students: { student_id: string }[];
};

type Member = { id: string; name: string; phone: string | null };

type FormState = {
  id: string | null;
  title: string;
  description: string;
  location: string;
  capacity: string;
  is_active: boolean;
  schedules: Schedule[];
  studentIds: string[];
};

const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  description: "",
  location: "",
  capacity: "",
  is_active: true,
  schedules: [],
  studentIds: [],
};

const PAGE_LIMIT = 1000;

function hhmm(t: string) {
  return (t ?? "").slice(0, 5);
}
function scheduleSummary(s: ClassRow["class_schedules"]) {
  if (!s || s.length === 0) return "—";
  return [...s]
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
    .map((x) => `${DAYS[x.day_of_week] ?? "?"} ${hhmm(x.start_time)}`)
    .join(", ");
}

export default function AdminClassesPage() {
  const ctx = useBoContext();
  const uid = ctx?.session.user.id ?? null;

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const cReq = supabase
        .from("classes")
        .select(
          "id, teacher_id, title, description, location, capacity, is_active, studio_id, class_schedules(day_of_week, start_time, end_time), class_students(student_id)",
        )
        .order("created_at", { ascending: false })
        .limit(PAGE_LIMIT);
      const mReq = supabase
        .from("student_profiles")
        .select("id, name, phone")
        .order("name", { ascending: true })
        .limit(PAGE_LIMIT);

      const [{ data: c, error: cErr }, { data: m, error: mErr }] =
        await Promise.all([
          uid ? cReq.eq("teacher_id", uid) : cReq,
          uid ? mReq.eq("teacher_id", uid) : mReq,
        ]);
      if (cErr) throw cErr;
      if (mErr) throw mErr;
      setClasses((c ?? []) as ClassRow[]);
      setMembers((m ?? []) as Member[]);
    } catch (e: any) {
      setError(e?.message ?? "수업을 불러오지 못했어요.");
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
    if (!q) return classes;
    return classes.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.location ?? "").toLowerCase().includes(q),
    );
  }, [classes, query]);

  const openNew = () => setForm({ ...EMPTY_FORM, schedules: [], studentIds: [] });
  const openEdit = (c: ClassRow) =>
    setForm({
      id: c.id,
      title: c.title,
      description: c.description ?? "",
      location: c.location ?? "",
      capacity: c.capacity != null ? String(c.capacity) : "",
      is_active: c.is_active,
      schedules: (c.class_schedules ?? []).map((s) => ({
        day_of_week: s.day_of_week,
        start_time: hhmm(s.start_time),
        end_time: hhmm(s.end_time),
      })),
      studentIds: (c.class_students ?? []).map((s) => s.student_id),
    });

  const save = async () => {
    if (!form) return;
    if (!form.title.trim()) {
      alert("수업 제목은 필수예요.");
      return;
    }
    for (const s of form.schedules) {
      if (!s.start_time || !s.end_time) {
        alert("스케줄의 시작/종료 시간을 모두 입력해주세요.");
        return;
      }
      if (s.start_time >= s.end_time) {
        alert("종료 시간은 시작 시간보다 늦어야 해요.");
        return;
      }
    }
    if (!uid) {
      alert("세션을 확인할 수 없어요. 다시 로그인해주세요.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const classPayload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        capacity: form.capacity.trim()
          ? Math.max(0, parseInt(form.capacity, 10) || 0)
          : null,
        is_active: form.is_active,
      };

      let classId = form.id;
      if (form.id) {
        const { error: err } = await supabase
          .from("classes")
          .update(classPayload)
          .eq("id", form.id);
        if (err) throw err;
      } else {
        // 본인 명의, studio_id 는 null (개인 수업). RLS: teacher_id=auth.uid() 통과.
        const { data, error: err } = await supabase
          .from("classes")
          .insert({ ...classPayload, teacher_id: uid, studio_id: null })
          .select("id")
          .single();
        if (err) throw err;
        classId = (data as { id: string }).id;
      }

      // 스케줄 전체 교체
      {
        const { error: delErr } = await supabase
          .from("class_schedules")
          .delete()
          .eq("class_id", classId!);
        if (delErr) throw delErr;
        if (form.schedules.length > 0) {
          const rows = form.schedules.map((s) => ({
            class_id: classId!,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
          }));
          const { error: insErr } = await supabase
            .from("class_schedules")
            .insert(rows);
          if (insErr) throw insErr;
        }
      }

      // 수강생 전체 교체
      {
        const { error: delErr } = await supabase
          .from("class_students")
          .delete()
          .eq("class_id", classId!);
        if (delErr) throw delErr;
        if (form.studentIds.length > 0) {
          const rows = form.studentIds.map((sid) => ({
            class_id: classId!,
            student_id: sid,
            status: "active",
          }));
          const { error: insErr } = await supabase
            .from("class_students")
            .insert(rows);
          if (insErr) throw insErr;
        }
      }

      setNotice(`'${classPayload.title}' 저장 완료`);
      setForm(null);
      await load();
    } catch (e: any) {
      alert(`저장 실패: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: ClassRow) => {
    if (!confirm(`'${c.title}' 수업을 삭제할까요? (스케줄·수강생 배정도 함께 삭제)`))
      return;
    setBusy(true);
    try {
      // class_schedules / class_students 는 class_id FK 로 함께 정리됨(또는 정책상 교사 권한)
      await supabase.from("class_students").delete().eq("class_id", c.id);
      await supabase.from("class_schedules").delete().eq("class_id", c.id);
      const { error: err } = await supabase
        .from("classes")
        .delete()
        .eq("id", c.id);
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
            수업
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            수업 관리
          </h1>
          <p className="mt-1 text-sm text-muted-ink">
            수업을 등록하고 요일·시간 스케줄과 수강생을 배정합니다. (내 수업만
            표시)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openNew}
            className="rounded-md border border-coral/40 bg-coral/12 px-3 py-1.5 text-xs text-coral-active transition hover:bg-coral/20"
          >
            + 새 수업
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
        <span className="text-[11px] text-muted-ink">
          {filtered.length} / {classes.length}
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목·장소 검색…"
          className="w-60 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm placeholder-muted-soft outline-none focus:border-coral"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-hairline">
        <table className="w-full text-sm">
          <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-wider text-muted-ink">
            <tr>
              <th className="px-4 py-2.5">수업</th>
              <th className="px-4 py-2.5">스케줄</th>
              <th className="px-4 py-2.5">수강생</th>
              <th className="px-4 py-2.5">상태</th>
              <th className="px-4 py-2.5 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-ink">
                  불러오는 중…
                </td>
              </tr>
            ) : null}
            {!loading && filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-ink">
                  수업이 없어요. ‘+ 새 수업’으로 등록하세요.
                </td>
              </tr>
            ) : null}
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="border-t border-hairline align-middle transition hover:bg-surface-soft"
              >
                <td className="px-4 py-2">
                  <p className="font-medium text-ink">{c.title}</p>
                  {c.location ? (
                    <p className="text-[11px] text-muted-ink">{c.location}</p>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-body">
                  {scheduleSummary(c.class_schedules)}
                </td>
                <td className="px-4 py-2 text-muted-ink">
                  {c.class_students?.length ?? 0}
                  {c.capacity ? ` / ${c.capacity}` : ""}명
                </td>
                <td className="px-4 py-2">
                  {c.is_active ? (
                    <span className="rounded-md border border-success/40 bg-success/12 px-2 py-0.5 text-[10px] text-success">
                      운영중
                    </span>
                  ) : (
                    <span className="rounded-md border border-hairline px-2 py-0.5 text-[10px] text-muted-ink">
                      중지
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openEdit(c)}
                      className="rounded-md border border-coral/40 px-2.5 py-1 text-[11px] text-coral-active transition hover:bg-coral/[0.08]"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => remove(c)}
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
        <ClassEditor
          form={form}
          setForm={setForm}
          members={members}
          busy={busy}
          onCancel={() => setForm(null)}
          onSave={save}
        />
      ) : null}
    </AdminShell>
  );
}

function ClassEditor({
  form,
  setForm,
  members,
  busy,
  onCancel,
  onSave,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  members: Member[];
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [pick, setPick] = useState("");
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm({ ...form, [k]: v });

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  const addSchedule = () =>
    setForm({
      ...form,
      schedules: [
        ...form.schedules,
        { day_of_week: 1, start_time: "19:00", end_time: "20:00" },
      ],
    });
  const updateSchedule = (i: number, patch: Partial<Schedule>) => {
    const schedules = form.schedules.slice();
    schedules[i] = { ...schedules[i], ...patch };
    setForm({ ...form, schedules });
  };
  const removeSchedule = (i: number) =>
    setForm({ ...form, schedules: form.schedules.filter((_, j) => j !== i) });

  const candidates = useMemo(() => {
    const q = pick.trim().toLowerCase();
    const selected = new Set(form.studentIds);
    return members
      .filter((m) => !selected.has(m.id))
      .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.phone ?? "").includes(q))
      .slice(0, 8);
  }, [pick, members, form.studentIds]);

  const addStudent = (id: string) => {
    setForm({ ...form, studentIds: [...form.studentIds, id] });
    setPick("");
  };
  const removeStudent = (id: string) =>
    setForm({ ...form, studentIds: form.studentIds.filter((x) => x !== id) });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 md:p-8">
      <div className="w-full max-w-2xl rounded-lg border border-hairline bg-canvas p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">
            {form.id ? "수업 수정" : "새 수업"}
          </h2>
          <button
            onClick={onCancel}
            className="rounded-md border border-hairline px-2.5 py-1 text-xs text-muted-ink transition hover:bg-surface-strong"
          >
            닫기
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="수업 제목 *">
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className={inputCls}
                placeholder="예: 빈야사 입문반"
              />
            </Field>
          </div>
          <Field label="장소">
            <input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="정원">
            <input
              type="number"
              min={0}
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              className={inputCls}
              placeholder="제한 없음"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="설명">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="운영 상태">
            <label className="flex h-[34px] items-center gap-2 text-sm text-body">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
              />
              운영중(활성)
            </label>
          </Field>
        </div>

        {/* 스케줄 */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-muted-ink">
              스케줄 (요일·시간)
            </p>
            <button
              onClick={addSchedule}
              className="rounded-md border border-coral/40 px-2.5 py-1 text-[11px] text-coral-active transition hover:bg-coral/[0.08]"
            >
              + 시간 추가
            </button>
          </div>
          <div className="space-y-2">
            {form.schedules.map((s, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-md border border-hairline bg-surface-soft px-3 py-2"
              >
                <select
                  value={s.day_of_week}
                  onChange={(e) =>
                    updateSchedule(i, { day_of_week: parseInt(e.target.value, 10) })
                  }
                  className="rounded-md border border-hairline bg-canvas px-2 py-1 text-sm outline-none focus:border-coral"
                >
                  {DAYS.map((d, idx) => (
                    <option key={idx} value={idx}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={s.start_time}
                  onChange={(e) => updateSchedule(i, { start_time: e.target.value })}
                  className="rounded-md border border-hairline bg-canvas px-2 py-1 text-sm outline-none focus:border-coral"
                />
                <span className="text-muted-ink">~</span>
                <input
                  type="time"
                  value={s.end_time}
                  onChange={(e) => updateSchedule(i, { end_time: e.target.value })}
                  className="rounded-md border border-hairline bg-canvas px-2 py-1 text-sm outline-none focus:border-coral"
                />
                <button
                  onClick={() => removeSchedule(i)}
                  className="ml-auto rounded border border-error/40 px-2 py-0.5 text-[11px] text-error transition hover:bg-error/10"
                >
                  삭제
                </button>
              </div>
            ))}
            {form.schedules.length === 0 ? (
              <p className="rounded-md border border-dashed border-hairline px-3 py-4 text-center text-xs text-muted-soft">
                ‘+ 시간 추가’로 요일·시간을 등록하세요.
              </p>
            ) : null}
          </div>
        </div>

        {/* 수강생 */}
        <div className="mt-6">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-ink">
            수강생 ({form.studentIds.length}명)
          </p>
          <div className="relative">
            <input
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              placeholder="내 회원 이름·전화로 검색해 추가…"
              className={inputCls}
            />
            {candidates.length > 0 ? (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-hairline bg-canvas shadow-lg">
                {candidates.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => addStudent(m.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-surface-soft"
                  >
                    <span className="text-ink">{m.name}</span>
                    <span className="text-[11px] text-muted-ink">
                      {m.phone ?? ""}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {members.length === 0 ? (
            <p className="mt-2 text-[11px] text-muted-soft">
              먼저 ‘회원 관리’에서 회원을 등록하면 여기서 배정할 수 있어요.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {form.studentIds.map((id) => {
              const m = memberById.get(id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-soft px-2.5 py-1 text-xs text-ink"
                >
                  {m?.name ?? "(알 수 없음)"}
                  <button
                    onClick={() => removeStudent(id)}
                    className="text-muted-ink hover:text-error"
                    aria-label="제거"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
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
