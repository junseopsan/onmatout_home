-- 아사나 관리 BO 페이지용 백엔드
-- - asanas: 공개 read 유지 + 어드민 쓰기(INSERT/UPDATE/DELETE) 허용
-- - asanacategory: 공개 read (드롭다운용) + 어드민 쓰기
-- Supabase SQL Editor에서 1회 실행. 재실행 안전.
--
-- 전제: is_app_admin() 헬퍼가 이미 존재함(admin_rbac.sql 등에서 정의).
--       실제 배포된 정의는 public.app_admins 테이블 기준이다.
--       이 파일에서는 함수를 재정의하지 않는다(잘못 덮어쓰면 어드민 전체가 깨짐).
--
--   create or replace function public.is_app_admin() returns boolean ...
--     select exists (select 1 from public.app_admins where user_id = auth.uid());

-- =========================================
-- asanas
-- =========================================
ALTER TABLE public.asanas ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 (앱이 anon 키로 조회) — 기존 동작 보존
DROP POLICY IF EXISTS "asanas public read" ON public.asanas;
CREATE POLICY "asanas public read" ON public.asanas
  FOR SELECT USING (true);

-- 어드민 쓰기 (app_admins 기준 is_app_admin())
DROP POLICY IF EXISTS "Admins manage asanas" ON public.asanas;
CREATE POLICY "Admins manage asanas" ON public.asanas
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- =========================================
-- asanacategory (드롭다운)
-- =========================================
ALTER TABLE public.asanacategory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asanacategory public read" ON public.asanacategory;
CREATE POLICY "asanacategory public read" ON public.asanacategory
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage asanacategory" ON public.asanacategory;
CREATE POLICY "Admins manage asanacategory" ON public.asanacategory
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- 확인
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('asanas', 'asanacategory')
ORDER BY tablename, cmd, policyname;
