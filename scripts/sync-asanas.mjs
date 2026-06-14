#!/usr/bin/env node
/**
 * 아사나 동기화: 개발(SRC) → 운영(DST)
 *
 * BO 관리자 페이지는 개발 DB에 아사나를 등록한다. 이 스크립트는 개발의
 * asanacategory / asanas 테이블을 운영 DB로 upsert(id 기준) 복사한다.
 * (service_role 키를 쓰므로 RLS와 무관하게 읽기/쓰기. upsert 라 삭제는 하지 않음.)
 *
 * 사용법 (키는 코드에 넣지 말고 환경변수로 주입):
 *   SRC_SUPABASE_URL=https://sdwmyqshfqcnyzjdpexi.supabase.co \
 *   SRC_SERVICE_KEY=<dev service_role key> \
 *   DST_SUPABASE_URL=https://ueoytttgsjquapkaerwk.supabase.co \
 *   DST_SERVICE_KEY=<prod service_role key> \
 *   node scripts/sync-asanas.mjs
 *
 *   # 미리보기(쓰지 않고 건수만 확인)
 *   ... DRY_RUN=1 node scripts/sync-asanas.mjs
 *
 * ⚠️ service_role 키는 전체 권한입니다. 셸 히스토리/파일에 남지 않게 주의하세요.
 */

import { createClient } from "@supabase/supabase-js";

const {
  SRC_SUPABASE_URL,
  SRC_SERVICE_KEY,
  DST_SUPABASE_URL,
  DST_SERVICE_KEY,
  DRY_RUN,
} = process.env;

function requireEnv(name, val) {
  if (!val) {
    console.error(`✗ 환경변수 ${name} 가 필요합니다.`);
    process.exit(1);
  }
}
requireEnv("SRC_SUPABASE_URL", SRC_SUPABASE_URL);
requireEnv("SRC_SERVICE_KEY", SRC_SERVICE_KEY);
requireEnv("DST_SUPABASE_URL", DST_SUPABASE_URL);
requireEnv("DST_SERVICE_KEY", DST_SERVICE_KEY);

if (SRC_SUPABASE_URL === DST_SUPABASE_URL) {
  console.error("✗ SRC 와 DST 가 동일한 프로젝트입니다. 중단합니다.");
  process.exit(1);
}

const dryRun = !!DRY_RUN;
const src = createClient(SRC_SUPABASE_URL, SRC_SERVICE_KEY, {
  auth: { persistSession: false },
});
const dst = createClient(DST_SUPABASE_URL, DST_SERVICE_KEY, {
  auth: { persistSession: false },
});

// 페이지네이션으로 전체 행을 읽는다 (1000행 제한 우회).
async function fetchAll(client, table, orderCol = "id") {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .order(orderCol, { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`[${table}] 읽기 실패: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function upsertAll(client, table, rows) {
  if (rows.length === 0) return 0;
  const chunk = 500;
  let done = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await client
      .from(table)
      .upsert(slice, { onConflict: "id" });
    if (error) throw new Error(`[${table}] upsert 실패: ${error.message}`);
    done += slice.length;
  }
  return done;
}

async function syncTable(table) {
  const rows = await fetchAll(src, table);
  console.log(`  • ${table}: 개발에서 ${rows.length}건 읽음`);
  if (dryRun) {
    console.log(`    (DRY_RUN — 쓰지 않음)`);
    return;
  }
  const n = await upsertAll(dst, table, rows);
  console.log(`    → 운영에 ${n}건 upsert 완료`);
}

(async () => {
  console.log(`아사나 동기화 시작 ${dryRun ? "(DRY_RUN)" : ""}`);
  console.log(`  SRC(개발): ${SRC_SUPABASE_URL}`);
  console.log(`  DST(운영): ${DST_SUPABASE_URL}`);
  try {
    // 카테고리 먼저(아사나가 category_name_en 참조), 그 다음 아사나
    await syncTable("asanacategory");
    await syncTable("asanas");
    console.log("✓ 완료");
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
})();
