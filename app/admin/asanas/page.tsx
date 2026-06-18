"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";

type Asana = {
  id: string;
  sanskrit_name_kr: string;
  sanskrit_name_en: string;
  sanskrit_name: string | null;
  asana_meaning: string | null;
  category_name_en: string | null;
  level: string | null;
  image_number: string | null;
  image_count: number;
  search_aliases: string[] | null;
  created_at?: string;
};

type Category = {
  id: string;
  category_name_en: string;
  category_name_ko: string;
};

type FormState = {
  id: string | null; // null = 신규
  sanskrit_name_kr: string;
  sanskrit_name_en: string;
  sanskrit_name: string;
  category_name_en: string;
  level: string;
  asana_meaning: string;
  search_aliases: string; // 쉼표 구분 입력
  image_number: string;
  image_count: string; // 입력 편의상 문자열
};

const EMPTY_FORM: FormState = {
  id: null,
  sanskrit_name_kr: "",
  sanskrit_name_en: "",
  sanskrit_name: "",
  category_name_en: "",
  level: "",
  asana_meaning: "",
  search_aliases: "",
  image_number: "",
  image_count: "1",
};

const PAGE_LIMIT = 1000;

// 아사나 이미지는 로딩 속도를 위해 로컬(public/images/asanas)에서 서빙한다.
// 원본은 Supabase Storage 의 asanas-images 버킷이며, scripts/sync-asana-images.mjs
// 로 로컬과 동기화한다.
function imgSrc(imageNumber: string | null, variant: number) {
  if (!imageNumber) return null;
  const v = String(variant).padStart(3, "0");
  return `/images/asanas/${imageNumber}_${v}.png`;
}

// 단건 아사나를 AI 지식베이스에 ingest (knowledge 페이지와 동일한 yoga-ingest 사용)
async function ingestAsana(a: {
  id: string;
  sanskrit_name_kr: string;
  sanskrit_name_en: string;
  asana_meaning: string | null;
  category_name_en: string | null;
  level: string | null;
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!accessToken || !baseUrl || !apikey) {
    throw new Error("ingest 환경(세션/env) 미설정");
  }
  const title = `${a.sanskrit_name_kr} (${a.sanskrit_name_en})`;
  const lines = [`아사나 이름: ${a.sanskrit_name_kr} / ${a.sanskrit_name_en}`];
  if (a.category_name_en) lines.push(`카테고리: ${a.category_name_en}`);
  if (a.level) lines.push(`난이도: ${a.level}`);
  if (a.asana_meaning) lines.push("", a.asana_meaning);

  const res = await fetch(`${baseUrl}/functions/v1/yoga-ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      source_type: "asana",
      source_id: a.id,
      title,
      content: lines.join("\n"),
      metadata: {
        sanskrit_name_en: a.sanskrit_name_en,
        category: a.category_name_en,
        level: a.level,
      },
    }),
  });
  if (!res.ok) throw new Error((await res.text()).slice(0, 200));
}

export default function AdminAsanasPage() {
  const [asanas, setAsanas] = useState<Asana[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [form, setForm] = useState<FormState | null>(null); // 열려있으면 편집/신규 모달

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [{ data: a, error: aErr }, { data: c, error: cErr }] =
        await Promise.all([
          supabase
            .from("asanas")
            .select("*")
            .order("sanskrit_name_kr", { ascending: true })
            .limit(PAGE_LIMIT),
          supabase
            .from("asanacategory")
            .select("id, category_name_en, category_name_ko")
            .order("category_name_ko", { ascending: true }),
        ]);
      if (aErr) throw aErr;
      if (cErr) throw cErr;
      setAsanas((a ?? []) as Asana[]);
      setCategories((c ?? []) as Category[]);
    } catch (e: any) {
      setError(
        e?.message ?? "데이터를 불러오지 못했어요. (admin_asanas.sql 적용 확인)",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const catKo = (en: string | null) =>
    categories.find((c) => c.category_name_en === en)?.category_name_ko ??
    en ??
    "—";

  const levels = useMemo(() => {
    const s = new Set<string>();
    for (const a of asanas) if (a.level) s.add(a.level);
    return Array.from(s).sort();
  }, [asanas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return asanas.filter((a) => {
      if (categoryFilter !== "all" && a.category_name_en !== categoryFilter)
        return false;
      if (levelFilter !== "all" && a.level !== levelFilter) return false;
      if (!q) return true;
      return (
        a.sanskrit_name_kr.toLowerCase().includes(q) ||
        a.sanskrit_name_en.toLowerCase().includes(q) ||
        (a.sanskrit_name ?? "").toLowerCase().includes(q) ||
        (a.search_aliases ?? []).some((x) => x.toLowerCase().includes(q))
      );
    });
  }, [asanas, query, categoryFilter, levelFilter]);

  const openNew = () => setForm({ ...EMPTY_FORM });
  const openEdit = (a: Asana) =>
    setForm({
      id: a.id,
      sanskrit_name_kr: a.sanskrit_name_kr,
      sanskrit_name_en: a.sanskrit_name_en,
      sanskrit_name: a.sanskrit_name ?? "",
      category_name_en: a.category_name_en ?? "",
      level: a.level ?? "",
      asana_meaning: a.asana_meaning ?? "",
      search_aliases: (a.search_aliases ?? []).join(", "),
      image_number: a.image_number ?? "",
      image_count: String(a.image_count ?? 1),
    });

  const save = async () => {
    if (!form) return;
    if (!form.sanskrit_name_kr.trim() || !form.sanskrit_name_en.trim()) {
      alert("한글명과 영문명은 필수예요.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const payload = {
        sanskrit_name_kr: form.sanskrit_name_kr.trim(),
        sanskrit_name_en: form.sanskrit_name_en.trim(),
        sanskrit_name: form.sanskrit_name.trim() || null,
        category_name_en: form.category_name_en.trim() || null,
        level: form.level.trim() || null,
        asana_meaning: form.asana_meaning.trim() || null,
        search_aliases: form.search_aliases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        image_number: form.image_number.trim() || null,
        image_count: Math.max(0, parseInt(form.image_count || "0", 10) || 0),
      };

      let asanaId = form.id;
      if (form.id) {
        const { error: err } = await supabase
          .from("asanas")
          .update(payload)
          .eq("id", form.id);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase
          .from("asanas")
          .insert(payload)
          .select("id")
          .single();
        if (err) throw err;
        asanaId = (data as { id: string }).id;
      }

      // 저장 후 AI 지식베이스 자동 반영 (실패해도 저장은 유지)
      try {
        await ingestAsana({
          id: asanaId!,
          sanskrit_name_kr: payload.sanskrit_name_kr,
          sanskrit_name_en: payload.sanskrit_name_en,
          asana_meaning: payload.asana_meaning,
          category_name_en: payload.category_name_en,
          level: payload.level,
        });
        setNotice(`'${payload.sanskrit_name_kr}' 저장 + AI 지식베이스 반영 완료`);
      } catch (ingestErr: any) {
        setNotice(
          `'${payload.sanskrit_name_kr}' 저장 완료 — AI 반영 실패(${ingestErr?.message ?? "unknown"}). ‘AI 지식베이스’에서 다시 ingest 하세요.`,
        );
      }

      setForm(null);
      await load();
    } catch (e: any) {
      alert(`저장 실패: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Asana) => {
    if (!confirm(`'${a.sanskrit_name_kr}' 아사나를 삭제할까요?`)) return;
    setBusy(true);
    try {
      const { error: err } = await supabase
        .from("asanas")
        .delete()
        .eq("id", a.id);
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
            아사나
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">아사나 관리</h1>
          <p className="mt-1 text-sm text-muted-ink">
            아사나 사전을 등록·수정·삭제합니다. 저장 시 AI 지식베이스에 자동
            반영(ingest)됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openNew}
            className="rounded-md border border-coral/40 bg-coral/12 px-3 py-1.5 text-xs text-coral-active transition hover:bg-coral/20"
          >
            + 새 아사나
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
          <button
            onClick={() => setNotice(null)}
            className="text-success hover:text-success"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* 필터 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-hairline bg-canvas px-2 py-1.5 text-xs outline-none focus:border-coral"
          >
            <option value="all">전체 카테고리</option>
            {categories.map((c) => (
              <option key={c.id} value={c.category_name_en}>
                {c.category_name_ko}
              </option>
            ))}
          </select>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-md border border-hairline bg-canvas px-2 py-1.5 text-xs outline-none focus:border-coral"
          >
            <option value="all">전체 레벨</option>
            {levels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted-ink">
            {filtered.length} / {asanas.length}
          </span>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·별칭 검색…"
          className="w-60 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm placeholder-muted-soft outline-none focus:border-coral"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-hairline">
        <table className="w-full text-sm">
          <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-wider text-muted-ink">
            <tr>
              <th className="px-4 py-2.5">이미지</th>
              <th className="px-4 py-2.5">이름</th>
              <th className="px-4 py-2.5">카테고리</th>
              <th className="px-4 py-2.5">레벨</th>
              <th className="px-4 py-2.5">이미지수</th>
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
                  조건에 맞는 아사나가 없어요.
                </td>
              </tr>
            ) : null}
            {filtered.map((a) => {
              const src = imgSrc(a.image_number, 1);
              return (
                <tr
                  key={a.id}
                  className="border-t border-hairline align-middle transition hover:bg-surface-soft"
                >
                  <td className="px-4 py-2">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt=""
                        className="h-12 w-12 rounded border border-hairline bg-neutral-100 object-contain p-0.5"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.visibility =
                            "hidden";
                        }}
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded border border-hairline text-[10px] text-muted-soft">
                        없음
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <p className="font-medium text-ink">
                      {a.sanskrit_name_kr}
                    </p>
                    <p className="text-[11px] text-muted-ink">
                      {a.sanskrit_name_en}
                    </p>
                  </td>
                  <td className="px-4 py-2 text-body">
                    {catKo(a.category_name_en)}
                  </td>
                  <td className="px-4 py-2 text-muted-ink">{a.level ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-ink">
                    {a.image_number ? `${a.image_number} · ${a.image_count}장` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(a)}
                        className="rounded-md border border-coral/40 px-2.5 py-1 text-[11px] text-coral-active transition hover:bg-coral/[0.08]"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => remove(a)}
                        disabled={busy}
                        className="rounded-md border border-error/40 px-2.5 py-1 text-[11px] text-error transition hover:bg-error/10 disabled:opacity-40"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {form ? (
        <AsanaEditor
          form={form}
          setForm={setForm}
          categories={categories}
          levels={levels}
          busy={busy}
          onCancel={() => setForm(null)}
          onSave={save}
        />
      ) : null}
    </AdminShell>
  );
}

function AsanaEditor({
  form,
  setForm,
  categories,
  levels,
  busy,
  onCancel,
  onSave,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  categories: Category[];
  levels: string[];
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = (k: keyof FormState, v: string) => setForm({ ...form, [k]: v });
  const count = Math.max(0, parseInt(form.image_count || "0", 10) || 0);
  const previews = Array.from({ length: Math.min(count, 6) }, (_, i) =>
    imgSrc(form.image_number, i + 1),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 md:p-8">
      <div className="w-full max-w-2xl rounded-lg border border-hairline bg-canvas p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">
            {form.id ? "아사나 수정" : "새 아사나"}
          </h2>
          <button
            onClick={onCancel}
            className="rounded-md border border-hairline px-2.5 py-1 text-xs text-muted-ink transition hover:bg-surface-strong"
          >
            닫기
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="한글명 *">
            <input
              value={form.sanskrit_name_kr}
              onChange={(e) => set("sanskrit_name_kr", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="영문명 *">
            <input
              value={form.sanskrit_name_en}
              onChange={(e) => set("sanskrit_name_en", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="산스크리트 원어">
            <input
              value={form.sanskrit_name}
              onChange={(e) => set("sanskrit_name", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="카테고리">
            <select
              value={form.category_name_en}
              onChange={(e) => set("category_name_en", e.target.value)}
              className={inputCls}
            >
              <option value="">선택 안 함</option>
              {categories.map((c) => (
                <option key={c.id} value={c.category_name_en}>
                  {c.category_name_ko} ({c.category_name_en})
                </option>
              ))}
            </select>
          </Field>
          <Field label="레벨">
            <input
              list="asana-levels"
              value={form.level}
              onChange={(e) => set("level", e.target.value)}
              className={inputCls}
              placeholder="예: 초급"
            />
            <datalist id="asana-levels">
              {levels.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </Field>
          <Field label="검색 별칭 (쉼표로 구분)">
            <input
              value={form.search_aliases}
              onChange={(e) => set("search_aliases", e.target.value)}
              className={inputCls}
              placeholder="다운독, downdog"
            />
          </Field>
          <Field label="이미지 번호">
            <input
              value={form.image_number}
              onChange={(e) => set("image_number", e.target.value)}
              className={inputCls}
              placeholder="예: 006"
            />
          </Field>
          <Field label="이미지 수">
            <input
              type="number"
              min={0}
              value={form.image_count}
              onChange={(e) => set("image_count", e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="의미·설명">
              <textarea
                value={form.asana_meaning}
                onChange={(e) => set("asana_meaning", e.target.value)}
                rows={3}
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* 이미지 미리보기 */}
        {form.image_number ? (
          <div className="mt-4">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-ink">
              이미지 미리보기 (public/images/asanas)
            </p>
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) =>
                src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-16 w-16 rounded border border-hairline bg-neutral-100 object-contain p-1"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.opacity = "0.2";
                    }}
                  />
                ) : null,
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-soft">
              ※ 이미지 파일은 별도로 public/images/asanas/{form.image_number}_00N.png 로
              추가/배포해야 표시됩니다.
            </p>
          </div>
        ) : null}

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
