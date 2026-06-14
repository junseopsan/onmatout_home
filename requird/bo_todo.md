# ONMATOUT 백오피스(BO) TODO

`bo_prd.md` v0.1 기반 실행 체크리스트.
진행 순서: **백엔드 의존성(RLS/스키마) 배포 → 프론트 페이지 구현 → E2E 검증**.
페이지 우선순위: P0(지원·신고, AI·앱버전) → P1(사용자, 콘텐츠) → P2(대시보드).

> **구현 방식 정정:** 당초 SECURITY DEFINER RPC 위주 계획이었으나, 기존 `studios`
> 페이지 패턴(직접 쿼리 + 어드민 RLS + 교차 사용자 정보는 `admin_get_users_info`)과
> 일관되도록 **테이블 어드민 RLS + 직접 쿼리** 방식으로 구현함. RLS 헬퍼는
> `is_app_admin()` (SECURITY DEFINER, 모든 SQL 파일에 포함).

---

## ✅ 완료됨 (기존 BO)

- [x] 어드민 인증 — 전화 OTP + `app_admins` 체크 (`lib/adminAuth.ts`)
- [x] AdminShell 셸/네비/세션 가드 (`components/admin/AdminShell.tsx`)
- [x] 요가원 관리 (`/admin/studios`)
- [x] 지도자 관리 (`/admin/teachers`)
- [x] AI 지식베이스 (`/admin/knowledge`)

---

## ✅ P0-A — 지원·신고 관리 (`/admin/support`) — 완료

### 백엔드 (Supabase) — `sql/admin_support_requests_rls.sql`
- [x] `is_app_admin()` 헬퍼 (SECURITY DEFINER)
- [x] `support_requests` 어드민 SELECT/UPDATE RLS
- [ ] **(배포)** Supabase SQL Editor에서 위 SQL 실행
- [ ] 비-어드민 접근 차단 E2E 확인

### 프론트 — `app/admin/support/page.tsx`
- [x] `"use client"` + `<AdminShell>`
- [x] 상태 필터(대기/처리중/해결/종료) + 카테고리 필터(버그/기능요청/문의/기타)
- [x] 제목/내용/요청자 검색
- [x] 테이블 + 행 펼침 본문, 요청자 정보(`admin_get_users_info`)
- [x] 인라인 `admin_response` 작성 + 상태 변경 + 빠른 종료
- [x] pending 우선 정렬, 응답 시 처리중 자동 제안
- [x] 엣지: 탈퇴/익명 요청 표시, 본문 truncate

### 네비
- [x] `AdminShell` `NAV`에 "지원·신고" 추가

---

## ✅ P0-B — AI 운영 / 앱버전 (`/admin/ai-ops`) — 완료

> ⚠️ **스키마 정정:** `ai_answer_logs`에 `rating`/`rated_at` 컬럼 없음 → 평점 대신
> 안전문구/지도자추천/출처(RAG) 기반 지표로 설계.

### 백엔드 (Supabase) — `sql/admin_ai_ops_rls.sql`
- [x] `ai_answer_logs` 어드민 SELECT RLS
- [x] `app_versions` 어드민 INSERT/UPDATE/DELETE RLS
- [ ] **(배포)** Supabase SQL Editor에서 위 SQL 실행

### 프론트 — `app/admin/ai-ops/page.tsx`
- [x] 기간 선택(7/30/90일)
- [x] KPI 카드 — 총 답변수 / 안전문구 필요 / 지도자 추천 / 출처 없음
- [x] 일별 답변 수 추세 차트(recharts)
- [x] 답변 로그 드릴다운(전체/안전/추천/출처없음, 질문·답변·출처 수)
- [x] 앱버전 편집(플랫폼별 `min_version`/`store_url`) + 신규 추가
- [x] 엣지: 무데이터 빈 차트, 상위 200건 표시

### 네비
- [x] `AdminShell` `NAV`에 "AI·앱운영" 추가

---

## ✅ P1-A — 사용자 관리 (`/admin/users`) — 완료

### 결정
- [x] 정지 저장소 → **옵션 B `user_bans` 테이블(이력 보존)** 채택

### 백엔드 (Supabase) — `sql/admin_users.sql`
- [x] `user_bans` 테이블 신설(활성 정지 1건 유니크 인덱스)
- [x] `user_profiles` / `user_roles` 어드민 SELECT RLS
- [x] `app_admins` 어드민 SELECT/INSERT/DELETE RLS
- [x] `is_user_banned(uuid)` 헬퍼 (앱 차단 연동용)
- [ ] **(배포)** Supabase SQL Editor에서 위 SQL 실행

### 프론트 — `app/admin/users/page.tsx`
- [x] 검색(이름·전화·이메일, 서버 `.or` ilike) + 역할 필터(지도자/회원/어드민/정지)
- [x] 사용자 테이블(아바타·이름·역할·연락처·상태·가입일)
- [x] 정지/해제(사유 필수, user_bans 이력)
- [x] 어드민 부여/회수
- [x] 가드: 자기 자신 회수 방지, 마지막 어드민 회수 차단
- [x] 최근 500명 + 초과 안내

### 네비
- [x] `AdminShell` `NAV`에 "사용자 관리" 추가

### 후속(앱 측, 별도)
- [ ] 정지 사용자 앱 접근 차단 — `is_user_banned()` 를 앱/RLS에 연동

---

## ✅ P1-B — 콘텐츠 모더레이션 (`/admin/content`) — 완료

### 결정
- [x] 제거 방식 → **soft-hide(hidden_at)** 채택
- [x] 신고 테이블 → 이번엔 제외(조회+숨김만). `content_reports`는 향후 과제

### 백엔드 (Supabase) — `sql/admin_content.sql`
- [x] `practice_records` / `feed_comments` 에 `hidden_at`·`hidden_by`·`hidden_reason` 컬럼 추가
- [x] 두 테이블 어드민 SELECT + UPDATE(숨김) RLS
- [ ] **(배포)** Supabase SQL Editor에서 위 SQL 실행

### 프론트 — `app/admin/content/page.tsx`
- [x] 기록/댓글 탭 + 상태 필터(전체/노출/숨김) + 검색
- [x] 테이블(작성자·내용·구성/원본·상태·작성일)
- [x] 숨김/해제(사유 선택, soft-hide)
- [x] 엣지: 아사나·사진 수, 대댓글 표시, 최근 300건

### 네비
- [x] `AdminShell` `NAV`에 "콘텐츠" 추가

### 후속(앱 측, 별도)
- [ ] 앱 피드 조회 쿼리에 `hidden_at IS NULL` 조건 추가(숨김 실제 반영)

---

## ✅ 추가 — 회원 일괄 등록 (`/admin/members-import`) — 완료

> 대상: **지도자 회원명단(`student_profiles`)**. 앱 계정이 아니라 지도자가 관리하는
> 회원 카드를 엑셀/CSV로 한 번에 생성. 초대코드는 기존 INSERT 트리거가 자동 발급.

### 백엔드 (Supabase) — `sql/admin_bulk_create_students.sql`
- [x] `admin_bulk_create_students(p_teacher_id, p_rows, p_with_consent)` SECURITY DEFINER RPC
  - app_admins 검증, teacher_id+phone 중복 스킵, 이름 누락 스킵
  - 생성 결과(이름·전화·초대코드) 반환
- [x] `student_profiles` 어드민 SELECT RLS
- [ ] **(배포)** Supabase SQL Editor에서 위 SQL 실행
- [ ] 지도자 목록 조회는 `admin_users.sql`(user_roles RLS) + `admin_get_users_info` 필요

### 프론트 — `app/admin/members-import/page.tsx`
- [x] 지도자 선택(검색 + 드롭다운)
- [x] 명단 입력 — 엑셀 복붙(탭)·CSV 업로드, 머리글 자동 제외, 예시 채우기
- [x] 미리보기 — 행별 검증(이름 누락/전화 형식/파일 내 중복), 유효·제외 카운트
- [x] 전화번호 수집 동의 체크박스(체크 시 phone_consent_at 기록)
- [x] 일괄 등록 실행(RPC) + 결과(생성/건너뜀)
- [x] 발급된 초대코드 목록 + CSV 다운로드(요가원 배포용)

### 네비
- [x] `AdminShell` `NAV`에 "회원 일괄등록" 추가

### 후속(선택)
- [ ] .xlsx 바이너리 직접 업로드 지원(SheetJS `xlsx` 의존성 추가 필요)

---

## ✅ P2 — 대시보드 (`/admin/dashboard`) — 완료

### 프론트 — `app/admin/dashboard/page.tsx`
> 별도 집계 RPC 없이 `count: exact, head: true` 직접 집계(부분 실패 허용).
- [x] KPI 카드 8종(총 사용자/신규/지도자/회원/요가원 신청·전체/미처리 지원/숨김 콘텐츠)
- [x] 카드 클릭 시 해당 관리 페이지 이동
- [x] 일별 신규 가입 / 일별 AI 답변 추세 차트
- [x] `/admin` 루트 리다이렉트 `studios` → `dashboard`
- [x] `AdminShell` `NAV` 최상단에 "대시보드"

---

## ✅ 추가 — 역할 기반 접근제어(RBAC) + 메뉴 권한 — 완료

> 수퍼관리자 외 **요가원 원장(studio_owner)** 도 BO 접근. 역할 2단계 + 사용자별 메뉴
> 예외 + **원장 데이터 본인 요가원 한정(RLS 스코핑)**.

### 백엔드 (Supabase) — `sql/admin_rbac.sql`
- [x] `bo_users`(역할) / `bo_menu_overrides`(메뉴 예외) 테이블
- [x] 기존 `app_admins` → `bo_users(super_admin)` 시드
- [x] `is_app_admin()` bo_users 기준 재정의 + `bo_role()`/`is_bo_user()`/`owns_studio_teacher()`
- [x] 원장 스코프 RLS: pivot_studios/studio_teachers/student_profiles
- [x] `admin_bulk_create_students` RPC: 원장도 본인 요가원 지도자 한정 허용
- [ ] **(배포)** Supabase SQL Editor에서 위 SQL 실행

### 프론트
- [x] `lib/boMenus.ts` — 메뉴 카탈로그 + resolveMenus/menuKeyForPath
- [x] `lib/adminAuth.ts` — app_admins→bo_users 인증 + `getBoContext()`(역할+메뉴)
- [x] `AdminShell` — 동적 NAV + 경로 게이팅 + `useBoContext()` provider, 역할 배지
- [x] `app/admin/permissions/page.tsx` — BO 사용자/역할 부여·변경·제거 + 메뉴 토글(super 전용)
- [x] `members-import` 지도자 소스 역할 분기(super=user_roles / 원장=studio_teachers)
- [x] `users` 페이지 — app_admins 토글 제거(권한관리로 이전), BO 역할 배지 표시
- [x] 로그인/루트 리다이렉트 역할별 첫 메뉴로

### 후속(향후)
- [ ] `admin_get_users_info` 원장용 스코프 강화
- [ ] studio_owner 전용 대시보드/요가원 정보 편집

---

## 🔧 공통 / 마무리

- [x] 파괴적 액션(정지/숨김) 사유 입력 + 확인 단계 일관 적용
- [x] 로딩("처리 중…")·오류 빨간 박스 패턴 통일
- [x] `AdminShell` `NAV` 최종 순서(대시보드/사용자/지원/요가원/지도자/지식베이스/AI·앱/콘텐츠)
- [x] 타입체크 통과(신규 파일 에러 0)
- [ ] **배포 SQL 4종 실행** (아래)
- [ ] 테스트 어드민(`01000000000` / `000000`)으로 페이지별 E2E 확인

### 배포 SQL (Supabase SQL Editor, 순서 무관·재실행 안전)
1. [ ] `sql/admin_support_requests_rls.sql`
2. [ ] `sql/admin_ai_ops_rls.sql`
3. [ ] `sql/admin_users.sql`
4. [ ] `sql/admin_content.sql`
5. [ ] `sql/admin_bulk_create_students.sql`
6. [ ] `sql/admin_rbac.sql` ← **RBAC. is_app_admin() 재정의 포함이라 마지막에 실행 권장**

---

## 📌 향후 과제 (이번 범위 밖)

- [ ] `content_reports` 테이블 + 앱 신고 UI → 신고 누적·우선노출
- [ ] 클래스/출석/수업권 운영 통계
- [ ] 다중 어드민 권한 등급(RBAC)
- [ ] `bo_prd.md` 6.2의 "평점" 서술 수정(실제 스키마 반영)
