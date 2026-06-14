# ONMATOUT 백오피스(BO) PRD v0.1

> 운영 어드민용 웹 백오피스 제품 요구사항 문서.
> 앱(`onmatout_rn`)에 구현된 기능을 근거로 BO 전체 범위를 정의한다.
> 대상 코드베이스: `onmatout_home` (Next.js 15 / App Router).
> 작성 기준일: 2026-06-09.

---

## 1. 개요

### 1.1 배경

`onmatout_rn`은 개인 요가 수련 앱에서 **지도자–회원 클래스 관리 플랫폼**으로 피벗하면서 36개 Supabase 테이블 규모로 성장했다(회원/출석/수업권, 클래스/스케줄, 루틴, 요가톡/AI, 스튜디오, 지원요청 등). 같은 Supabase 프로젝트(`sdwmyqshfqcnyzjdpexi`)를 공유하는 웹 프로젝트 `onmatout_home`에 운영용 BO가 이미 시작되어 **요가원·지도자·AI 지식베이스** 3개 페이지가 동작한다.

운영이 본격화되면서 다음 영역이 BO에 추가로 필요하다(현재 `AdminShell`의 `// 후속: 신고, 사용자 정지 등` 주석으로만 존재):

- **사용자 관리** — 가입자 조회/정지, 어드민 권한 관리
- **지원/신고 관리** — 사용자 문의·버그·기능요청 처리
- **콘텐츠 모더레이션** — 피드(수련 기록/댓글) 신고 대응
- **AI 운영 / 앱버전** — AI 답변 품질 모니터링, 강제 업데이트 관리

### 1.2 목적

운영자가 코드를 만지거나 Supabase 콘솔에 직접 접근하지 않고도 일상 운영(사용자 응대, 신고 처리, 콘텐츠 정리, 앱 배포 관리)을 수행할 수 있게 한다.

### 1.3 대상 사용자

- **운영 어드민** — `app_admins` 테이블에 등록된 내부 운영자. 단일 권한 등급(현재 권한 세분화 없음).

### 1.4 비범위 (Out of Scope)

- 결제/정산 (앱이 오프라인 결제 전제, 수업권 수동 발급)
- 다중 어드민 권한 등급(역할별 RBAC) — 현재는 단일 `app_admins`
- 실시간 알림/채팅 콘솔
- 지도자·회원이 사용하는 기능 자체(앱 책임)

---

## 2. 현재 구현 현황 (재사용 기반)

신규 페이지는 아래 기존 패턴을 **그대로 따른다**.

### 2.1 인증 — `lib/adminAuth.ts`

- 전화 OTP 로그인. 테스트 번호 `01000000000` / 코드 `000000` 지원(`signInWithPassword`, 비밀번호 `Test1234!`).
- 실번호는 `signInWithOtp({ shouldCreateUser: false })` → `verifyOtp`.
- 한국 번호 E.164 변환(`01012345678` → `+821012345678`).
- 로그인 후 **`app_admins` 테이블 `user_id` 존재 여부**로 어드민 검증. 없으면 즉시 `signOut` + 오류.
- 세션 확인: `adminAuth.getAdminSession()`.

### 2.2 셸 / 네비게이션 — `components/admin/AdminShell.tsx`

- 좌측 사이드바 `NAV` 배열, 다크 테마(`bg-neutral-950 text-neutral-100`).
- 마운트 시 `getAdminSession()`로 가드 → 미인증이면 `/admin/login`으로 `replace`.
- 활성 메뉴 `violet-600/20` 하이라이트, 하단에 로그인 식별자 + 로그아웃 버튼.

### 2.3 데이터 접근 — `lib/supabase.ts`

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(anon) 클라이언트.
- `persistSession: true`, `autoRefreshToken: true`.

### 2.4 기존 페이지 패턴 — `app/admin/{studios,teachers,knowledge}/page.tsx`

- `"use client"` + `<AdminShell>` 래핑.
- 상단 제목 + 검색/상태 필터 → 데이터 테이블.
- 테이블 헤더: `text-[11px] uppercase tracking-wider text-neutral-500`.
- 상태 배지: emerald(정상/승인) · red(정지/거절) · amber(대기) · neutral(기타).
- 액션: 인라인 `textarea` 메모 + 버튼, 처리 중 `disabled` + "처리 중…".
- 오류: `border-red-900/50 bg-red-950/40` 빨간 박스.
- 교차 사용자 정보 조회는 RPC `admin_get_users_info(p_user_ids)` 사용.

### 2.5 기술 스택

Next.js 15(App Router) · React 19 · TypeScript · Tailwind 3 · Radix UI · lucide-react · recharts(차트) · sonner(토스트) · `@supabase/supabase-js`.

---

## 3. ⚠️ 핵심 아키텍처 제약 — BO 백엔드 의존성

웹 BO는 **publishable(anon) 키 + RLS**로 동작한다. 어드민이 "모든 사용자"를 가로질러 읽거나 쓰려면 RLS에 막힌다. 따라서 각 신규 페이지마다 다음 중 하나가 **Supabase 쪽에 선행**되어야 한다:

1. **`app_admins` 검증을 내장한 SECURITY DEFINER RPC** (권장, 기존 `admin_get_users_info` 선례)
2. 또는 `app_admins` 멤버에게 전체 접근을 허용하는 **admin 전용 RLS 정책**

> 모든 SECURITY DEFINER RPC는 본문 첫 줄에서 `auth.uid()`가 `app_admins`에 있는지 확인하고, 없으면 예외를 던진다. 이 패턴을 표준으로 한다.

본 PRD는 페이지별로 필요한 백엔드 의존성을 함께 명세하며, 8장 부록에 통합 체크리스트로 정리한다. **프론트 페이지 구현 전에 해당 RPC/정책이 먼저 배포되어야 한다.**

---

## 4. 정보 구조 & 네비게이션

`AdminShell`의 `NAV` 확장안 (위 = 신규 진입점, 기존 3종 유지):

| 순서 | 라벨 | 경로 | 상태 |
|------|------|------|------|
| 1 | 대시보드 | `/admin/dashboard` | 신규(P2) |
| 2 | 사용자 관리 | `/admin/users` | 신규(P1) |
| 3 | 지원·신고 | `/admin/support` | 신규(P0) |
| 4 | 콘텐츠 | `/admin/content` | 신규(P1) |
| 5 | AI·앱운영 | `/admin/ai-ops` | 신규(P0) |
| 6 | 요가원 관리 | `/admin/studios` | ✅ 완료 |
| 7 | 지도자 관리 | `/admin/teachers` | ✅ 완료 |
| 8 | AI 지식베이스 | `/admin/knowledge` | ✅ 완료 |

`/admin` 진입 시 현재 `/admin/studios`로 리다이렉트 → 추후 `/admin/dashboard`로 전환(P2).

---

## 5. 공통 규약

| 항목 | 규약 |
|------|------|
| 인증 | 모든 페이지 `<AdminShell>` 래핑, `app_admins` 가드 |
| 데이터 | publishable 키 + RLS. 교차 사용자 작업은 SECURITY DEFINER RPC |
| UI | 2.4 패턴(검색/필터 → 테이블 → 상태 배지 → 인라인 액션) 준수 |
| 액션 확인 | 파괴적 액션(삭제/정지)은 사유 입력 또는 확인 단계 필수 |
| 로딩/오류 | 버튼 `disabled`+"처리 중…", 오류는 빨간 박스 + 토스트(sonner) |
| 감사 로그 | 정지/삭제 등 파괴적 액션은 사유와 함께 기록(가능한 경우 `*_audit`/`*_removals` 테이블 또는 액션 RPC가 로그 남김) |

---

## 6. 신규 BO 페이지 명세

각 페이지: **목적 / 대상 테이블·필드 / 어드민 액션 / 백엔드 의존성 / 화면 구성 / 엣지케이스**.

### 6.1 지원·신고 관리 — `/admin/support` (P0)

> `support_requests`가 `category` / `status` / `admin_response`를 이미 보유 → **가장 즉시 구현 가능**.

**목적**: 사용자가 앱에서 보낸 문의·버그·기능요청·기타를 어드민이 처리(응답 + 상태 변경).

**대상 테이블·필드**

| 테이블 | 핵심 필드 |
|--------|-----------|
| `support_requests` | id, user_id, title, content, category(`bug`/`feature`/`question`/`other`), status(`pending`/`in_progress`/`resolved`/`closed`), admin_response, created_at, updated_at |
| `user_profiles` (참조) | 요청자 이름/연락처 표시용 |

**어드민 액션**
- 상태 필터(pending/in_progress/resolved/closed), 카테고리 필터, 제목/내용 검색
- 상세 보기(요청자 정보 + 본문)
- **`admin_response` 작성 + `status` 변경**(인라인 textarea)
- 미처리(pending) 우선 정렬

**백엔드 의존성**
- 어드민 read/update: `support_requests`에 admin 전용 RLS, 또는 `admin_list_support()` / `admin_respond_support(p_id, p_response, p_status)` RPC.
- 요청자 식별: 기존 `admin_get_users_info(p_user_ids)` 재사용.

**화면 구성**: 상단 상태/카테고리 필터 탭 + 검색 → 테이블(요청자·카테고리·상태·작성일) → 행 펼침 시 본문 + 응답 폼.

**엣지케이스**: 탈퇴 사용자(user_id 무효) 요청 표시, 긴 본문 truncate, 응답 후 자동 `resolved` 제안.

---

### 6.2 AI 운영 / 앱버전 — `/admin/ai-ops` (P0)

> `ai_answer_logs`·`app_versions` 스키마 완비 → 즉시 구현 가능.

**목적**: AI 어시스턴트("옴") 답변 품질을 모니터링하고, 앱 강제 업데이트를 관리한다.

**대상 테이블·필드**

| 테이블 | 핵심 필드 |
|--------|-----------|
| `ai_answer_logs` | id, user_id, thread_id, question, answer, related_asana_ids, related_routine_ids, retrieved_document_ids, safety_notice_required, should_recommend_teacher, rating, rated_at, created_at |
| `ai_sessions` (참조) | thread_id, user_id, title — 세션 수 집계 |
| `app_versions` | platform(ios/android), min_version, store_url |

**어드민 액션**
- **AI 품질 대시보드**: 기간별 답변 수, 평균 `rating`, 저평점(rating ≤ N) 비율, `safety_notice_required` 비율, `should_recommend_teacher` 비율 (recharts).
- **드릴다운**: 저평점/안전위험 답변 목록 → question/answer/출처(`retrieved_document_ids`) 확인.
- **앱버전 관리**: 플랫폼별 `min_version` / `store_url` 편집(강제 업데이트 게이트).

**백엔드 의존성**
- 집계 RPC: `admin_ai_stats(p_from, p_to)` (SECURITY DEFINER) — 평점/안전/추천 비율 반환.
- 로그 조회: `admin_list_ai_logs(p_filter)` 또는 admin 전용 RLS(`ai_answer_logs`).
- 앱버전 쓰기: `app_versions` upsert에 admin 전용 RLS.

**화면 구성**: 상단 KPI 카드(답변수/평균평점/안전비율) + 추세 차트 → 저평점 답변 테이블 → 하단 앱버전 편집 카드(플랫폼별).

**엣지케이스**: 평점 미달린(`rating` null) 답변 제외 집계, 기간 무데이터 시 빈 차트, store_url 형식 검증.

---

### 6.3 사용자 관리 — `/admin/users` (P1)

**목적**: 전체 가입자 조회·검색, 역할 확인, 정지/차단, 어드민 권한 부여/회수.

**대상 테이블·필드**

| 테이블 | 핵심 필드 |
|--------|-----------|
| `user_profiles` | id, user_id, name, email, phone, avatar_url, created_at |
| `user_roles` | user_id, role(`teacher`/`student`/`admin`) |
| `teacher_profiles` / `student_profiles` (참조) | 역할 상세 |
| `app_admins` | user_id — 어드민 부여 대상 |
| `user_push_tokens` (참조) | 푸시 등록 여부 |

**어드민 액션**
- 검색(이름/전화/이메일), 역할 배지(teacher/student/admin)
- 사용자 상세(가입일, 역할, 연결된 지도자/스튜디오, 활동 요약)
- **정지/차단·해제**(사유 필수)
- **어드민 권한 부여/회수**(`app_admins` insert/delete)

**백엔드 의존성**
- `admin_list_users(p_query)` / `admin_get_user_detail(p_user_id)` SECURITY DEFINER RPC.
- `admin_set_user_status(p_user_id, p_status, p_reason)` — **정지 상태 저장 위치 결정 필요**:
  - 옵션 A: `user_profiles.status` 컬럼 추가(간단)
  - 옵션 B: 신규 `user_bans`(user_id, reason, banned_at, banned_by, lifted_at) — 이력 보존(권장)
- `admin_grant_admin(p_user_id)` / `admin_revoke_admin(p_user_id)`.
- 정지 사용자의 앱 접근 차단은 앱/RLS 측 연동 필요(별도 작업).

**화면 구성**: 검색 + 역할 필터 → 사용자 테이블(아바타·이름·역할·가입일·상태) → 상세 모달(역할/연결/정지 이력) + 정지·어드민 토글.

**엣지케이스**: 자기 자신 어드민 회수 방지, 마지막 어드민 회수 차단, 정지 해제 시 이력 유지.

---

### 6.4 콘텐츠 모더레이션 — `/admin/content` (P1)

**목적**: 피드(수련 기록/댓글) 등 사용자 생성 콘텐츠를 조회하고 신고 대응(숨김/삭제).

**대상 테이블·필드**

| 테이블 | 핵심 필드 |
|--------|-----------|
| `practice_records` | id, user_id, practice_date, title, asanas, states, photos, memo, created_at |
| `feed_comments` | id, record_id, user_id, parent_id, content, created_at |
| `feed_likes` (맥락) | record_id, user_id |
| `routines` (public) | id, teacher_id, title, visibility — 공개 공유물 점검 |

**어드민 액션**
- 피드 콘텐츠 조회/검색, 최신/신고순 정렬
- **숨김/삭제**(기록·댓글), 사유 기록
- 신고 누적 항목 우선 노출

**백엔드 의존성**
- `admin_list_feed(p_filter)` SECURITY DEFINER RPC.
- `admin_hide_record(p_id, p_reason)` / `admin_delete_comment(p_id, p_reason)`.
- **신고 저장소 부재** → 신규 `content_reports`(id, target_type, target_id, reporter_user_id, reason, status, created_at) 신설 제안. 앱에 신고 UI 연동 필요(별도 작업). 신고 테이블 도입 전에는 "조회 + 수동 삭제"로 시작.

**화면 구성**: 콘텐츠 타입 탭(기록/댓글) + 검색 → 테이블(작성자·내용 미리보기·작성일·신고수) → 숨김/삭제 액션.

**엣지케이스**: 사진 포함 기록 썸네일, 대댓글(parent_id) 트리, 삭제 시 연관 좋아요/댓글 처리(cascade 확인).

---

## 7. 대시보드 — `/admin/dashboard` (P2, 선택)

운영 진입 페이지. 핵심 지표 카드:
- 총 사용자 / 신규 가입(기간), 지도자·회원 수
- 요가원/스튜디오 신청 대기 건수
- 미처리 지원요청 수
- AI 답변 수 / 평균 평점
- 활성 클래스·출석 추이(선택)

`/admin` 루트 리다이렉트를 `/admin/studios` → `/admin/dashboard`로 전환.

---

## 8. 우선순위 & 단계

| 단계 | 페이지 | 근거 |
|------|--------|------|
| **P0** | 6.1 지원·신고 | `support_requests` 스키마(category/status/admin_response) 완비, 운영 즉시 필요 |
| **P0** | 6.2 AI·앱버전 | `ai_answer_logs`·`app_versions` 완비, 집계 RPC만 추가 |
| **P1** | 6.3 사용자 관리 | 정지 저장소 결정 + RPC 신설 선행 |
| **P1** | 6.4 콘텐츠 모더레이션 | 신고 테이블 신설 검토 + 앱 연동 |
| **P2** | 7. 대시보드 | P0~P1 데이터 확보 후 집계 |

권장 진행 순서: **6.1 → 6.2 → 6.3 → 6.4 → 7**. 각 페이지는 백엔드 의존성(RPC/RLS) 배포 후 프론트 구현.

---

## 9. 부록 — BO 백엔드 의존성 체크리스트

프론트 구현 전 Supabase에 선행되어야 할 작업.

### 9.1 신규 SECURITY DEFINER RPC (app_admins 검증 내장)

| 페이지 | RPC | 역할 |
|--------|-----|------|
| 지원 | `admin_list_support(p_filter)` | 전체 지원요청 조회 |
| 지원 | `admin_respond_support(p_id, p_response, p_status)` | 응답+상태 변경 |
| AI | `admin_ai_stats(p_from, p_to)` | 답변 품질 집계 |
| AI | `admin_list_ai_logs(p_filter)` | 저평점/안전 로그 조회 |
| 사용자 | `admin_list_users(p_query)` | 사용자 검색 |
| 사용자 | `admin_get_user_detail(p_user_id)` | 상세 |
| 사용자 | `admin_set_user_status(p_user_id, p_status, p_reason)` | 정지/해제 |
| 사용자 | `admin_grant_admin(p_user_id)` / `admin_revoke_admin(p_user_id)` | 어드민 토글 |
| 콘텐츠 | `admin_list_feed(p_filter)` | 피드 조회 |
| 콘텐츠 | `admin_hide_record(p_id, p_reason)` / `admin_delete_comment(p_id, p_reason)` | 숨김/삭제 |
| (기존) | `admin_get_users_info(p_user_ids)` | ✅ 재사용 |

### 9.2 신규 RLS 정책 (대안/보완)

- `app_versions` — `app_admins` 멤버 upsert 허용
- (선택) `support_requests`, `ai_answer_logs` — admin 전용 read/update

### 9.3 신규 컬럼/테이블 (결정 필요)

| 항목 | 옵션 | 비고 |
|------|------|------|
| 사용자 정지 | A) `user_profiles.status` 컬럼 / B) `user_bans` 테이블 | B 권장(이력 보존) |
| 콘텐츠 신고 | 신규 `content_reports` 테이블 | 앱 신고 UI 연동 필요 |
| 콘텐츠 숨김 | `practice_records.hidden_at` 등 soft-hide 컬럼 | 삭제 대신 숨김 지원 시 |

---

## 10. 검증 (Verification)

- 각 페이지 명세가 실재 Supabase 테이블·필드를 참조하는지 교차 확인(앱 코드 기준: `support_requests.admin_response`, `app_versions.min_version`, `ai_answer_logs.rating` 확인됨).
- 신규 RPC는 비-어드민 호출 시 예외를 던지는지 테스트.
- 각 페이지가 기존 BO 패턴(AdminShell 래핑 / app_admins 인증 / RPC 우회)과 일관되는지 점검.
- P0 페이지부터 백엔드 의존성 배포 → 프론트 구현 → 테스트 어드민 계정(`01000000000`)으로 E2E 확인.

---

## 11. 참고 — 앱 기능 ↔ BO 매핑 요약

| 앱 영역 (`onmatout_rn`) | 관련 테이블 | BO 대응 |
|------------------------|-------------|---------|
| 인증/역할 | user_profiles, user_roles, app_admins | 6.3 사용자 관리 |
| 지원/피드백 | support_requests | 6.1 지원·신고 |
| 피드/소셜 | practice_records, feed_comments, feed_likes | 6.4 콘텐츠 모더레이션 |
| AI 어시스턴트 | ai_answer_logs, ai_sessions, knowledge_documents | 6.2 AI 운영 + (기존)지식베이스 |
| 앱 배포 | app_versions | 6.2 앱버전 |
| 요가원/스튜디오 | pivot_studios, studio_applications, studio_teachers | ✅ 요가원·지도자 관리(완료) |
| 클래스/출석/수업권 | classes, attendance, memberships | (향후) 지도자 운영 통계 — 본 PRD 비범위 |
| 루틴 | routines, routine_items, routine_shares | 6.4 공개 루틴 점검(부분) |
