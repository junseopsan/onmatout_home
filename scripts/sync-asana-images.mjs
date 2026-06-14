#!/usr/bin/env node
// 아사나 이미지 동기화: Supabase Storage(asanas-images) → public/images/asanas
//
// 앱은 로딩 속도를 위해 로컬(public/images/asanas)의 이미지를 서빙한다.
// 원본은 Supabase Storage 의 public 버킷 asanas-images 이고, BO 에서 이미지를
// 추가/교체하면 이 스크립트로 로컬을 최신화한 뒤 배포(git commit)한다.
//
// 두 가지 모드
//   1) 번호 지정(추천, 키 불필요): 바뀐 아사나 번호만 빠르게 당겨온다.
//        node scripts/sync-asana-images.mjs 183
//        node scripts/sync-asana-images.mjs 183 184 052
//      → 각 번호의 변형(183_001, 183_002 …)을 404 만날 때까지 받는다.
//
//   2) 전체 동기화(service 키 필요): 버킷 전체 목록을 받아 변경분만 내려받는다.
//      public 버킷이라도 "목록 조회"는 RLS 로 막혀 있어 service_role 키가 필요하다.
//        ASANA_IMAGE_SERVICE_KEY=eyJ... node scripts/sync-asana-images.mjs --all
//
// 옵션: --force (크기 무관 다시 받기), --dry-run (받지 않고 차이만 출력)
//
// env override:
//   ASANA_IMAGE_PROJECT_URL  (기본: prod 프로젝트)
//   ASANA_IMAGE_BUCKET       (기본: asanas-images)
//   ASANA_IMAGE_SERVICE_KEY  (전체 동기화 목록 조회용 service_role 키)

import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_URL =
  process.env.ASANA_IMAGE_PROJECT_URL ??
  "https://ueoytttgsjquapkaerwk.supabase.co";
const BUCKET = process.env.ASANA_IMAGE_BUCKET ?? "asanas-images";
const SERVICE_KEY = process.env.ASANA_IMAGE_SERVICE_KEY ?? "";

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const DRY_RUN = argv.includes("--dry-run");
const ALL = argv.includes("--all");
// 옵션 플래그를 뺀 나머지를 "아사나 번호" 인자로 본다.
const numbers = argv
  .filter((a) => !a.startsWith("--"))
  .map((a) => a.replace(/\.png$/i, ""));

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "images", "asanas");

const FILE_RE = /^\d+_\d+(?:_)?\.png$/i;
const publicUrl = (name) =>
  `${PROJECT_URL}/storage/v1/object/public/${BUCKET}/${name}`;

async function localSize(name) {
  try {
    return (await stat(join(OUT_DIR, name))).size;
  } catch {
    return -1;
  }
}

// 다운로드. 객체 없음(Supabase 는 404 또는 400 반환) 이면 null.
async function fetchFile(name) {
  const res = await fetch(publicUrl(name));
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`다운로드 실패 (${res.status}) ${name}`);
  return Buffer.from(await res.arrayBuffer());
}

async function saveIfChanged(name, buf, stats) {
  const lsize = await localSize(name);
  const changed = FORCE || lsize !== buf.length;
  if (!changed) {
    stats.skipped++;
    return;
  }
  const reason = lsize === -1 ? "신규" : `변경 ${lsize}→${buf.length}`;
  if (DRY_RUN) {
    console.log(`  [예정] ${name}  (${reason})`);
    stats.downloaded++;
    return;
  }
  await writeFile(join(OUT_DIR, name), buf);
  console.log(`  ✓ ${name}  (${reason}, ${buf.length}B)`);
  stats.downloaded++;
}

// 모드 1: 번호별로 변형을 404 까지 받는다.
async function syncByNumber(num, stats) {
  // "183" → 183, 변형 001,002,... ; "183_002" 형태면 그 파일만.
  const m = num.match(/^(\d+)_(\d+)$/);
  if (m) {
    const name = `${num}.png`;
    const buf = await fetchFile(name);
    if (!buf) {
      console.log(`  - ${name} 없음(스토리지)`);
      stats.missing++;
      return;
    }
    await saveIfChanged(name, buf, stats);
    return;
  }
  const base = num.padStart(3, "0");
  let gap = 0;
  for (let v = 1; v <= 99; v++) {
    const name = `${base}_${String(v).padStart(3, "0")}.png`;
    const buf = await fetchFile(name);
    if (!buf) {
      // 연속 2개 비면 종료(중간 결번 1개 허용)
      if (++gap >= 2) break;
      continue;
    }
    gap = 0;
    await saveIfChanged(name, buf, stats);
  }
}

// 모드 2: service 키로 버킷 전체 목록 → 변경분 다운로드.
async function listAll() {
  if (!SERVICE_KEY) {
    throw new Error(
      "전체 동기화에는 ASANA_IMAGE_SERVICE_KEY (prod service_role 키)가 필요합니다.\n" +
        "  예) ASANA_IMAGE_SERVICE_KEY=eyJ... node scripts/sync-asana-images.mjs --all\n" +
        "  또는 바뀐 번호만: node scripts/sync-asana-images.mjs 183",
    );
  }
  const items = [];
  const limit = 1000;
  for (let offset = 0; ; offset += limit) {
    const res = await fetch(
      `${PROJECT_URL}/storage/v1/object/list/${BUCKET}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          prefix: "",
          limit,
          offset,
          sortBy: { column: "name", order: "asc" },
        }),
      },
    );
    if (!res.ok)
      throw new Error(
        `목록 조회 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`,
      );
    const page = await res.json();
    items.push(...page);
    if (page.length < limit) break;
  }
  return items.filter((it) => it?.name && FILE_RE.test(it.name));
}

async function syncAll(stats) {
  const remote = await listAll();
  console.log(`스토리지 원본 파일: ${remote.length}개\n`);
  for (const it of remote) {
    const lsize = await localSize(it.name);
    const remoteSize = Number(it.metadata?.size ?? -1);
    if (!FORCE && lsize === remoteSize) {
      stats.skipped++;
      continue;
    }
    const buf = await fetchFile(it.name);
    if (!buf) {
      stats.missing++;
      continue;
    }
    await saveIfChanged(it.name, buf, stats);
  }
  // 스토리지에 없는 로컬 파일(삭제 후보) 안내
  const remoteNames = new Set(remote.map((r) => r.name));
  const localFiles = (await readdir(OUT_DIR)).filter((f) => FILE_RE.test(f));
  const orphans = localFiles.filter((f) => !remoteNames.has(f));
  if (orphans.length)
    console.log(
      `\n참고: 스토리지에 없는 로컬 파일 ${orphans.length}개(수동 확인): ${orphans
        .slice(0, 10)
        .join(", ")}${orphans.length > 10 ? " …" : ""}`,
    );
}

async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });
  console.log(`소스: ${publicUrl("<name>")}`);
  console.log(`대상: ${OUT_DIR}`);
  console.log(
    `모드: ${ALL ? "전체" : numbers.length ? `번호 ${numbers.join(",")}` : "(인자 없음)"}` +
      `${FORCE ? " +force" : ""}${DRY_RUN ? " (dry-run)" : ""}\n`,
  );

  if (!ALL && numbers.length === 0) {
    console.log(
      "사용법:\n  바뀐 번호만:  node scripts/sync-asana-images.mjs 183 [184 ...]\n" +
        "  전체 동기화:  ASANA_IMAGE_SERVICE_KEY=... node scripts/sync-asana-images.mjs --all",
    );
    return;
  }

  const stats = { downloaded: 0, skipped: 0, missing: 0 };
  if (ALL) await syncAll(stats);
  else for (const n of numbers) await syncByNumber(n, stats);

  console.log(
    `\n완료 — ${DRY_RUN ? "받을 예정" : "다운로드"} ${stats.downloaded}, 동일 ${stats.skipped}, 없음 ${stats.missing}`,
  );
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
