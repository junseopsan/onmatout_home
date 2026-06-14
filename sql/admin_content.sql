-- 콘텐츠 모더레이션 BO 페이지용 백엔드 (soft-hide 방식)
-- - practice_records / feed_comments 에 hidden_at/hidden_by/hidden_reason 컬럼 추가
-- - 어드민 전체 조회 + 숨김 처리(UPDATE) RLS
-- Supabase SQL Editor에서 1회 실행. 재실행 안전.
--
-- ⚠️ 실제 "숨김"이 앱에 반영되려면, 앱의 피드/기록 조회 쿼리가
--    `hidden_at IS NULL` 조건을 추가해야 합니다 (앱 측 별도 작업).

-- 어드민 판별 헬퍼 (SECURITY DEFINER)
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
-- 1. soft-hide 컬럼 추가
-- =========================================
ALTER TABLE public.practice_records
  ADD COLUMN IF NOT EXISTS hidden_at     timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by     uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hidden_reason text;

ALTER TABLE public.feed_comments
  ADD COLUMN IF NOT EXISTS hidden_at     timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by     uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hidden_reason text;

CREATE INDEX IF NOT EXISTS idx_practice_records_hidden_at
  ON public.practice_records(hidden_at);
CREATE INDEX IF NOT EXISTS idx_feed_comments_hidden_at
  ON public.feed_comments(hidden_at);

-- =========================================
-- 2. 어드민 조회 RLS (기존 본인-한정 정책에 OR 로 추가)
-- =========================================
DROP POLICY IF EXISTS "Admins can view all practice_records" ON public.practice_records;
CREATE POLICY "Admins can view all practice_records" ON public.practice_records
  FOR SELECT TO authenticated
  USING (public.is_app_admin());

DROP POLICY IF EXISTS "Admins can view all feed_comments" ON public.feed_comments;
CREATE POLICY "Admins can view all feed_comments" ON public.feed_comments
  FOR SELECT TO authenticated
  USING (public.is_app_admin());

-- =========================================
-- 3. 어드민 숨김 처리 RLS (UPDATE)
-- =========================================
DROP POLICY IF EXISTS "Admins can moderate practice_records" ON public.practice_records;
CREATE POLICY "Admins can moderate practice_records" ON public.practice_records
  FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS "Admins can moderate feed_comments" ON public.feed_comments;
CREATE POLICY "Admins can moderate feed_comments" ON public.feed_comments
  FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- 확인
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('practice_records', 'feed_comments')
  AND policyname ILIKE 'Admins%'
ORDER BY tablename, cmd;
