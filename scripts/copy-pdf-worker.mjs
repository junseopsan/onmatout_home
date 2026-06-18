#!/usr/bin/env node
// pdfjs-dist 워커를 public/ 으로 복사한다.
// PDF 텍스트 추출(app/admin/knowledge/pdf)이 같은 오리진에서 워커를 로드하도록 함.
// 설치 시 postinstall 로 자동 실행되고, 수동으로도 `node scripts/copy-pdf-worker.mjs` 가능.

import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const DEST_DIR = join(ROOT, "public", "vendor");
const DEST = join(DEST_DIR, "pdf.worker.min.mjs");

async function main() {
  if (!existsSync(SRC)) {
    // pdfjs-dist 미설치 환경(예: CI 일부 단계)에서는 조용히 패스
    console.warn("[copy-pdf-worker] pdfjs-dist 워커가 없어 건너뜁니다:", SRC);
    return;
  }
  await mkdir(DEST_DIR, { recursive: true });
  await copyFile(SRC, DEST);
  console.log("[copy-pdf-worker] 복사 완료 → public/vendor/pdf.worker.min.mjs");
}

main().catch((e) => {
  console.error("[copy-pdf-worker] 실패:", e);
  process.exit(1);
});
