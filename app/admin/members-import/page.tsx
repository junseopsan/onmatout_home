"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminAuth } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

type Teacher = { user_id: string; name: string | null; phone: string | null };

type ParsedRow = {
  name: string;
  phone: string; // 정규화된 숫자만
  memo: string;
  error?: string; // 행 단위 검증 메시지
  dup?: boolean; // 파일 내 전화번호 중복
};

type CreatedRow = {
  id: string;
  name: string;
  phone: string | null;
  invite_code: string;
};

type Result = {
  created_count: number;
  skipped_count: number;
  created: CreatedRow[];
};

const HEADER_RE = /이름|name|전화|phone|메모|memo/i;

function normalizePhone(raw: string) {
  return raw.replace(/[^0-9]/g, "");
}

function parseText(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  const rows: ParsedRow[] = lines.map((line) => {
    const delim = line.includes("\t") ? "\t" : ",";
    const cols = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
    return {
      name: cols[0] ?? "",
      phone: normalizePhone(cols[1] ?? ""),
      memo: cols[2] ?? "",
    };
  });

  // 첫 행이 헤더처럼 보이면 제거
  if (rows.length && HEADER_RE.test(rows[0].name) && HEADER_RE.test(`${rows[0].name}${rows[0].phone}${rows[0].memo}`)) {
    rows.shift();
  }

  // 검증 + 파일 내 전화 중복 표시
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.name.trim()) {
      r.error = "이름 없음";
      continue;
    }
    if (r.phone && (r.phone.length < 9 || r.phone.length > 11)) {
      r.error = "전화번호 형식 확인";
    }
    if (r.phone) {
      if (seen.has(r.phone)) r.dup = true;
      else seen.add(r.phone);
    }
  }
  return rows;
}

function toCsv(rows: CreatedRow[]) {
  const head = "name,phone,invite_code";
  const body = rows
    .map(
      (r) =>
        `"${(r.name ?? "").replace(/"/g, '""')}",${r.phone ?? ""},${r.invite_code}`,
    )
    .join("\n");
  return `${head}\n${body}`;
}

export default function AdminMembersImportPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [withConsent, setWithConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadTeachers = async () => {
    setError(null);
    setLoadingTeachers(true);
    try {
      // 역할에 따라 지도자 목록 소스 분기
      //  - super_admin: 전체 지도자(user_roles)
      //  - studio_owner: 본인 요가원 지도자(studio_teachers, RLS 스코프) + 본인
      const ctx = await adminAuth.getBoContext();
      let ids: string[] = [];

      if (ctx?.role === "studio_owner") {
        const { data: sts, error: stErr } = await supabase
          .from("studio_teachers")
          .select("teacher_id");
        if (stErr) throw stErr;
        const set = new Set(
          (sts ?? []).map((r: any) => r.teacher_id as string),
        );
        if (ctx.session.user.id) set.add(ctx.session.user.id); // 본인이 지도자인 경우
        ids = Array.from(set);
      } else {
        const { data: roles, error: rErr } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "teacher");
        if (rErr) throw rErr;
        ids = Array.from(
          new Set((roles ?? []).map((r: any) => r.user_id as string)),
        );
      }

      if (ids.length === 0) {
        setTeachers([]);
        return;
      }
      const { data: infos, error: iErr } = await supabase.rpc(
        "admin_get_users_info",
        { p_user_ids: ids },
      );
      if (iErr) throw iErr;
      const list = ((infos ?? []) as Teacher[]).sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? ""),
      );
      setTeachers(list);
    } catch (e: any) {
      setError(
        e?.message ??
          "지도자 목록을 불러오지 못했어요. (admin_users.sql 적용 여부 확인)",
      );
    } finally {
      setLoadingTeachers(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  const filteredTeachers = useMemo(() => {
    const q = teacherQuery.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        (t.name ?? "").toLowerCase().includes(q) ||
        (t.phone ?? "").includes(q),
    );
  }, [teachers, teacherQuery]);

  const parsed = useMemo(() => parseText(text), [text]);
  const validRows = parsed.filter((r) => r.name.trim() && !r.error);
  const invalidCount = parsed.length - validRows.length;

  const selectedTeacher = teachers.find((t) => t.user_id === teacherId);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!teacherId) {
      alert("회원을 등록할 지도자를 선택하세요.");
      return;
    }
    if (validRows.length === 0) {
      alert("등록할 유효한 행이 없어요.");
      return;
    }
    if (
      !confirm(
        `${selectedTeacher?.name ?? "선택한 지도자"} 님에게 회원 ${validRows.length}명을 등록할까요?`,
      )
    )
      return;

    setSubmitting(true);
    setResult(null);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc(
        "admin_bulk_create_students",
        {
          p_teacher_id: teacherId,
          p_rows: validRows.map((r) => ({
            name: r.name.trim(),
            phone: r.phone || null,
            memo: r.memo.trim() || null,
          })),
          p_with_consent: withConsent,
        },
      );
      if (err) throw err;
      setResult(data as Result);
    } catch (e: any) {
      setError(e?.message ?? "등록에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCodes = () => {
    if (!result?.created?.length) return;
    const csv = toCsv(result.created);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invite_codes_${teacherId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setText("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <AdminShell>
      <header className="mb-8">
        <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-ink">
          사용자
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">회원 일괄 등록</h1>
        <p className="mt-1 text-sm text-muted-ink">
          지도자를 선택하고 회원 명단(엑셀/CSV)을 붙여넣어 회원 카드를 한 번에 만들어요.
          각 회원에게 고유 초대코드가 자동 발급됩니다.
        </p>
      </header>

      {error ? (
        <div className="mb-6 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          {error}
        </div>
      ) : null}

      {/* 1. 지도자 선택 */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-ink">
          1. 지도자 선택
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={teacherQuery}
            onChange={(e) => setTeacherQuery(e.target.value)}
            placeholder="지도자 이름·전화 검색…"
            className="w-56 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm placeholder-muted-soft outline-none focus:border-coral"
          />
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="min-w-[16rem] rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm outline-none focus:border-coral"
          >
            <option value="">
              {loadingTeachers
                ? "불러오는 중…"
                : `지도자 선택 (${filteredTeachers.length}명)`}
            </option>
            {filteredTeachers.map((t) => (
              <option key={t.user_id} value={t.user_id}>
                {(t.name ?? "이름없음") + (t.phone ? ` · ${t.phone}` : "")}
              </option>
            ))}
          </select>
          {selectedTeacher ? (
            <span className="text-[11px] text-success">
              선택됨: {selectedTeacher.name ?? selectedTeacher.user_id.slice(0, 8)}
            </span>
          ) : null}
        </div>
      </section>

      {/* 2. 명단 입력 */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-ink">
          2. 회원 명단 입력
        </h2>
        <p className="mb-2 text-[11px] text-muted-ink">
          형식: <code className="text-body">이름, 전화(선택), 메모(선택)</code> ·
          한 줄에 한 명. 엑셀에서 복사해 붙여넣으면 탭 구분도 인식합니다. 첫 줄이 머리글이면
          자동 제외됩니다.
        </p>
        <div className="mb-2 flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="text-xs text-muted-ink file:mr-3 file:rounded-md file:border file:border-hairline file:bg-surface-card file:px-3 file:py-1 file:text-xs file:text-ink"
          />
          <button
            onClick={() => setText("이름,전화,메모\n홍길동,01012345678,신규\n김요가,,VIP")}
            className="rounded-md border border-hairline px-2.5 py-1 text-[11px] text-muted-ink transition hover:bg-surface-strong"
          >
            예시 채우기
          </button>
          {text ? (
            <button
              onClick={reset}
              className="rounded-md border border-hairline px-2.5 py-1 text-[11px] text-muted-ink transition hover:bg-surface-strong"
            >
              비우기
            </button>
          ) : null}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"홍길동,01012345678,신규 회원\n김요가,,VIP"}
          rows={8}
          className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 font-mono text-xs placeholder-muted-soft outline-none focus:border-coral"
        />
      </section>

      {/* 3. 미리보기 */}
      {parsed.length > 0 ? (
        <section className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">
              3. 미리보기
              <span className="ml-2 text-[11px] font-normal text-muted-ink">
                유효 {validRows.length} · 제외 {invalidCount}
              </span>
            </h2>
          </div>
          <div className="overflow-hidden rounded-lg border border-hairline">
            <table className="w-full text-sm">
              <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-wider text-muted-ink">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">이름</th>
                  <th className="px-4 py-2">전화</th>
                  <th className="px-4 py-2">메모</th>
                  <th className="px-4 py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-t border-hairline">
                    <td className="px-4 py-2 text-muted-ink">{i + 1}</td>
                    <td className="px-4 py-2 text-ink">{r.name || "—"}</td>
                    <td className="px-4 py-2 text-body">{r.phone || "—"}</td>
                    <td className="px-4 py-2 text-muted-ink">{r.memo || "—"}</td>
                    <td className="px-4 py-2">
                      {r.error ? (
                        <span className="text-[11px] text-error">{r.error} · 제외</span>
                      ) : r.dup ? (
                        <span className="text-[11px] text-warning">파일 내 전화 중복</span>
                      ) : (
                        <span className="text-[11px] text-success">등록 대상</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 100 ? (
              <p className="border-t border-hairline px-4 py-2 text-[11px] text-muted-ink">
                미리보기는 100행까지만 표시합니다. (전체 {parsed.length}행 등록됩니다)
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 4. 동의 + 실행 */}
      <section className="mb-8">
        <label className="mb-3 flex items-start gap-2 text-xs text-body">
          <input
            type="checkbox"
            checked={withConsent}
            onChange={(e) => setWithConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            전화번호 수집·이용에 대한 <b>동의를 확보</b>했습니다. (체크 시 전화번호가 있는
            회원에 한해 동의 시각이 기록됩니다. 미체크 시 전화번호는 저장되지만 동의 시각은
            남지 않습니다.)
          </span>
        </label>
        <button
          onClick={handleSubmit}
          disabled={submitting || !teacherId || validRows.length === 0}
          className="rounded-md border border-coral/40 bg-coral/12 px-4 py-2 text-sm text-coral-active transition hover:bg-coral/20 disabled:opacity-40"
        >
          {submitting
            ? "등록 중…"
            : `회원 ${validRows.length}명 등록`}
        </button>
      </section>

      {/* 5. 결과 */}
      {result ? (
        <section className="rounded-lg border border-success/30 bg-success/12 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-success">
              등록 완료 — 생성 {result.created_count} · 건너뜀 {result.skipped_count}
            </h2>
            {result.created.length > 0 ? (
              <button
                onClick={downloadCodes}
                className="rounded-md border border-success/30 px-3 py-1 text-[11px] text-success transition hover:bg-success/12"
              >
                초대코드 CSV 다운로드
              </button>
            ) : null}
          </div>
          {result.skipped_count > 0 ? (
            <p className="mb-3 text-[11px] text-muted-ink">
              건너뜀: 이름 누락 또는 동일 지도자에 같은 전화번호가 이미 존재하는 회원.
            </p>
          ) : null}
          {result.created.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-hairline">
              <table className="w-full text-sm">
                <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-wider text-muted-ink">
                  <tr>
                    <th className="px-4 py-2">이름</th>
                    <th className="px-4 py-2">전화</th>
                    <th className="px-4 py-2">초대코드</th>
                  </tr>
                </thead>
                <tbody>
                  {result.created.map((c) => (
                    <tr key={c.id} className="border-t border-hairline">
                      <td className="px-4 py-2 text-ink">{c.name}</td>
                      <td className="px-4 py-2 text-body">{c.phone ?? "—"}</td>
                      <td className="px-4 py-2 font-mono text-coral-active">
                        {c.invite_code}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </AdminShell>
  );
}
