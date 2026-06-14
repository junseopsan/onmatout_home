"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";

type Doc = {
  id: string;
  source_type: string;
  source_id: string | null;
  title: string;
  content: string;
  metadata: any;
  created_at: string;
};

const SOURCE_TYPES = [
  { value: "general", label: "일반" },
  { value: "asana", label: "아사나" },
  { value: "anatomy", label: "해부학" },
  { value: "philosophy", label: "철학" },
  { value: "safety", label: "안전·금기" },
  { value: "breathing", label: "호흡" },
  { value: "alignment", label: "정렬" },
  { value: "routine", label: "시퀀스" },
  { value: "teacher_note", label: "지도자 노트" },
  { value: "faq", label: "FAQ" },
];

type AsanaSummary = {
  id: string;
  sanskrit_name_kr: string;
  sanskrit_name_en: string;
  asana_meaning: string | null;
  category_name_en: string | null;
  level: string | null;
};

type BulkProgress = {
  running: boolean;
  total: number;
  done: number;
  ok: number;
  failed: number;
  failedSamples: string[];
};

export default function AdminKnowledgePage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Ingest 폼
  const [sourceType, setSourceType] = useState("general");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // 아사나 일괄 ingest
  const [asanasTotal, setAsanasTotal] = useState<number | null>(null);
  const [asanasIngested, setAsanasIngested] = useState<number | null>(null);
  const [bulk, setBulk] = useState<BulkProgress>({
    running: false,
    total: 0,
    done: 0,
    ok: 0,
    failed: 0,
    failedSamples: [],
  });

  const loadAsanaStats = async () => {
    const [{ count: total }, { data: ingestedRows }] = await Promise.all([
      supabase.from("asanas").select("id", { count: "exact", head: true }),
      supabase
        .from("knowledge_documents")
        .select("source_id")
        .eq("source_type", "asana"),
    ]);
    setAsanasTotal(total ?? 0);
    setAsanasIngested((ingestedRows ?? []).length);
  };

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .select("id, source_type, source_id, title, content, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setDocs((data ?? []) as Doc[]);
    } catch (e: any) {
      setError(e?.message ?? "데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadAsanaStats();
  }, []);

  const handleBulkIngestAsanas = async () => {
    if (bulk.running) return;
    setFeedback(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("세션이 없습니다.");
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!baseUrl || !apikey) throw new Error("env 미설정");

      // 1) 이미 ingest 된 source_id 셋
      const { data: existingDocs } = await supabase
        .from("knowledge_documents")
        .select("source_id")
        .eq("source_type", "asana");
      const existingSet = new Set(
        (existingDocs ?? []).map((r) => r.source_id).filter(Boolean),
      );

      // 2) 모든 아사나
      const { data: allAsanas } = await supabase
        .from("asanas")
        .select("id, sanskrit_name_kr, sanskrit_name_en, asana_meaning, category_name_en, level");
      const todo: AsanaSummary[] = (allAsanas ?? []).filter(
        (a) => !existingSet.has((a as any).id),
      ) as AsanaSummary[];

      setBulk({
        running: true,
        total: todo.length,
        done: 0,
        ok: 0,
        failed: 0,
        failedSamples: [],
      });

      for (let i = 0; i < todo.length; i++) {
        const a = todo[i];
        const titleText = `${a.sanskrit_name_kr} (${a.sanskrit_name_en})`;
        const lines: string[] = [];
        lines.push(`아사나 이름: ${a.sanskrit_name_kr} / ${a.sanskrit_name_en}`);
        if (a.category_name_en) lines.push(`카테고리: ${a.category_name_en}`);
        if (a.level) lines.push(`난이도: ${a.level}`);
        if (a.asana_meaning) lines.push("", a.asana_meaning);
        const contentText = lines.join("\n");

        try {
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
              title: titleText,
              content: contentText,
              metadata: {
                sanskrit_name_en: a.sanskrit_name_en,
                category: a.category_name_en,
                level: a.level,
              },
            }),
          });
          if (res.ok) {
            setBulk((p) => ({ ...p, done: p.done + 1, ok: p.ok + 1 }));
          } else {
            const bodyText = await res.text();
            setBulk((p) => ({
              ...p,
              done: p.done + 1,
              failed: p.failed + 1,
              failedSamples:
                p.failedSamples.length < 3
                  ? [...p.failedSamples, `${a.sanskrit_name_kr}: ${bodyText.slice(0, 120)}`]
                  : p.failedSamples,
            }));
          }
        } catch (e: any) {
          setBulk((p) => ({
            ...p,
            done: p.done + 1,
            failed: p.failed + 1,
            failedSamples:
              p.failedSamples.length < 3
                ? [...p.failedSamples, `${a.sanskrit_name_kr}: ${e?.message ?? "error"}`]
                : p.failedSamples,
          }));
        }
      }

      setBulk((p) => ({ ...p, running: false }));
      await loadAsanaStats();
      await load();
    } catch (e: any) {
      setBulk((p) => ({ ...p, running: false }));
      setFeedback(`실패: ${e?.message ?? String(e)}`);
    }
  };

  const handleIngest = async () => {
    if (!title.trim() || !content.trim()) {
      setFeedback("title / content 를 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      // fetch 로 직접 호출 — invoke 가 에러 본문을 삼켜서 실제 에러 메시지 보기 위해
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("세션이 없습니다. 다시 로그인해주세요.");

      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!baseUrl || !apikey) throw new Error("env 미설정");

      const res = await fetch(`${baseUrl}/functions/v1/yoga-ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          source_type: sourceType,
          title: title.trim(),
          content: content.trim(),
        }),
      });
      const bodyText = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        // text 그대로
      }
      if (!res.ok) {
        const reason = parsed?.error ?? bodyText ?? `HTTP ${res.status}`;
        throw new Error(`(${res.status}) ${reason}`);
      }
      setFeedback(`✓ 저장됨 (id: ${parsed?.id ?? "?"})`);
      setTitle("");
      setContent("");
      await load();
    } catch (e: any) {
      setFeedback(`실패: ${e?.message ?? String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 문서를 삭제할까요?")) return;
    setBusy(id);
    try {
      const { error } = await supabase
        .from("knowledge_documents")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(`삭제 실패: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(null);
    }
  };

  const filtered = docs.filter((d) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      d.content.toLowerCase().includes(q) ||
      d.source_type.toLowerCase().includes(q)
    );
  });

  return (
    <AdminShell>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
            AI 지식베이스
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            RAG 문서 관리
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            문서를 추가하면 자동으로 임베딩되어 `yoga-ask` 검색 대상에 포함됩니다.
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

      <section className="mb-6 rounded-lg border border-violet-900/60 bg-violet-950/20 p-5">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-200">
              아사나 일괄 ingest
            </h2>
            <p className="mt-1 text-[11px] text-neutral-400">
              {asanasTotal !== null && asanasIngested !== null
                ? `전체 ${asanasTotal}개 · 이미 임베딩 ${asanasIngested}개 · 남은 ${Math.max(0, asanasTotal - asanasIngested)}개`
                : "아사나 통계 로딩 중…"}
              {" "}
              · 한 건당 약 1초. 중복은 자동 스킵됩니다.
            </p>
          </div>
          <button
            onClick={handleBulkIngestAsanas}
            disabled={
              bulk.running ||
              asanasTotal === null ||
              (asanasIngested !== null && asanasIngested >= (asanasTotal ?? 0))
            }
            className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
          >
            {bulk.running
              ? `진행 중 ${bulk.done}/${bulk.total}`
              : asanasIngested !== null && asanasIngested >= (asanasTotal ?? 0)
                ? "전부 임베딩됨"
                : "남은 아사나 임베딩 시작"}
          </button>
        </div>

        {bulk.running || bulk.done > 0 ? (
          <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
              <span>
                완료 {bulk.done} / {bulk.total}
                {" · "}성공 {bulk.ok}
                {bulk.failed > 0 ? ` · 실패 ${bulk.failed}` : ""}
              </span>
              {bulk.total > 0 ? (
                <span className="text-neutral-500">
                  {Math.round((bulk.done / bulk.total) * 100)}%
                </span>
              ) : null}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-900">
              <div
                className="h-full bg-violet-500 transition-all"
                style={{
                  width: `${bulk.total > 0 ? Math.round((bulk.done / bulk.total) * 100) : 0}%`,
                }}
              />
            </div>
            {bulk.failedSamples.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[11px] text-red-300">
                {bulk.failedSamples.map((s, i) => (
                  <li key={i}>· {s}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mb-10 rounded-lg border border-neutral-800 bg-neutral-950 p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">
          문서 추가
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-400">분류</span>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-500"
            >
              {SOURCE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} ({s.value})
                </option>
              ))}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs text-neutral-400">제목</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 다운독 안전 가이드"
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm placeholder-neutral-600 outline-none focus:border-violet-500"
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs text-neutral-400">
            본문 (최대 8000자)
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="검색에 사용할 본문을 그대로 입력하세요. 한국어 권장."
            rows={8}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm placeholder-neutral-600 outline-none focus:border-violet-500"
          />
          <span className="mt-1 block text-[11px] text-neutral-600">
            {content.length}/8000
          </span>
        </label>
        <div className="mt-3 flex items-center justify-between gap-2">
          {feedback ? (
            <span
              className={
                "text-xs " +
                (feedback.startsWith("✓")
                  ? "text-emerald-300"
                  : "text-red-300")
              }
            >
              {feedback}
            </span>
          ) : (
            <span />
          )}
          <button
            onClick={handleIngest}
            disabled={submitting || !title.trim() || !content.trim()}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
          >
            {submitting ? "임베딩 + 저장 중…" : "저장 + 임베딩"}
          </button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-200">
              저장된 문서 ({docs.length})
            </h2>
            <p className="text-[11px] text-neutral-500">
              제목·본문·분류 검색.
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색…"
            className="w-60 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm placeholder-neutral-600 outline-none focus:border-violet-500"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/60 text-left text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">제목</th>
                <th className="px-4 py-2.5">분류</th>
                <th className="px-4 py-2.5">생성일</th>
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
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                    아직 문서가 없어요. 위에서 첫 문서를 추가하세요.
                  </td>
                </tr>
              ) : null}
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  className="border-t border-neutral-800 transition hover:bg-neutral-900/50"
                >
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-neutral-100">{d.title}</p>
                    <p className="mt-1 max-w-xl truncate text-[11px] text-neutral-500">
                      {d.content}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[11px] text-neutral-300">
                      {d.source_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-neutral-400">
                    {d.created_at.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <button
                      onClick={() => handleDelete(d.id)}
                      disabled={busy === d.id}
                      className="rounded-md border border-red-900/60 px-2.5 py-1 text-[11px] text-red-300 transition hover:bg-red-950/40 disabled:opacity-40"
                    >
                      {busy === d.id ? "삭제 중…" : "삭제"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
