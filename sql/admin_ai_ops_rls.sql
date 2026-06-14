-- AI 운영 / 앱버전 BO 페이지용 어드민 RLS
-- - ai_answer_logs: app_admins 멤버 전체 조회 (기존엔 본인 로그만 SELECT 가능)
-- - app_versions:   app_admins 멤버 INSERT/UPDATE/DELETE (강제 업데이트 관리)
-- Supabase SQL Editor에서 1회 실행. 재실행 안전.
--
-- 전제: is_app_admin() 헬퍼가 있어야 함. (admin_support_requests_rls.sql 에서 생성)
--       아래에 동일 정의를 포함하므로 이 파일만 단독 실행해도 동작함.

-- 어드민 판별 헬퍼 (SECURITY DEFINER — RLS 재귀 방지). 이미 있으면 갱신.
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_admins a
    WHERE a.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- ai_answer_logs: 어드민 전체 조회
DROP POLICY IF EXISTS "Admins can view all ai answer logs" ON public.ai_answer_logs;
CREATE POLICY "Admins can view all ai answer logs" ON public.ai_answer_logs
  FOR SELECT TO authenticated
  USING (public.is_app_admin());

-- app_versions: 어드민 쓰기 (읽기는 기존 공개 정책 유지)
DROP POLICY IF EXISTS "Admins can insert app versions" ON public.app_versions;
CREATE POLICY "Admins can insert app versions" ON public.app_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS "Admins can update app versions" ON public.app_versions;
CREATE POLICY "Admins can update app versions" ON public.app_versions
  FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS "Admins can delete app versions" ON public.app_versions;
CREATE POLICY "Admins can delete app versions" ON public.app_versions
  FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- 확인
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ai_answer_logs', 'app_versions')
ORDER BY tablename, cmd, policyname;
