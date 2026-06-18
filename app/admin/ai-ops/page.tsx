"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/lib/supabase";

type AiLog = {
  id: string;
  user_id: string;
  thread_id: string | null;
  question: string;
  answer: string;
  related_asana_ids: string[] | null;
  related_routine_ids: string[] | null;
  retrieved_document_ids: string[] | null;
  safety_notice_required: boolean | null;
  should_recommend_teacher: boolean | null;
  created_at: string;
};

type AppVersion = {
  platform: string;
  min_version: string;
  store_url: string;
};

type PeriodDays = 7 | 30 | 90;
const PERIODS: { value: PeriodDays; label: string }[] = [
  { value: 7, label: "최근 7일" },
  { value: 30, label: "최근 30일" },
  { value: 90, label: "최근 90일" },
];

type LogFilter = "all" | "safety" | "recommend" | "no_source";
const LOG_FILTERS: { value: LogFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "safety", label: "안전문구 필요" },
  { value: "recommend", label: "지도자 추천" },
  { value: "no_source", label: "출처 없음" },
];

function len(a: string[] | null | undefined) {
  return Array.isArray(a) ? a.length : 0;
}

export default function AdminAiOpsPage() {
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async (days: PeriodDays) => {
    setError(null);
    setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - days);
      const [{ data: logData, error: logErr }, { data: verData, error: verErr }] =
        await Promise.all([
          supabase
            .from("ai_answer_logs")
            .select("*")
            .gte("created_at", from.toISOString())
            .order("created_at", { ascending: false })
            .limit(2000),
          supabase.from("app_versions").select("*"),
        ]);
      if (logErr) throw logErr;
      if (verErr) throw verErr;
      setLogs((logData ?? []) as AiLog[]);
      setVersions(((verData ?? []) as AppVersion[]).slice().sort((a, b) =>
        a.platform.localeCompare(b.platform),
      ));
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
    load(period);
  }, [period]);

  const stats = useMemo(() => {
    const total = logs.length;
    const safety = logs.filter((l) => l.safety_notice_required).length;
    const recommend = logs.filter((l) => l.should_recommend_teacher).length;
    const noSource = logs.filter((l) => len(l.retrieved_document_ids) === 0).length;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      total,
      safety,
      recommend,
      noSource,
      safetyPct: pct(safety),
      recommendPct: pct(recommend),
      noSourcePct: pct(noSource),
    };
  }, [logs]);

  // 일별 답변 수 추세
  const trend = useMemo(() => {
    const byDay = new Map<string, number>();
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const l of logs) {
      const day = (l.created_at ?? "").slice(0, 10);
      if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return Array.from(byDay.entries()).map(([day, count]) => ({
      day: day.slice(5), // MM-DD
      count,
    }));
  }, [logs, period]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      switch (logFilter) {
        case "safety":
          return !!l.safety_notice_required;
        case "recommend":
          return !!l.should_recommend_teacher;
        case "no_source":
          return len(l.retrieved_document_ids) === 0;
        default:
          return true;
      }
    });
  }, [logs, logFilter]);

  return (
    <AdminShell>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-ink">
            AI · 앱운영
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">AI 운영 / 앱버전</h1>
          <p className="mt-1 text-sm text-muted-ink">
            AI 어시스턴트(옴) 답변 품질을 모니터링하고, 앱 강제 업데이트를 관리하세요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={
                  "rounded-md border px-2.5 py-1 text-xs transition " +
                  (period === p.value
                    ? "border-coral bg-coral/12 text-coral-active"
                    : "border-hairline text-muted-ink hover:bg-surface-strong")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(period)}
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

      {/* KPI 카드 */}
      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="총 답변 수" value={stats.total.toLocaleString()} />
        <KpiCard
          label="안전문구 필요"
          value={`${stats.safetyPct}%`}
          sub={`${stats.safety}건`}
          tone="amber"
        />
        <KpiCard
          label="지도자 추천"
          value={`${stats.recommendPct}%`}
          sub={`${stats.recommend}건`}
          tone="sky"
        />
        <KpiCard
          label="출처 없음"
          value={`${stats.noSourcePct}%`}
          sub={`${stats.noSource}건`}
          tone="red"
        />
      </section>

      {/* 추세 차트 */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold text-ink">
          일별 답변 수 ({PERIODS.find((p) => p.value === period)?.label})
        </h2>
        <div className="rounded-lg border border-hairline bg-surface-soft p-4">
          {loading ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-ink">
              불러오는 중…
            </div>
          ) : stats.total === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-ink">
              해당 기간에 답변 기록이 없어요.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <BarChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "#737373", fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={16}
                  axisLine={{ stroke: "#404040" }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#737373", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  cursor={{ fill: "#ffffff08" }}
                  contentStyle={{
                    background: "#0a0a0a",
                    border: "1px solid #404040",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#a3a3a3" }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* 답변 로그 드릴다운 */}
      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              답변 로그 ({filteredLogs.length})
            </h2>
            <p className="text-[11px] text-muted-ink">
              안전문구·지도자추천·출처없음 항목을 점검해 품질을 관리하세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {LOG_FILTERS.map((f) => {
              const active = logFilter === f.value;
              const count =
                f.value === "all"
                  ? logs.length
                  : f.value === "safety"
                    ? stats.safety
                    : f.value === "recommend"
                      ? stats.recommend
                      : stats.noSource;
              return (
                <button
                  key={f.value}
                  onClick={() => setLogFilter(f.value)}
                  className={
                    "rounded-md border px-2.5 py-1 text-xs transition " +
                    (active
                      ? "border-coral bg-coral/12 text-coral-active"
                      : "border-hairline text-muted-ink hover:bg-surface-strong")
                  }
                >
                  {f.label}
                  <span className="ml-1 text-[10px] text-muted-ink">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-hairline">
          <table className="w-full text-sm">
            <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-wider text-muted-ink">
              <tr>
                <th className="px-4 py-2.5">질문 · 답변</th>
                <th className="px-4 py-2.5">플래그</th>
                <th className="px-4 py-2.5">출처</th>
                <th className="px-4 py-2.5">일시</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-ink">
                    조건에 맞는 로그가 없어요.
                  </td>
                </tr>
              ) : null}
              {filteredLogs.slice(0, 200).map((l) => {
                const open = expandedId === l.id;
                const sources = len(l.retrieved_document_ids);
                return (
                  <tr
                    key={l.id}
                    onClick={() => setExpandedId(open ? null : l.id)}
                    className="cursor-pointer border-t border-hairline align-top transition hover:bg-surface-soft"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{l.question}</p>
                      {open ? (
                        <p className="mt-1 max-w-2xl whitespace-pre-wrap text-xs text-muted-ink">
                          {l.answer}
                        </p>
                      ) : (
                        <p className="mt-1 max-w-xl truncate text-[11px] text-muted-ink">
                          {l.answer}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {l.safety_notice_required ? (
                          <Flag label="안전" tone="amber" />
                        ) : null}
                        {l.should_recommend_teacher ? (
                          <Flag label="지도자" tone="sky" />
                        ) : null}
                        {sources === 0 ? <Flag label="출처없음" tone="red" /> : null}
                        {!l.safety_notice_required &&
                        !l.should_recommend_teacher &&
                        sources > 0 ? (
                          <span className="text-[11px] text-muted-soft">—</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-body">
                      {sources}
                      <span className="text-[11px] text-muted-soft"> 문서</span>
                    </td>
                    <td className="px-4 py-3 text-muted-ink">
                      {(l.created_at ?? "").slice(0, 16).replace("T", " ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredLogs.length > 200 ? (
            <p className="border-t border-hairline px-4 py-2 text-[11px] text-muted-ink">
              상위 200건만 표시합니다. 기간/필터로 좁혀주세요.
            </p>
          ) : null}
        </div>
      </section>

      {/* 앱버전 관리 */}
      <AppVersionEditor versions={versions} onChanged={() => load(period)} />
    </AdminShell>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "amber" | "sky" | "red";
}) {
  const toneCls = {
    neutral: "text-ink",
    amber: "text-warning",
    sky: "text-accent-teal",
    red: "text-error",
  }[tone];
  return (
    <div className="rounded-lg border border-hairline bg-surface-soft px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-ink">{label}</p>
      <p className={"mt-1 font-display text-3xl font-semibold tracking-tight " + toneCls}>{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-ink">{sub}</p> : null}
    </div>
  );
}

function Flag({ label, tone }: { label: string; tone: "amber" | "sky" | "red" }) {
  const cls = {
    amber: "border-warning/40 bg-warning/15 text-warning",
    sky: "border-accent-teal/40 bg-accent-teal/15 text-accent-teal",
    red: "border-error/40 bg-error/10 text-error",
  }[tone];
  return (
    <span
      className={
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium " +
        cls
      }
    >
      {label}
    </span>
  );
}

function AppVersionEditor({
  versions,
  onChanged,
}: {
  versions: AppVersion[];
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, { min_version: string; store_url: string }>>(
    {},
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [newPlatform, setNewPlatform] = useState("");
  const [newMin, setNewMin] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  const key = (v: AppVersion) => `${v.platform}__${v.min_version}`;

  const getDraft = (v: AppVersion) =>
    draft[key(v)] ?? { min_version: v.min_version, store_url: v.store_url };

  const setField = (
    v: AppVersion,
    field: "min_version" | "store_url",
    value: string,
  ) => {
    setDraft((d) => ({
      ...d,
      [key(v)]: { ...getDraft(v), [field]: value },
    }));
  };

  const save = async (v: AppVersion) => {
    const next = getDraft(v);
    if (!next.min_version.trim() || !next.store_url.trim()) {
      alert("최소 버전과 스토어 URL을 모두 입력하세요.");
      return;
    }
    setBusy(key(v));
    try {
      const { error } = await supabase
        .from("app_versions")
        .update({
          min_version: next.min_version.trim(),
          store_url: next.store_url.trim(),
        })
        .eq("platform", v.platform)
        .eq("min_version", v.min_version);
      if (error) throw error;
      setDraft((d) => {
        const n = { ...d };
        delete n[key(v)];
        return n;
      });
      onChanged();
    } catch (e: any) {
      alert(`저장에 실패했어요: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    const platform = newPlatform.trim().toLowerCase();
    if (!platform || !newMin.trim() || !newUrl.trim()) {
      alert("플랫폼·최소 버전·스토어 URL을 모두 입력하세요.");
      return;
    }
    setAddBusy(true);
    try {
      const { error } = await supabase.from("app_versions").insert({
        platform,
        min_version: newMin.trim(),
        store_url: newUrl.trim(),
      });
      if (error) throw error;
      setNewPlatform("");
      setNewMin("");
      setNewUrl("");
      onChanged();
    } catch (e: any) {
      alert(`추가에 실패했어요: ${e?.message ?? "unknown"}`);
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-ink">앱버전 / 강제 업데이트</h2>
      <p className="mb-3 text-[11px] text-muted-ink">
        플랫폼별 최소 버전(min_version)보다 낮은 앱은 강제 업데이트 화면이 노출됩니다.
      </p>

      <div className="overflow-hidden rounded-lg border border-hairline">
        <table className="w-full text-sm">
          <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-wider text-muted-ink">
            <tr>
              <th className="px-4 py-2.5">플랫폼</th>
              <th className="px-4 py-2.5">최소 버전</th>
              <th className="px-4 py-2.5">스토어 URL</th>
              <th className="px-4 py-2.5 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-ink">
                  등록된 앱버전이 없어요. 아래에서 추가하세요.
                </td>
              </tr>
            ) : null}
            {versions.map((v) => {
              const d = getDraft(v);
              const dirty =
                d.min_version !== v.min_version || d.store_url !== v.store_url;
              return (
                <tr key={key(v)} className="border-t border-hairline align-top">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md border border-hairline bg-surface-card px-2 py-0.5 text-[11px] font-medium text-body">
                      {v.platform}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={d.min_version}
                      onChange={(e) => setField(v, "min_version", e.target.value)}
                      className="w-28 rounded-md border border-hairline bg-canvas px-2 py-1 text-xs outline-none focus:border-coral"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={d.store_url}
                      onChange={(e) => setField(v, "store_url", e.target.value)}
                      className="w-full min-w-[16rem] rounded-md border border-hairline bg-canvas px-2 py-1 text-xs outline-none focus:border-coral"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => save(v)}
                      disabled={!dirty || busy === key(v)}
                      className="rounded-md border border-coral/40 bg-coral/12 px-2.5 py-1 text-[11px] text-coral-active transition hover:bg-coral/20 disabled:opacity-40"
                    >
                      {busy === key(v) ? "저장 중…" : "저장"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 신규 추가 */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface-soft px-4 py-3">
        <span className="text-[11px] uppercase tracking-wider text-muted-ink">추가</span>
        <input
          value={newPlatform}
          onChange={(e) => setNewPlatform(e.target.value)}
          placeholder="platform (ios/android)"
          className="w-40 rounded-md border border-hairline bg-canvas px-2 py-1 text-xs placeholder-muted-soft outline-none focus:border-coral"
        />
        <input
          value={newMin}
          onChange={(e) => setNewMin(e.target.value)}
          placeholder="min_version (1.0.9)"
          className="w-32 rounded-md border border-hairline bg-canvas px-2 py-1 text-xs placeholder-muted-soft outline-none focus:border-coral"
        />
        <input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="store_url"
          className="min-w-[14rem] flex-1 rounded-md border border-hairline bg-canvas px-2 py-1 text-xs placeholder-muted-soft outline-none focus:border-coral"
        />
        <button
          onClick={add}
          disabled={addBusy}
          className="rounded-md border border-coral/40 bg-coral/12 px-3 py-1 text-[11px] text-coral-active transition hover:bg-coral/20 disabled:opacity-40"
        >
          {addBusy ? "추가 중…" : "추가"}
        </button>
      </div>
    </section>
  );
}
