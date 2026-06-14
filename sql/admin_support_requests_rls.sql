-- 지원·신고 BO 페이지용 어드민 RLS
-- support_requests 테이블에 app_admins 멤버 전체 조회/수정 권한 부여.
-- Supabase SQL Editor에서 1회 실행. (재실행 안전 — DROP IF EXISTS 포함)
--
-- 전제: app_admins(user_id uuid) 테이블이 존재하고, BO 로그인 사용자의
--       auth.uid() 가 app_admins 에 등록되어 있어야 함 (lib/adminAuth.ts 와 동일).

-- 어드민 판별 헬퍼 (SECURITY DEFINER — RLS 재귀 방지)
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

-- 어드민: 모든 지원·신고 조회
DROP POLICY IF EXISTS "Admins can view all support requests" ON support_requests;
CREATE POLICY "Admins can view all support requests" ON support_requests
  FOR SELECT
  USING (public.is_app_admin());

-- 어드민: 모든 지원·신고 수정 (admin_response 작성 + status 변경)
DROP POLICY IF EXISTS "Admins can update all support requests" ON support_requests;
CREATE POLICY "Admins can update all support requests" ON support_requests
  FOR UPDATE
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- 확인
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'support_requests' AND schemaname = 'public'
ORDER BY cmd, policyname;
