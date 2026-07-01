"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell, useBoContext } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";

// 시퀀스(routines) + 구성 아사나(routine_items) 관리
// - super_admin: 모든 시퀀스 (override RLS: admin_routines.sql)
// - studio_owner: 본인 명의(teacher_id = auth.uid()) 시퀀스만

type Asana = {
  id: string;
  sanskrit_name_kr: string;
  sanskrit_name_en: string;
  image_number: string | null;
  search_aliases: string[] | null;
};

type RoutineRow = {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  visibility: "public" | "private";
  is_draft: boolean;
  updated_at: string;
  routine_items: { id: string }[];
};

type ItemForm = {
  asana_id: string;
  sanskrit_name_kr: string;
  sanskrit_name_en: string;
  image_number: string | null;
  duration_seconds: string; // 입력 편의상 문자열(초)
  memo: string;
};

type RoutineForm = {
  id: string | null; // null = 신규
  title: string;
  description: string;
  visibility: "public" | "private";
  is_draft: boolean;
  items: ItemForm[];
};

const EMPTY_FORM: RoutineForm = {
  id: null,
  title: "",
  description: "",
  visibility: "private",
  is_draft: true,
  items: [],
};

const PAGE_LIMIT = 1000;

function imgSrc(imageNumber: string | null) {
  if (!imageNumber) return null;
  return `/images/asanas/${imageNumber}_001.png`;
}

function fmtDuration(totalSec: number) {
  if (!totalSec || totalSec <= 0) return "—";
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m && s) return `${m}분 ${s}초`;
  if (m) return `${m}분`;
  return `${s}초`;
}

export default function AdminRoutinesPage() {
  const ctx = useBoContext();
  const role = ctx?.role ?? "studio_owner";
  const uid = ctx?.session.user.id ?? null;

  const [asanas, setAsanas] = useState<Asana[]>([]);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<RoutineForm | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      // 아사나 사전(피커용)
      const aReq = supabase
        .from("asanas")
        .select("id, sanskrit_name_kr, sanskrit_name_en, image_number, search_aliases")
        .order("sanskrit_name_kr", { ascending: true })
        .limit(PAGE_LIMIT);

      // 시퀀스 목록 — super_admin 은 전체, 원장은 본인 명의만
      let rReq = supabase
        .from("routines")
        .select(
          "id, teacher_id, title, description, visibility, is_draft, updated_at, routine_items(id)",
        )
        .order("updated_at", { ascending: false })
        .limit(PAGE_LIMIT);
      if (role !== "super_admin" && uid) rReq = rReq.eq("teacher_id", uid);

      const [{ data: a, error: aErr }, { data: r, error: rErr }] =
        await Promise.all([aReq, rReq]);
      if (aErr) throw aErr;
      if (rErr) throw rErr;
      setAsanas((a ?? []) as Asana[]);
      setRoutines((r ?? []) as RoutineRow[]);
    } catch (e: any) {
      setError(
        e?.message ??
          "데이터를 불러오지 못했어요. (admin_routines.sql 적용 확인)",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ctx) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.session.user.id, role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return routines;
    return routines.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    );
  }, [routines, query]);

  const openNew = () => setForm({ ...EMPTY_FORM, items: [] });

  const openEdit = async (r: RoutineRow) => {
    setBusy(true);
    try {
      const { data: items, error: err } = await supabase
        .from("routine_items")
        .select("asana_id, order_index, duration_seconds, memo")
        .eq("routine_id", r.id)
        .order("order_index", { ascending: true });
      if (err) throw err;
      const byId = new Map(asanas.map((a) => [a.id, a]));
      const itemForms: ItemForm[] = (items ?? []).map((it: any) => {
        const a = byId.get(it.asana_id);
        return {
          asana_id: it.asana_id,
          sanskrit_name_kr: a?.sanskrit_name_kr ?? "(삭제된 아사나)",
          sanskrit_name_en: a?.sanskrit_name_en ?? "",
          image_number: a?.image_number ?? null,
          duration_seconds:
            it.duration_seconds != null ? String(it.duration_seconds) : "",
          memo: it.memo ?? "",
        };
      });
      setForm({
        id: r.id,
        title: r.title,
        description: r.description ?? "",
        visibility: r.visibility,
        is_draft: r.is_draft,
        items: itemForms,
      });
    } catch (e: any) {
      alert(`구성 아사나를 불러오지 못했어요: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!form) return;
    if (!form.title.trim()) {
      alert("제목은 필수예요.");
      return;
    }
    if (form.items.length === 0) {
      alert("아사나를 1개 이상 추가해주세요.");
      return;
    }
    if (!uid) {
      alert("세션을 확인할 수 없어요. 다시 로그인해주세요.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const routinePayload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        visibility: form.visibility,
        is_draft: form.is_draft,
      };

      let routineId = form.id;
      if (form.id) {
        const { error: err } = await supabase
          .from("routines")
          .update(routinePayload)
          .eq("id", form.id);
        if (err) throw err;
      } else {
        // 신규: 본인(teacher_id) 명의로 생성
        const { data, error: err } = await supabase
          .from("routines")
          .insert({ ...routinePayload, teacher_id: uid })
          .select("id")
          .single();
        if (err) throw err;
        routineId = (data as { id: string }).id;
      }

      // 항목 전체 교체(삭제 후 재삽입) — 순서/내용 단순 동기화
      const { error: delErr } = await supabase
        .from("routine_items")
        .delete()
        .eq("routine_id", routineId!);
      if (delErr) throw delErr;

      const itemRows = form.items.map((it, i) => ({
        routine_id: routineId!,
        asana_id: it.asana_id,
        order_index: i,
        duration_seconds: it.duration_seconds.trim()
          ? Math.max(0, parseInt(it.duration_seconds, 10) || 0)
          : null,
        memo: it.memo.trim() || null,
      }));
      const { error: insErr } = await supabase
        .from("routine_items")
        .insert(itemRows);
      if (insErr) throw insErr;

      setNotice(
        `'${routinePayload.title}' 저장 완료 (아사나 ${itemRows.length}개)`,
      );
      setForm(null);
      await load();
    } catch (e: any) {
      alert(`저장 실패: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: RoutineRow) => {
    if (!confirm(`'${r.title}' 시퀀스를 삭제할까요? (구성 아사나도 함께 삭제)`))
      return;
    setBusy(true);
    try {
      // routine_items 는 routine_id FK CASCADE 로 함께 삭제됨
      const { error: err } = await supabase
        .from("routines")
        .delete()
        .eq("id", r.id);
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
            시퀀스
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            시퀀스 관리
          </h1>
          <p className="mt-1 text-sm text-muted-ink">
            아사나를 순서대로 엮어 시퀀스를 등록·수정·삭제합니다.{" "}
            {role === "super_admin"
              ? "공개(public) 시퀀스는 앱 전체에 노출됩니다."
              : "본인 명의 시퀀스만 관리할 수 있어요."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openNew}
            className="rounded-md border border-coral/40 bg-coral/12 px-3 py-1.5 text-xs text-coral-active transition hover:bg-coral/20"
          >
            + 새 시퀀스
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
          {filtered.length} / {routines.length}
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목·설명 검색…"
          className="w-60 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm placeholder-muted-soft outline-none focus:border-coral"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-hairline">
        <table className="w-full text-sm">
          <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-wider text-muted-ink">
            <tr>
              <th className="px-4 py-2.5">제목</th>
              <th className="px-4 py-2.5">아사나</th>
              <th className="px-4 py-2.5">공개</th>
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
                  시퀀스가 없어요. ‘+ 새 시퀀스’로 등록하세요.
                </td>
              </tr>
            ) : null}
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-t border-hairline align-middle transition hover:bg-surface-soft"
              >
                <td className="px-4 py-2">
                  <p className="font-medium text-ink">{r.title}</p>
                  {r.description ? (
                    <p className="line-clamp-1 text-[11px] text-muted-ink">
                      {r.description}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-muted-ink">
                  {r.routine_items?.length ?? 0}개
                </td>
                <td className="px-4 py-2">
                  {r.visibility === "public" ? (
                    <span className="rounded-md border border-success/40 bg-success/12 px-2 py-0.5 text-[10px] text-success">
                      공개
                    </span>
                  ) : (
                    <span className="rounded-md border border-hairline px-2 py-0.5 text-[10px] text-muted-ink">
                      비공개
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {r.is_draft ? (
                    <span className="text-[11px] text-muted-soft">초안</span>
                  ) : (
                    <span className="text-[11px] text-body">완료</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openEdit(r)}
                      disabled={busy}
                      className="rounded-md border border-coral/40 px-2.5 py-1 text-[11px] text-coral-active transition hover:bg-coral/[0.08] disabled:opacity-40"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => remove(r)}
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
        <RoutineEditor
          form={form}
          setForm={setForm}
          asanas={asanas}
          busy={busy}
          onCancel={() => setForm(null)}
          onSave={save}
        />
      ) : null}
    </AdminShell>
  );
}

function RoutineEditor({
  form,
  setForm,
  asanas,
  busy,
  onCancel,
  onSave,
}: {
  form: RoutineForm;
  setForm: (f: RoutineForm) => void;
  asanas: Asana[];
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [pick, setPick] = useState("");

  const set = <K extends keyof RoutineForm>(k: K, v: RoutineForm[K]) =>
    setForm({ ...form, [k]: v });

  const totalSec = form.items.reduce(
    (s, it) => s + (parseInt(it.duration_seconds || "0", 10) || 0),
    0,
  );

  const candidates = useMemo(() => {
    const q = pick.trim().toLowerCase();
    if (!q) return [];
    return asanas
      .filter(
        (a) =>
          a.sanskrit_name_kr.toLowerCase().includes(q) ||
          a.sanskrit_name_en.toLowerCase().includes(q) ||
          (a.search_aliases ?? []).some((x) => x.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [pick, asanas]);

  const addAsana = (a: Asana) => {
    setForm({
      ...form,
      items: [
        ...form.items,
        {
          asana_id: a.id,
          sanskrit_name_kr: a.sanskrit_name_kr,
          sanskrit_name_en: a.sanskrit_name_en,
          image_number: a.image_number,
          duration_seconds: "",
          memo: "",
        },
      ],
    });
    setPick("");
  };

  const updateItem = (idx: number, patch: Partial<ItemForm>) => {
    const items = form.items.slice();
    items[idx] = { ...items[idx], ...patch };
    setForm({ ...form, items });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= form.items.length) return;
    const items = form.items.slice();
    [items[idx], items[j]] = [items[j], items[idx]];
    setForm({ ...form, items });
  };

  const removeItem = (idx: number) =>
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 md:p-8">
      <div className="w-full max-w-3xl rounded-lg border border-hairline bg-canvas p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">
            {form.id ? "시퀀스 수정" : "새 시퀀스"}
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
            <Field label="제목 *">
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className={inputCls}
                placeholder="예: 아침을 여는 흐름 요가"
              />
            </Field>
          </div>
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
          <Field label="공개 범위">
            <select
              value={form.visibility}
              onChange={(e) =>
                set("visibility", e.target.value as "public" | "private")
              }
              className={inputCls}
            >
              <option value="private">비공개 (나만)</option>
              <option value="public">공개 (앱 전체 노출)</option>
            </select>
          </Field>
          <Field label="상태">
            <label className="flex h-[34px] items-center gap-2 text-sm text-body">
              <input
                type="checkbox"
                checked={form.is_draft}
                onChange={(e) => set("is_draft", e.target.checked)}
              />
              초안(draft)으로 표시
            </label>
          </Field>
        </div>

        {/* 아사나 추가 */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-muted-ink">
              구성 아사나 ({form.items.length}개 · 총 {fmtDuration(totalSec)})
            </p>
          </div>
          <div className="relative">
            <input
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              placeholder="아사나 이름·별칭으로 검색해 추가…"
              className={inputCls}
            />
            {candidates.length > 0 ? (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-hairline bg-canvas shadow-lg">
                {candidates.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => addAsana(a)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface-soft"
                  >
                    {imgSrc(a.image_number) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgSrc(a.image_number)!}
                        alt=""
                        className="h-8 w-8 rounded border border-hairline object-contain"
                        onError={(e) =>
                          ((e.target as HTMLImageElement).style.visibility =
                            "hidden")
                        }
                      />
                    ) : (
                      <div className="h-8 w-8 rounded border border-hairline" />
                    )}
                    <span className="text-ink">{a.sanskrit_name_kr}</span>
                    <span className="text-[11px] text-muted-ink">
                      {a.sanskrit_name_en}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* 항목 목록 */}
          <ol className="mt-3 space-y-2">
            {form.items.map((it, i) => (
              <li
                key={`${it.asana_id}-${i}`}
                className="flex items-center gap-3 rounded-md border border-hairline bg-surface-soft px-3 py-2"
              >
                <span className="w-5 text-center text-[11px] text-muted-ink">
                  {i + 1}
                </span>
                {imgSrc(it.image_number) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgSrc(it.image_number)!}
                    alt=""
                    className="h-10 w-10 rounded border border-hairline object-contain"
                    onError={(e) =>
                      ((e.target as HTMLImageElement).style.visibility =
                        "hidden")
                    }
                  />
                ) : (
                  <div className="h-10 w-10 rounded border border-hairline" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {it.sanskrit_name_kr}
                  </p>
                  <p className="truncate text-[11px] text-muted-ink">
                    {it.sanskrit_name_en}
                  </p>
                </div>
                <input
                  type="number"
                  min={0}
                  value={it.duration_seconds}
                  onChange={(e) =>
                    updateItem(i, { duration_seconds: e.target.value })
                  }
                  placeholder="초"
                  className="w-16 rounded-md border border-hairline bg-canvas px-2 py-1 text-xs outline-none focus:border-coral"
                />
                <input
                  value={it.memo}
                  onChange={(e) => updateItem(i, { memo: e.target.value })}
                  placeholder="메모"
                  className="w-32 rounded-md border border-hairline bg-canvas px-2 py-1 text-xs outline-none focus:border-coral"
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="rounded border border-hairline px-1.5 py-0.5 text-[11px] text-body disabled:opacity-30"
                    aria-label="위로"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === form.items.length - 1}
                    className="rounded border border-hairline px-1.5 py-0.5 text-[11px] text-body disabled:opacity-30"
                    aria-label="아래로"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeItem(i)}
                    className="rounded border border-error/40 px-1.5 py-0.5 text-[11px] text-error transition hover:bg-error/10"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {form.items.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-hairline px-3 py-6 text-center text-xs text-muted-soft">
              위 검색창에서 아사나를 찾아 추가하세요.
            </p>
          ) : null}
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
