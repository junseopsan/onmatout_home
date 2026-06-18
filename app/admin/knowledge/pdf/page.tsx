"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";

// 지식베이스 분류 (knowledge 페이지와 동일 + "book")
const SOURCE_TYPES = [
  { value: "book", label: "서적" },
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

const DEFAULT_CHUNK = 4500; // 섹션 1개 목표 글자수
const HARD_MAX = 9000; // 한 섹션 강제 분할 상한
const OVERLAP_NGRAM = 12; // 연속 N단어 일치 시 "원문 근접" 경고

type Chunk = {
  index: number;
  fromPage: number;
  toPage: number;
  text: string;
};

type Card = {
  id: string;
  chunkIndex: number;
  fromPage: number;
  toPage: number;
  sourceText: string; // 참고용 — 저장하지 않음
  title: string;
  content: string;
  sourceType: string;
  include: boolean;
  safety: boolean;
  drop: boolean;
  showSource: boolean;
  status: "ok" | "failed" | "pending";
  error?: string;
};

type Progress = {
  running: boolean;
  done: number;
  total: number;
  failed: number;
};

const EMPTY_PROGRESS: Progress = {
  running: false,
  done: 0,
  total: 0,
  failed: 0,
};

// ---- PDF 텍스트 추출 (브라우저, pdfjs-dist) ----
async function extractPdf(
  file: File,
): Promise<{ numPages: number; pages: string[] }> {
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const text = tc.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/[ \t]+/g, " ")
      .trim();
    pages.push(text);
  }
  return { numPages: doc.numPages, pages };
}

// ---- 페이지 텍스트를 섹션으로 청킹 (페이지 범위 추적) ----
function chunkPages(pages: string[], target: number): Chunk[] {
  const chunks: Chunk[] = [];
  let buf = "";
  let fromPage = 1;
  const flush = (toPage: number) => {
    const text = buf.trim();
    if (text.length > 0) {
      chunks.push({ index: chunks.length, fromPage, toPage, text });
    }
    buf = "";
  };

  for (let p = 0; p < pages.length; p++) {
    const pageNo = p + 1;
    let pageText = pages[p] ?? "";
    if (!pageText) continue;

    // 한 페이지가 너무 길면 그 페이지를 강제 분할
    while (pageText.length > HARD_MAX) {
      if (buf) flush(pageNo);
      fromPage = pageNo;
      const cut = pageText.lastIndexOf(" ", HARD_MAX);
      const at = cut > HARD_MAX * 0.5 ? cut : HARD_MAX;
      buf = pageText.slice(0, at);
      pageText = pageText.slice(at);
      flush(pageNo);
    }

    if (buf === "") fromPage = pageNo;
    buf += (buf ? "\n" : "") + pageText;

    if (buf.length >= target) flush(pageNo);
  }
  flush(pages.length);
  return chunks;
}

// ---- 원문 복사(verbatim) 경고: 연속 N단어 이상 그대로 일치하는지 ----
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}
function hasVerbatimOverlap(source: string, draft: string, n = OVERLAP_NGRAM) {
  const src = tokenize(source);
  const dft = tokenize(draft);
  if (src.length < n || dft.length < n) return false;
  const draftGrams = new Set<string>();
  for (let i = 0; i + n <= dft.length; i++) {
    draftGrams.add(dft.slice(i, i + n).join(" "));
  }
  for (let i = 0; i + n <= src.length; i++) {
    if (draftGrams.has(src.slice(i, i + n).join(" "))) return true;
  }
  return false;
}

async function authCtx() {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!accessToken) throw new Error("세션이 없습니다. 다시 로그인해주세요.");
  if (!baseUrl || !apikey) throw new Error("env 미설정");
  return { accessToken, baseUrl, apikey };
}

export default function AdminKnowledgePdfPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK);
  const [pages, setPages] = useState<string[] | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cards, setCards] = useState<Card[]>([]);
  const [draftProg, setDraftProg] = useState<Progress>(EMPTY_PROGRESS);
  const [saveProg, setSaveProg] = useState<Progress>(EMPTY_PROGRESS);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalChars = useMemo(
    () => (pages ? pages.reduce((n, p) => n + p.length, 0) : 0),
    [pages],
  );
  const chunks = useMemo(
    () => (pages ? chunkPages(pages, chunkSize) : []),
    [pages, chunkSize],
  );

  const resetDrafts = () => {
    setCards([]);
    setDraftProg(EMPTY_PROGRESS);
    setSaveProg(EMPTY_PROGRESS);
    setNotice(null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    resetDrafts();
    setExtracting(true);
    setFileName(file.name);
    if (!bookTitle.trim()) setBookTitle(file.name.replace(/\.pdf$/i, ""));
    try {
      const { numPages, pages } = await extractPdf(file);
      setPages(pages);
      setNumPages(numPages);
    } catch (e: any) {
      setError(`PDF 추출 실패: ${e?.message ?? String(e)}`);
      setPages(null);
      setNumPages(0);
    } finally {
      setExtracting(false);
    }
  };

  const generateDrafts = async () => {
    if (!chunks.length || draftProg.running) return;
    setNotice(null);
    setError(null);
    let ctx: Awaited<ReturnType<typeof authCtx>>;
    try {
      ctx = await authCtx();
    } catch (e: any) {
      setError(e?.message ?? String(e));
      return;
    }
    setCards([]);
    setDraftProg({ running: true, done: 0, total: chunks.length, failed: 0 });

    const out: Card[] = [];
    for (const ch of chunks) {
      const base: Card = {
        id: `c${ch.index}`,
        chunkIndex: ch.index,
        fromPage: ch.fromPage,
        toPage: ch.toPage,
        sourceText: ch.text,
        title: "",
        content: "",
        sourceType: "book",
        include: false,
        safety: false,
        drop: false,
        showSource: false,
        status: "pending",
      };
      try {
        const res = await fetch(`${ctx.baseUrl}/functions/v1/yoga-summarize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ctx.apikey,
            Authorization: `Bearer ${ctx.accessToken}`,
          },
          body: JSON.stringify({
            text: ch.text,
            book_title: bookTitle.trim() || fileName || undefined,
          }),
        });
        const bodyText = await res.text();
        let parsed: any = null;
        try {
          parsed = JSON.parse(bodyText);
        } catch {
          /* ignore */
        }
        if (!res.ok) {
          throw new Error(parsed?.error ?? bodyText ?? `HTTP ${res.status}`);
        }
        const title = (parsed?.title ?? "").toString();
        const content = (parsed?.content ?? "").toString();
        const drop = !!parsed?.drop;
        out.push({
          ...base,
          title,
          content,
          safety: !!parsed?.safety,
          drop,
          include: !drop && content.trim().length > 0,
          status: "ok",
        });
        setDraftProg((p) => ({ ...p, done: p.done + 1 }));
      } catch (e: any) {
        out.push({
          ...base,
          status: "failed",
          error: e?.message ?? String(e),
        });
        setDraftProg((p) => ({
          ...p,
          done: p.done + 1,
          failed: p.failed + 1,
        }));
      }
      setCards([...out]);
    }
    setDraftProg((p) => ({ ...p, running: false }));
  };

  const patchCard = (id: string, patch: Partial<Card>) =>
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const includedCount = cards.filter((c) => c.include).length;

  const saveIncluded = async () => {
    const toSave = cards.filter((c) => c.include && c.content.trim());
    if (!toSave.length || saveProg.running) return;
    setNotice(null);
    setError(null);
    let ctx: Awaited<ReturnType<typeof authCtx>>;
    try {
      ctx = await authCtx();
    } catch (e: any) {
      setError(e?.message ?? String(e));
      return;
    }
    setSaveProg({ running: true, done: 0, total: toSave.length, failed: 0 });
    let ok = 0;
    const failed: string[] = [];
    for (const c of toSave) {
      try {
        // 원문(sourceText)은 전송하지 않는다 — 요약본만 적재.
        const res = await fetch(`${ctx.baseUrl}/functions/v1/yoga-ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ctx.apikey,
            Authorization: `Bearer ${ctx.accessToken}`,
          },
          body: JSON.stringify({
            source_type: c.sourceType,
            title: c.title.trim() || `${bookTitle} (p.${c.fromPage})`,
            content: c.content.trim(),
            metadata: {
              origin: "pdf",
              book_title: bookTitle.trim() || fileName,
              section_index: c.chunkIndex,
              page_range: [c.fromPage, c.toPage],
            },
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t.slice(0, 120));
        }
        ok++;
        setSaveProg((p) => ({ ...p, done: p.done + 1 }));
        // 저장된 카드는 목록에서 표시 갱신
        patchCard(c.id, { include: false, status: "ok" });
      } catch (e: any) {
        failed.push(`${c.title || c.id}: ${e?.message ?? "error"}`);
        setSaveProg((p) => ({ ...p, done: p.done + 1, failed: p.failed + 1 }));
      }
    }
    setSaveProg((p) => ({ ...p, running: false }));
    setNotice(
      `저장 완료 — 성공 ${ok}${failed.length ? ` · 실패 ${failed.length} (${failed[0]})` : ""}. 요약본만 지식베이스에 적재되었습니다.`,
    );
  };

  return (
    <AdminShell>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
            AI 지식베이스
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            PDF로 요약 노트 추가
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">
            PDF는 브라우저에서만 텍스트를 추출하며 서버에 저장하지 않습니다. AI가
            한국어 요약 노트 초안을 만들면 검토·수정 후 선택한 것만 지식베이스에
            적재됩니다. <span className="text-neutral-300">원문이 아닌 요약본만</span>{" "}
            저장됩니다.
          </p>
        </div>
        <Link
          href="/admin/knowledge"
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-800"
        >
          ← 지식베이스
        </Link>
      </header>

      <div className="mb-6 rounded-md border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300/90">
        ⚠️ 저작권 주의: 타인 저작물의 전문을 그대로 적재하지 마세요. 이 도구는
        원문을 저장하지 않고 재서술 요약만 적재하지만, 최종 책임은 등록자에게
        있습니다. 저장 전 각 노트를 검토하고 “원문 근접” 경고가 뜬 항목은 직접
        고쳐 쓰세요.
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-md border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
          <span>{notice}</span>
          <button
            onClick={() => setNotice(null)}
            className="text-emerald-400/70 hover:text-emerald-200"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* 1. 업로드 */}
      <section className="mb-6 rounded-lg border border-neutral-800 bg-neutral-950 p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">
          1. PDF 업로드
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs text-neutral-400">
              서적/문서 제목 (출처 표기용)
            </span>
            <input
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              placeholder="예) 요가 디피카 (직접 정리)"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-400">
              섹션 크기 (글자)
            </span>
            <input
              type="number"
              min={1500}
              max={HARD_MAX}
              step={500}
              value={chunkSize}
              onChange={(e) =>
                setChunkSize(
                  Math.min(
                    HARD_MAX,
                    Math.max(1500, parseInt(e.target.value || "0", 10) || DEFAULT_CHUNK),
                  ),
                )
              }
              className={inputCls}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={extracting}
            className="rounded-md border border-violet-700/60 bg-violet-600/20 px-3 py-1.5 text-xs text-violet-200 transition hover:bg-violet-600/30 disabled:opacity-40"
          >
            {extracting ? "추출 중…" : "PDF 선택"}
          </button>
          {fileName ? (
            <span className="text-xs text-neutral-400">
              {fileName}
              {pages
                ? ` · ${numPages}쪽 · ${totalChars.toLocaleString()}자 · 섹션 ${chunks.length}개`
                : ""}
            </span>
          ) : (
            <span className="text-xs text-neutral-600">
              선택한 PDF는 업로드되지 않고 브라우저에서만 처리됩니다.
            </span>
          )}
        </div>
      </section>

      {/* 2. 초안 생성 */}
      {pages && chunks.length > 0 ? (
        <section className="mb-6 rounded-lg border border-neutral-800 bg-neutral-950 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-200">
                2. AI 요약 초안 생성
              </h2>
              <p className="mt-1 text-[11px] text-neutral-400">
                섹션 {chunks.length}개 · 한 건당 약 1~3초. 생성 후 검토하세요.
              </p>
            </div>
            <button
              onClick={generateDrafts}
              disabled={draftProg.running}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
            >
              {draftProg.running
                ? `생성 중 ${draftProg.done}/${draftProg.total}`
                : cards.length
                  ? "다시 생성"
                  : "초안 생성 시작"}
            </button>
          </div>
          {draftProg.running || draftProg.done > 0 ? (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px] text-neutral-500">
                <span>
                  완료 {draftProg.done}/{draftProg.total}
                  {draftProg.failed ? ` · 실패 ${draftProg.failed}` : ""}
                </span>
                <span>
                  {draftProg.total
                    ? Math.round((draftProg.done / draftProg.total) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-900">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{
                    width: `${draftProg.total ? Math.round((draftProg.done / draftProg.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 3. 검토 + 저장 */}
      {cards.length > 0 ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-200">
                3. 검토 후 저장
              </h2>
              <p className="text-[11px] text-neutral-500">
                포함 {includedCount}개 선택됨 · 제목/본문 수정 가능 · 원문은
                저장되지 않음
              </p>
            </div>
            <button
              onClick={saveIncluded}
              disabled={saveProg.running || includedCount === 0}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
            >
              {saveProg.running
                ? `저장 중 ${saveProg.done}/${saveProg.total}`
                : `선택 ${includedCount}개 저장`}
            </button>
          </div>

          <div className="space-y-3">
            {cards.map((c) => {
              const overlap =
                c.status === "ok" &&
                c.content.trim().length > 0 &&
                hasVerbatimOverlap(c.sourceText, c.content);
              return (
                <div
                  key={c.id}
                  className={
                    "rounded-lg border bg-neutral-950 p-4 " +
                    (c.status === "failed"
                      ? "border-red-900/50"
                      : c.include
                        ? "border-violet-800/50"
                        : "border-neutral-800")
                  }
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-neutral-400">
                      섹션 {c.chunkIndex + 1} · p.{c.fromPage}
                      {c.toPage !== c.fromPage ? `–${c.toPage}` : ""}
                    </span>
                    {c.drop ? (
                      <span className="rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-neutral-500">
                        가치 낮음(drop)
                      </span>
                    ) : null}
                    {c.safety ? (
                      <span className="rounded border border-amber-900/60 bg-amber-950/30 px-2 py-0.5 text-amber-300">
                        안전 민감
                      </span>
                    ) : null}
                    {overlap ? (
                      <span className="rounded border border-red-900/60 bg-red-950/40 px-2 py-0.5 text-red-300">
                        ⚠ 원문 근접 — 다시 쓰세요
                      </span>
                    ) : null}
                    {c.status === "failed" ? (
                      <span className="rounded border border-red-900/60 bg-red-950/40 px-2 py-0.5 text-red-300">
                        생성 실패: {c.error}
                      </span>
                    ) : null}
                    <label className="ml-auto flex items-center gap-1.5 text-neutral-300">
                      <input
                        type="checkbox"
                        checked={c.include}
                        disabled={c.status !== "ok"}
                        onChange={(e) =>
                          patchCard(c.id, { include: e.target.checked })
                        }
                      />
                      포함
                    </label>
                  </div>

                  {c.status === "ok" ? (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                      <input
                        value={c.title}
                        onChange={(e) => patchCard(c.id, { title: e.target.value })}
                        placeholder="제목"
                        className={inputCls}
                      />
                      <select
                        value={c.sourceType}
                        onChange={(e) =>
                          patchCard(c.id, { sourceType: e.target.value })
                        }
                        className={inputCls}
                      >
                        {SOURCE_TYPES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label} ({s.value})
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={c.content}
                        onChange={(e) =>
                          patchCard(c.id, { content: e.target.value })
                        }
                        rows={5}
                        className={`${inputCls} md:col-span-2`}
                      />
                    </div>
                  ) : null}

                  <div className="mt-2">
                    <button
                      onClick={() =>
                        patchCard(c.id, { showSource: !c.showSource })
                      }
                      className="text-[11px] text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline"
                    >
                      {c.showSource ? "원문 숨기기" : "원문 보기(참고용, 저장 안 됨)"}
                    </button>
                    {c.showSource ? (
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-neutral-800 bg-neutral-900/40 p-2 text-[11px] text-neutral-400">
                        {c.sourceText}
                      </pre>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}

const inputCls =
  "w-full rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-violet-500";
