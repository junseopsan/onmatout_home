-- 사용자 관리 BO 페이지용 백엔드 (옵션 B: user_bans 이력 테이블)
-- - user_bans 테이블 신설 (정지 이력 보존)
-- - user_profiles / user_roles / app_admins 에 어드민 조회·관리 RLS
-- - is_user_banned(uuid) 헬퍼 (추후 앱/RLS 차단 연동용)
-- Supabase SQL Editor에서 1회 실행. 재실행 안전.
--
-- 전제: app_admins(user_id uuid) 존재. is_app_admin() 헬퍼 포함(단독 실행 가능).

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

-- =========================================
-- 1. user_bans — 정지 이력 (lifted_at IS NULL = 현재 정지중)
-- =========================================
CREATE TABLE IF NOT EXISTS public.user_bans (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     text,
  banned_by  uuid REFERENCES auth.users(id),
  banned_at  timestamptz NOT NULL DEFAULT now(),
  lifted_at  timestamptz,
  lifted_by  uuid REFERENCES auth.users(id)
);

-- 사용자당 활성 정지는 1건만 (해제 후 재정지 가능)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_bans_active
  ON public.user_bans(user_id)
  WHERE lifted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_bans_user_id ON public.user_bans(user_id);

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage user bans" ON public.user_bans;
CREATE POLICY "Admins manage user bans" ON public.user_bans
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- 정지 여부 헬퍼 (추후 앱/다른 테이블 RLS 에서 차단에 활용)
CREATE OR REPLACE FUNCTION public.is_user_banned(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_bans b
    WHERE b.user_id = p_user_id AND b.lifted_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_user_banned(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_user_banned(uuid) TO authenticated;

-- =========================================
-- 2. 어드민 조회 RLS (기존 본인-한정 정책에 OR 로 추가됨)
-- =========================================
DROP POLICY IF EXISTS "Admins can view all user_profiles" ON public.user_profiles;
CREATE POLICY "Admins can view all user_profiles" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (public.is_app_admin());

DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;
CREATE POLICY "Admins can view all user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_app_admin());

-- =========================================
-- 3. app_admins — 어드민이 조회/부여/회수
-- =========================================
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view app_admins" ON public.app_admins;
CREATE POLICY "Admins can view app_admins" ON public.app_admins
  FOR SELECT TO authenticated
  USING (public.is_app_admin());

DROP POLICY IF EXISTS "Admins can grant app_admins" ON public.app_admins;
CREATE POLICY "Admins can grant app_admins" ON public.app_admins
  FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS "Admins can revoke app_admins" ON public.app_admins;
CREATE POLICY "Admins can revoke app_admins" ON public.app_admins
  FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- 확인
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_bans', 'user_profiles', 'user_roles', 'app_admins')
ORDER BY tablename, cmd, policyname;
