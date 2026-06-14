"use client";

import Link from "next/link";
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

type Stats = {
  totalUsers: number | null;
  newUsers: number | null;
  teachers: number | null;
  students: number | null;
  pendingApplications: number | null;
  totalStudios: number | null;
  pendingSupport: number | null;
  aiAnswers: number | null;
  hiddenRecords: number | null;
  hiddenComments: number | null;
};

const PERIOD_DAYS = 30;

// count-only 쿼리 헬퍼: 권한/누락 시 null 반환(대시보드는 부분 실패 허용)
async function countOf(
  build: () => any,
): Promise<number | null> {
  try {
    const { count, error } = await build();
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [signupTrend, setSignupTrend] = useState<{ day: string; count: number }[]>([]);
  const [aiTrend, setAiTrend] = useState<{ day: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const fromIso = (() => {
        const d = new Date();
        d.setDate(d.getDate() - PERIOD_DAYS);
        return d.toISOString();
      })();

      const [
        totalUsers,
        newUsers,
        teachers,
        students,
        pendingApplications,
        totalStudios,
        pendingSupport,
        aiAnswers,
        hiddenRecords,
        hiddenComments,
      ] = await Promise.all([
        countOf(() =>
          supabase.from("user_profiles").select("*", { count: "exact", head: true }),
        ),
        countOf(() =>
          supabase
            .from("user_profiles")
            .select("*", { count: "exact", head: true })
            .gte("created_at", fromIso),
        ),
        countOf(() =>
          supabase
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("role", "teacher"),
        ),
        countOf(() =>
          supabase
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("role", "student"),
        ),
        countOf(() =>
          supabase
            .from("studio_applications")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending"),
        ),
        countOf(() =>
          supabase.from("pivot_studios").select("*", { count: "exact", head: true }),
        ),
        countOf(() =>
          supabase
            .from("support_requests")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending"),
        ),
        countOf(() =>
          supabase
            .from("ai_answer_logs")
            .select("*", { count: "exact", head: true })
            .gte("created_at", fromIso),
        ),
        countOf(() =>
          supabase
            .from("practice_records")
            .select("*", { count: "exact", head: true })
            .not("hidden_at", "is", null),
        ),
        countOf(() =>
          supabase
            .from("feed_comments")
            .select("*", { count: "exact", head: true })
            .not("hidden_at", "is", null),
        ),
      ]);

      setStats({
        totalUsers,
        newUsers,
        teachers,
        students,
        pendingApplications,
        totalStudios,
        pendingSupport,
        aiAnswers,
        hiddenRecords,
        hiddenComments,
      });

      // 추세: 최근 30일 가입 / AI 답변 (created_at 만 가져와 일별 집계)
      const [{ data: su }, { data: ai }] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("created_at")
          .gte("created_at", fromIso)
          .limit(5000),
        supabase
          .from("ai_answer_logs")
          .select("created_at")
          .gte("created_at", fromIso)
          .limit(5000),
      ]);
      setSignupTrend(toDailyTrend((su ?? []) as { created_at: string | null }[]));
      setAiTrend(toDailyTrend((ai ?? []) as { created_at: string | null }[]));
    } catch (e: any) {
      setError(e?.message ?? "지표를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const hiddenTotal = useMemo(() => {
    if (!stats) return null;
    const a = stats.hiddenRecords;
    const b = stats.hiddenComments;
    if (a === null && b === null) return null;
    return (a ?? 0) + (b ?? 0);
  }, [stats]);

  return (
    <AdminShell>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
            대시보드
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">운영 대시보드</h1>
          <p className="mt-1 text-sm text-neutral-400">
            핵심 지표 요약 (신규·AI는 최근 {PERIOD_DAYS}일 기준).
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

      {/* KPI 카드 */}
      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="총 사용자" value={stats?.totalUsers} loading={loading} href="/admin/users" />
        <StatCard
          label={`신규 가입 (${PERIOD_DAYS}일)`}
          value={stats?.newUsers}
          loading={loading}
          tone="sky"
        />
        <StatCard label="지도자" value={stats?.teachers} loading={loading} />
        <StatCard label="회원" value={stats?.students} loading={loading} />

        <StatCard
          label="요가원 신청 대기"
          value={stats?.pendingApplications}
          loading={loading}
          tone={stats?.pendingApplications ? "amber" : "neutral"}
          href="/admin/studios"
        />
        <StatCard
          label="전체 요가원"
          value={stats?.totalStudios}
          loading={loading}
          href="/admin/studios"
        />
        <StatCard
          label="미처리 지원요청"
          value={stats?.pendingSupport}
          loading={loading}
          tone={stats?.pendingSupport ? "amber" : "neutral"}
          href="/admin/support"
        />
        <StatCard
          label="숨김 콘텐츠"
          value={hiddenTotal}
          loading={loading}
          tone={hiddenTotal ? "red" : "neutral"}
          href="/admin/content"
        />
      </section>

      {/* 추세 차트 */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendCard
          title={`일별 신규 가입 (최근 ${PERIOD_DAYS}일)`}
          data={signupTrend}
          loading={loading}
          color="#38bdf8"
        />
        <TrendCard
          title={`일별 AI 답변 (최근 ${PERIOD_DAYS}일)`}
          data={aiTrend}
          loading={loading}
          color="#8b5cf6"
        />
      </section>

      <p className="mt-6 text-[11px] text-neutral-600">
        ※ 일부 지표가 비어 있으면 해당 테이블의 어드민 RLS(SQL) 적용 여부를 확인하세요.
      </p>
    </AdminShell>
  );
}

function toDailyTrend(rows: { created_at: string | null }[]) {
  const byDay = new Map<string, number>();
  for (let i = PERIOD_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of rows) {
    const day = (r.created_at ?? "").slice(0, 10);
    if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  return Array.from(byDay.entries()).map(([day, count]) => ({
    day: day.slice(5),
    count,
  }));
}

function StatCard({
  label,
  value,
  loading,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number | null | undefined;
  loading: boolean;
  tone?: "neutral" | "sky" | "amber" | "red";
  href?: string;
}) {
  const toneCls = {
    neutral: "text-neutral-100",
    sky: "text-sky-300",
    amber: "text-amber-300",
    red: "text-red-300",
  }[tone];
  const display =
    loading && value === undefined
      ? "…"
      : value === null || value === undefined
        ? "—"
        : value.toLocaleString();

  const inner = (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 px-4 py-3 transition hover:border-neutral-700">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={"mt-1 text-2xl font-semibold tracking-tight " + toneCls}>{display}</p>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function TrendCard({
  title,
  data,
  loading,
  color,
}: {
  title: string;
  data: { day: string; count: number }[];
  loading: boolean;
  color: string;
}) {
  const empty = !loading && data.every((d) => d.count === 0);
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">{title}</h2>
      {loading ? (
        <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
          불러오는 중…
        </div>
      ) : empty ? (
        <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
          데이터가 없어요.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={192}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
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
            <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
