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

const OCR_PAGE_CAP = 30; // 1회 OCR 기본 상한(비용 안전장치)
const OCR_WON_PER_PAGE = 20; // 대략 페이지당 원화(예상 비용 표시용)

// ---- PDF 텍스트 추출 (브라우저, pdfjs-dist) ----
// itemCount: pdfjs 가 인식한 텍스트 항목 수. 0 이면 스캔본/워커 문제,
// itemCount>0 인데 글자수 0 이면 CID 폰트+ToUnicode 누락(한글 PDF에서 흔함) 가능.
async function extractPdf(
  file: File,
  onStage: (msg: string) => void,
): Promise<{ numPages: number; pages: string[]; itemCount: number }> {
  onStage("PDF 엔진 불러오는 중…");
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
  onStage("파일 읽는 중…");
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  let itemCount = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    onStage(`텍스트 추출 중… ${i}/${doc.numPages}쪽`);
    let text = "";
    try {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      itemCount += tc.items.length;
      text = tc.items
        .map((it: any) => ("str" in it ? it.str : ""))
        .join(" ")
        .replace(/[ \t]+/g, " ")
        .trim();
    } catch (e) {
      // 한 페이지 실패는 건너뛰고 계속
      // eslint-disable-next-line no-console
      console.warn(`[pdf] page ${i} getTextContent 실패`, e);
    }
    pages.push(text);
    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  // eslint-disable-next-line no-console
  console.log("[pdf] 추출 진단:", {
    numPages: doc.numPages,
    itemCount,
    chars: pages.reduce((n, p) => n + p.length, 0),
    page1Sample: pages[0]?.slice(0, 120) ?? "",
  });
  return { numPages: doc.numPages, pages, itemCount };
}

// ---- 한 페이지를 이미지(JPEG dataURL)로 렌더링 (OCR 입력용) ----
async function renderPageToImage(
  doc: any,
  pageNum: number,
  maxW = 1500,
): Promise<string> {
  const page = await doc.getPage(pageNum);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(Math.max(maxW / base.width, 0.5), 3);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d 컨텍스트 생성 실패");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.82);
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
  const [itemCount, setItemCount] = useState(0);
  const [pasteText, setPasteText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractMode, setExtractMode] = useState<"summary" | "verbatim">(
    "summary",
  );
  const [inputTab, setInputTab] = useState<"pdf" | "text">("pdf");
  const [ocrFrom, setOcrFrom] = useState(1);
  const [ocrTo, setOcrTo] = useState(1);
  const [ocrProg, setOcrProg] = useState<Progress>(EMPTY_PROGRESS);
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);
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
    setOcrProg(EMPTY_PROGRESS);
    setNotice(null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    resetDrafts();
    setPages(null);
    setNumPages(0);
    setPdfFile(file);
    setExtracting(true);
    setExtractMsg("준비 중…");
    setFileName(file.name);
    if (!bookTitle.trim()) setBookTitle(file.name.replace(/\.pdf$/i, ""));
    try {
      const { numPages, pages, itemCount } = await extractPdf(
        file,
        setExtractMsg,
      );
      setPages(pages);
      setNumPages(numPages);
      setItemCount(itemCount);
      setOcrFrom(1);
      setOcrTo(Math.min(numPages, OCR_PAGE_CAP));
    } catch (e: any) {
      setError(`PDF 추출 실패: ${e?.message ?? String(e)}`);
      setPages(null);
      setNumPages(0);
    } finally {
      setExtracting(false);
      setExtractMsg(null);
    }
  };

  // 텍스트 직접 붙여넣기 → PDF 파싱 없이 동일 파이프라인으로 진행
  const loadPastedText = () => {
    const t = pasteText.trim();
    if (!t) return;
    setError(null);
    resetDrafts();
    setPdfFile(null);
    setFileName("(붙여넣은 텍스트)");
    setPages([t]);
    setNumPages(1);
    setItemCount(t.length);
    if (!bookTitle.trim()) setBookTitle("붙여넣은 텍스트");
  };

  // 이미지 OCR: 지정 페이지 범위를 렌더링 → 비전 요약 → 카드
  const runOcr = async () => {
    if (!pdfFile || ocrProg.running) return;
    const from = Math.max(1, Math.min(ocrFrom, numPages));
    const to = Math.max(from, Math.min(ocrTo, numPages));
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
    setOcrProg({ running: true, done: 0, total: to - from + 1, failed: 0 });

    let doc: any;
    try {
      const pdfjs: any = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
      const buf = await pdfFile.arrayBuffer();
      doc = await pdfjs.getDocument({ data: buf }).promise;
    } catch (e: any) {
      setError(`PDF 열기 실패: ${e?.message ?? String(e)}`);
      setOcrProg((p) => ({ ...p, running: false }));
      return;
    }

    const out: Card[] = [];
    for (let p = from; p <= to; p++) {
      const base: Card = {
        id: `o${p}`,
        chunkIndex: p - 1,
        fromPage: p,
        toPage: p,
        sourceText: "",
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
        const image = await renderPageToImage(doc, p);
        const res = await fetch(`${ctx.baseUrl}/functions/v1/yoga-summarize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ctx.apikey,
            Authorization: `Bearer ${ctx.accessToken}`,
          },
          body: JSON.stringify({
            image,
            book_title: bookTitle.trim() || fileName || undefined,
            mode: extractMode,
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
        const content = (parsed?.content ?? "").toString();
        const drop = !!parsed?.drop;
        out.push({
          ...base,
          title: (parsed?.title ?? "").toString(),
          content,
          safety: !!parsed?.safety,
          drop,
          include: !drop && content.trim().length > 0,
          status: "ok",
        });
        setOcrProg((q) => ({ ...q, done: q.done + 1 }));
      } catch (e: any) {
        out.push({ ...base, status: "failed", error: e?.message ?? String(e) });
        setOcrProg((q) => ({ ...q, done: q.done + 1, failed: q.failed + 1 }));
      }
      setCards([...out]);
    }
    setOcrProg((q) => ({ ...q, running: false }));
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
            mode: extractMode,
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
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-ink">
            AI 지식베이스
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            PDF로 요약 노트 추가
          </h1>
          <p className="mt-1 text-sm text-muted-ink">
            PDF·텍스트에서 AI 노트를 만들어 검토 후 지식베이스에 적재합니다.
          </p>
        </div>
        <Link
          href="/admin/knowledge"
          className="rounded-md border border-hairline px-3 py-1.5 text-xs text-body transition hover:bg-surface-strong"
        >
          ← 지식베이스
        </Link>
      </header>

      <p className="mb-5 text-[11px] text-muted-soft">
        ⚠️ 최종 책임은 등록자에게. 기본 ‘요약’은 재서술 요약만 저장(원문 미저장),
        ‘원문 그대로’는 전사 텍스트가 그대로 저장됩니다.
      </p>

      {error ? (
        <div className="mb-4 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-success/30 bg-success/12 px-3 py-2 text-xs text-success">
          <span>{notice}</span>
          <button
            onClick={() => setNotice(null)}
            className="text-success/70 hover:text-success"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* 공통 옵션: 제목 + 저장 방식 */}
      <section className="mb-4 rounded-lg border border-hairline bg-surface-soft p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block min-w-[220px] flex-1">
            <span className="mb-1 block text-xs text-muted-ink">
              서적/문서 제목 (출처 표기)
            </span>
            <input
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              placeholder="예) 요가 디피카 (직접 정리)"
              className={inputCls}
            />
          </label>
          <div>
            <span className="mb-1 block text-xs text-muted-ink">저장 방식</span>
            <div className="inline-flex overflow-hidden rounded-md border border-hairline">
              {(["summary", "verbatim"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setExtractMode(m)}
                  className={
                    "px-3 py-1.5 text-xs transition " +
                    (extractMode === m
                      ? "bg-coral text-white"
                      : "text-body hover:bg-surface-strong")
                  }
                >
                  {m === "summary" ? "요약 (기본)" : "원문 그대로"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p
          className={
            "mt-2 text-[11px] " +
            (extractMode === "verbatim" ? "text-warning" : "text-muted-soft")
          }
        >
          {extractMode === "verbatim"
            ? "원문(전사) 텍스트를 그대로 저장합니다 — 저작권 책임은 등록자."
            : "AI가 재서술한 요약만 저장합니다 (저작권 안전)."}
        </p>
      </section>

      {/* 1. 입력 — PDF / 텍스트 탭 */}
      <section className="mb-4 rounded-lg border border-hairline bg-canvas p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm font-semibold text-ink">1. 입력</span>
          <div className="inline-flex overflow-hidden rounded-md border border-hairline text-xs">
            {(
              [
                ["pdf", "PDF 업로드"],
                ["text", "텍스트 붙여넣기"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setInputTab(k)}
                className={
                  "px-3 py-1.5 transition " +
                  (inputTab === k
                    ? "bg-coral text-white"
                    : "text-body hover:bg-surface-strong")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {inputTab === "pdf" ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
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
                className="rounded-md border border-coral/40 bg-coral/12 px-3 py-1.5 text-xs text-coral-active transition hover:bg-coral/20 disabled:opacity-40"
              >
                {extracting ? "추출 중…" : "PDF 선택"}
              </button>
              {pages && fileName ? (
                <span className="text-xs text-muted-ink">
                  {fileName} · {numPages}쪽 · {totalChars.toLocaleString()}자
                  {chunks.length ? ` · 텍스트 섹션 ${chunks.length}개` : ""}
                </span>
              ) : (
                <span className="text-xs text-muted-soft">
                  업로드되지 않고 브라우저에서만 처리됩니다.
                </span>
              )}
            </div>

            {extracting ? (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-coral/30 bg-coral/[0.08] px-3 py-2 text-xs text-coral-active">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-coral border-t-transparent" />
                <span>{extractMsg ?? "처리 중…"}</span>
                <span className="text-coral-active/70">· 창을 닫지 마세요.</span>
              </div>
            ) : null}

            {pages && !extracting && chunks.length === 0 ? (
              <p className="mt-3 rounded-md border border-warning/30 bg-warning/[0.12] px-3 py-2 text-[11px] leading-relaxed text-warning">
                추출된 텍스트가 없어요 (텍스트 항목 {itemCount}개). 스캔·한글
                PDF예요 — 아래 <span className="font-medium">2. 초안 만들기 › 이미지
                OCR</span>를 쓰거나 ‘텍스트 붙여넣기’ 탭을 이용하세요.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="본문 텍스트를 붙여넣으세요… (스캔·한글 PDF에서 복사한 내용 등)"
              rows={6}
              className={inputCls}
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={loadPastedText}
                disabled={extracting || !pasteText.trim()}
                className="rounded-md border border-coral/40 bg-coral/12 px-3 py-1.5 text-xs text-coral-active transition hover:bg-coral/20 disabled:opacity-40"
              >
                이 텍스트로 진행
              </button>
              <span className="text-[11px] text-muted-soft">
                {pasteText.trim().length.toLocaleString()}자
              </span>
            </div>
          </>
        )}
      </section>

      {/* 2. 초안 만들기 (관련 생성기만 표시) */}
      {(chunks.length > 0 || (pdfFile && inputTab === "pdf" && !extracting)) ? (
        <section className="mb-4 space-y-3 rounded-lg border border-hairline bg-canvas p-5">
          <h2 className="text-sm font-semibold text-ink">2. 초안 만들기</h2>

          {/* 텍스트 기반 */}
          {chunks.length > 0 ? (
            <div className="rounded-md border border-hairline bg-surface-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-body">
                    텍스트로 {extractMode === "verbatim" ? "정리" : "요약"} 초안 생성
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-ink">
                    {chunks.length}개 섹션 · 한 건당 약 1~3초
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-[11px] text-muted-ink">
                    섹션 크기
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
                            Math.max(
                              1500,
                              parseInt(e.target.value || "0", 10) || DEFAULT_CHUNK,
                            ),
                          ),
                        )
                      }
                      className={`${inputCls} ml-1 inline-block w-20`}
                    />
                  </label>
                  <button
                    onClick={generateDrafts}
                    disabled={draftProg.running}
                    className="rounded-md bg-coral px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-coral-active disabled:opacity-40"
                  >
                    {draftProg.running
                      ? `생성 중 ${draftProg.done}/${draftProg.total}`
                      : cards.length
                        ? "다시 생성"
                        : "초안 생성"}
                  </button>
                </div>
              </div>
              {draftProg.running || draftProg.done > 0 ? (
                <ProgressBar prog={draftProg} />
              ) : null}
            </div>
          ) : null}

          {/* 이미지 OCR */}
          {pdfFile && inputTab === "pdf" ? (
            <div className="rounded-md border border-hairline bg-surface-soft p-4">
              <p className="text-xs font-medium text-body">
                이미지 OCR로 추출{" "}
                <span className="font-normal text-muted-ink">
                  (스캔·한글 PDF)
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-ink">
                페이지를 이미지로 만들어 AI(GPT-4o)가 읽습니다 · 페이지당 약{" "}
                {OCR_WON_PER_PAGE}원
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={numPages}
                  value={ocrFrom}
                  onChange={(e) =>
                    setOcrFrom(
                      Math.max(1, Math.min(numPages, parseInt(e.target.value || "1", 10) || 1)),
                    )
                  }
                  className={`${inputCls} w-20`}
                />
                <span className="text-[11px] text-muted-ink">~</span>
                <input
                  type="number"
                  min={1}
                  max={numPages}
                  value={ocrTo}
                  onChange={(e) =>
                    setOcrTo(
                      Math.max(1, Math.min(numPages, parseInt(e.target.value || "1", 10) || 1)),
                    )
                  }
                  className={`${inputCls} w-20`}
                />
                <span className="text-[11px] text-muted-ink">/ {numPages}쪽</span>
                {(() => {
                  const n = Math.max(0, Math.min(ocrTo, numPages) - Math.max(1, ocrFrom) + 1);
                  const over = n > OCR_PAGE_CAP;
                  return (
                    <span
                      className={
                        "text-[11px] " + (over ? "text-warning" : "text-muted-soft")
                      }
                    >
                      {n}쪽 · 약 {(n * OCR_WON_PER_PAGE).toLocaleString()}원
                      {over ? ` · ${OCR_PAGE_CAP}쪽 이하 권장` : ""}
                    </span>
                  );
                })()}
                <button
                  onClick={runOcr}
                  disabled={ocrProg.running}
                  className="ml-auto rounded-md bg-coral px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-coral-active disabled:opacity-40"
                >
                  {ocrProg.running
                    ? `OCR 중 ${ocrProg.done}/${ocrProg.total}`
                    : "OCR 시작"}
                </button>
              </div>
              {ocrProg.running || ocrProg.done > 0 ? (
                <ProgressBar prog={ocrProg} />
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 3. 검토 + 저장 */}
      {cards.length > 0 ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                3. 검토 후 저장
              </h2>
              <p className="text-[11px] text-muted-ink">
                포함 {includedCount}개 선택됨 · 제목/본문 수정 가능 ·{" "}
                {extractMode === "verbatim"
                  ? "원문(전사)이 저장됩니다"
                  : "요약본만 저장됩니다"}
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
                extractMode !== "verbatim" &&
                c.status === "ok" &&
                c.content.trim().length > 0 &&
                hasVerbatimOverlap(c.sourceText, c.content);
              return (
                <div
                  key={c.id}
                  className={
                    "rounded-lg border bg-canvas p-4 " +
                    (c.status === "failed"
                      ? "border-error/30"
                      : c.include
                        ? "border-coral/40"
                        : "border-hairline")
                  }
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded border border-hairline bg-surface-card px-2 py-0.5 text-muted-ink">
                      섹션 {c.chunkIndex + 1} · p.{c.fromPage}
                      {c.toPage !== c.fromPage ? `–${c.toPage}` : ""}
                    </span>
                    {c.drop ? (
                      <span className="rounded border border-hairline bg-surface-card px-2 py-0.5 text-muted-ink">
                        가치 낮음(drop)
                      </span>
                    ) : null}
                    {c.safety ? (
                      <span className="rounded border border-warning/40 bg-warning/[0.12] px-2 py-0.5 text-warning">
                        안전 민감
                      </span>
                    ) : null}
                    {overlap ? (
                      <span className="rounded border border-error/40 bg-error/10 px-2 py-0.5 text-error">
                        ⚠ 원문 근접 — 다시 쓰세요
                      </span>
                    ) : null}
                    {c.status === "failed" ? (
                      <span className="rounded border border-error/40 bg-error/10 px-2 py-0.5 text-error">
                        생성 실패: {c.error}
                      </span>
                    ) : null}
                    <label className="ml-auto flex items-center gap-1.5 text-body">
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

                  {c.sourceText ? (
                    <div className="mt-2">
                      <button
                        onClick={() =>
                          patchCard(c.id, { showSource: !c.showSource })
                        }
                        className="text-[11px] text-muted-ink underline-offset-2 hover:text-body hover:underline"
                      >
                        {c.showSource
                          ? "원문 숨기기"
                          : "원문 보기(참고용, 저장 안 됨)"}
                      </button>
                      {c.showSource ? (
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-hairline bg-surface-soft p-2 text-[11px] text-muted-ink">
                          {c.sourceText}
                        </pre>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-muted-soft">
                      이미지 OCR 결과 (원문 텍스트 비교 없음)
                    </p>
                  )}
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
  "w-full rounded-md border border-hairline bg-canvas px-2.5 py-1.5 text-sm text-ink placeholder-muted-soft outline-none focus:border-coral";

function ProgressBar({ prog }: { prog: Progress }) {
  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-[11px] text-muted-soft">
        <span>
          완료 {prog.done}/{prog.total}
          {prog.failed ? ` · 실패 ${prog.failed}` : ""}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
        <div
          className="h-full bg-coral transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
