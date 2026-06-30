#!/usr/bin/env node
// 아사나 이미지 미러링: onmatout_rn(앱)  →  onmatout_home/public/images/asanas
//
// 이미지의 원본(source of truth)은 RN 앱 레포의 assets/images/asanas 다.
// BO 는 로딩 속도를 위해 로컬(public/images/asanas)의 정적 파일을 서빙하므로,
// 이 스크립트로 RN 의 이미지를 BO 로 복사한 뒤 배포(git commit)한다.
//
// 사용법
//   node scripts/mirror-asana-images-from-rn.mjs            # 변경분만 복사
//   node scripts/mirror-asana-images-from-rn.mjs --force    # 크기 무관 전부 다시 복사
//   node scripts/mirror-asana-images-from-rn.mjs --prune    # RN 에 없는 BO 파일까지 삭제(완전 일치)
//   node scripts/mirror-asana-images-from-rn.mjs --dry-run  # 복사/삭제 안 하고 차이만 출력
//   node scripts/mirror-asana-images-from-rn.mjs 013 083    # 특정 번호만
//
// env override:
//   RN_ASANA_DIR  (기본: ../onmatout_rn/assets/images/asanas)

import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME_ROOT = join(__dirname, "..");

const SRC_DIR =
  process.env.RN_ASANA_DIR ??
  join(HOME_ROOT, "..", "onmatout_rn", "assets", "images", "asanas");
const OUT_DIR = join(HOME_ROOT, "public", "images", "asanas");

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const DRY_RUN = argv.includes("--dry-run");
const PRUNE = argv.includes("--prune");
// 플래그를 뺀 나머지는 "아사나 번호" 필터(예: 013, 83). 비면 전체.
const numbers = new Set(
  argv
    .filter((a) => !a.startsWith("--"))
    .map((a) => a.replace(/\.png$/i, "").padStart(3, "0")),
);

const FILE_RE = /^(\d+)_\d+\.png$/i;

async function sizeOf(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return -1;
  }
}

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(
      `RN 이미지 폴더를 찾을 수 없습니다: ${SRC_DIR}\n` +
        `  RN_ASANA_DIR 환경변수로 경로를 지정할 수 있습니다.`,
    );
    process.exit(1);
  }
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  console.log(`원본(RN): ${SRC_DIR}`);
  console.log(`대상(BO): ${OUT_DIR}`);
  console.log(
    `모드: ${numbers.size ? `번호 ${[...numbers].join(",")}` : "전체"}` +
      `${FORCE ? " +force" : ""}${PRUNE ? " +prune" : ""}${DRY_RUN ? " (dry-run)" : ""}\n`,
  );

  const srcFiles = (await readdir(SRC_DIR)).filter((f) => {
    const m = f.match(FILE_RE);
    if (!m) return false;
    return numbers.size === 0 || numbers.has(m[1].padStart(3, "0"));
  });

  const stats = { copied: 0, skipped: 0 };
  for (const name of srcFiles) {
    const src = join(SRC_DIR, name);
    const dst = join(OUT_DIR, name);
    const [ssize, dsize] = await Promise.all([sizeOf(src), sizeOf(dst)]);
    if (!FORCE && ssize === dsize) {
      stats.skipped++;
      continue;
    }
    const reason = dsize === -1 ? "신규" : `변경 ${dsize}→${ssize}`;
    if (DRY_RUN) {
      console.log(`  [예정] ${name}  (${reason})`);
      stats.copied++;
      continue;
    }
    await copyFile(src, dst);
    console.log(`  ✓ ${name}  (${reason}, ${ssize}B)`);
    stats.copied++;
  }

  // RN 에는 없는데 BO 에만 있는 파일. --prune 이면 삭제, 아니면 경고만.
  // (번호 필터를 준 경우엔 전체 비교가 아니므로 prune 하지 않는다.)
  let pruned = 0;
  const srcNames = new Set(srcFiles.map((f) => f));
  if (numbers.size === 0) {
    const localFiles = (await readdir(OUT_DIR)).filter((f) => FILE_RE.test(f));
    const orphans = localFiles.filter((f) => !srcNames.has(f));
    if (orphans.length && PRUNE) {
      for (const f of orphans) {
        if (DRY_RUN) {
          console.log(`  [삭제 예정] ${f}`);
        } else {
          await rm(join(OUT_DIR, f));
          console.log(`  ✗ 삭제 ${f}`);
        }
        pruned++;
      }
    } else if (orphans.length) {
      console.log(
        `\n참고: RN 에 없는 BO 로컬 파일 ${orphans.length}개(--prune 로 삭제 가능): ` +
          `${orphans.slice(0, 15).join(", ")}${orphans.length > 15 ? " …" : ""}`,
      );
    }
  }

  console.log(
    `\n완료 — ${DRY_RUN ? "복사 예정" : "복사"} ${stats.copied}, 동일 ${stats.skipped}` +
      `${PRUNE ? `, ${DRY_RUN ? "삭제 예정" : "삭제"} ${pruned}` : ""}`,
  );
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
