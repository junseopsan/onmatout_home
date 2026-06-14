-- BO 역할 기반 접근제어(RBAC) + 메뉴 권한 + 원장 스코프
-- - bo_users: BO 멤버십 + 역할 (super_admin | studio_owner) — 단일 진실원천
-- - bo_menu_overrides: 사용자별 메뉴 예외
-- - is_app_admin() 를 bo_users(super_admin) 기준으로 재정의 (기존 정책 그대로 동작)
-- - 원장(studio_owner) 스코프 RLS: pivot_studios / studio_teachers / student_profiles
-- - admin_bulk_create_students RPC: 원장도 본인 요가원 지도자에 한해 허용
-- Supabase SQL Editor에서 1회 실행. 재실행 안전.
--
-- ⚠️ 다른 admin_*.sql 들과 함께 적용하세요. (헬퍼 재정의가 포함되어 순서 무관)

-- =========================================
-- 1. 테이블
-- =========================================
CREATE TABLE IF NOT EXISTS public.bo_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('super_admin', 'studio_owner')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.bo_menu_overrides (
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_key text NOT NULL,
  allowed  boolean NOT NULL,
  PRIMARY KEY (user_id, menu_key)
);

-- 기존 app_admins → bo_users(super_admin) 시드 (현재 어드민 접근 보존)
INSERT INTO public.bo_users (user_id, role)
SELECT a.user_id, 'super_admin'
FROM public.app_admins a
ON CONFLICT (user_id) DO NOTHING;

-- 테스트 계정(01000000000)을 super_admin 으로 보장 (개발/심사 편의)
-- 클라이언트 폴백과 별개로, DB RLS(is_app_admin) 통과를 위해 필요.
INSERT INTO public.bo_users (user_id, role)
VALUES ('7ec451a9-5895-40f5-bbc0-b6605c1407ed', 'super_admin')
ON CONFLICT (user_id) DO NOTHING;

-- =========================================
-- 2. 헬퍼 (SECURITY DEFINER — RLS 재귀 방지)
-- =========================================

-- super_admin 판별 (기존 모든 admin_*.sql 정책이 이 함수를 사용)
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bo_users u
    WHERE u.user_id = auth.uid() AND u.role = 'super_admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_app_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- BO 사용자 여부 (역할 무관 — 로그인 허용 판정)
CREATE OR REPLACE FUNCTION public.is_bo_user()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.bo_users u WHERE u.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_bo_user() FROM public;
GRANT EXECUTE ON FUNCTION public.is_bo_user() TO authenticated;

-- 현재 사용자 역할
CREATE OR REPLACE FUNCTION public.bo_role()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT u.role FROM public.bo_users u WHERE u.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.bo_role() FROM public;
GRANT EXECUTE ON FUNCTION public.bo_role() TO authenticated;

-- 해당 지도자가 auth.uid()(원장)의 요가원 소속인지 (또는 본인)
CREATE OR REPLACE FUNCTION public.owns_studio_teacher(p_teacher_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT
    p_teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.studio_teachers st
      JOIN public.pivot_studios s ON s.id = st.studio_id
      WHERE s.owner_id = auth.uid() AND st.teacher_id = p_teacher_id
    );
$$;
REVOKE ALL ON FUNCTION public.owns_studio_teacher(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.owns_studio_teacher(uuid) TO authenticated;

-- =========================================
-- 3. bo_users / bo_menu_overrides RLS
-- =========================================
ALTER TABLE public.bo_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bo_menu_overrides ENABLE ROW LEVEL SECURITY;

-- 본인 row 조회(AdminShell 컨텍스트용) — is_app_admin 호출 없이 재귀 방지
DROP POLICY IF EXISTS "bo_users self select" ON public.bo_users;
CREATE POLICY "bo_users self select" ON public.bo_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- super_admin 전체 관리
DROP POLICY IF EXISTS "bo_users admin all" ON public.bo_users;
CREATE POLICY "bo_users admin all" ON public.bo_users
  FOR ALL TO authenticated
  USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS "bo_menu_overrides self select" ON public.bo_menu_overrides;
CREATE POLICY "bo_menu_overrides self select" ON public.bo_menu_overrides
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bo_menu_overrides admin all" ON public.bo_menu_overrides;
CREATE POLICY "bo_menu_overrides admin all" ON public.bo_menu_overrides
  FOR ALL TO authenticated
  USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

-- =========================================
-- 4. 원장 스코프 RLS (super 정책과 OR 로 공존)
-- =========================================

-- pivot_studios: 본인 소유 요가원
DROP POLICY IF EXISTS "Owner can view own studios" ON public.pivot_studios;
CREATE POLICY "Owner can view own studios" ON public.pivot_studios
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner can update own studios" ON public.pivot_studios;
CREATE POLICY "Owner can update own studios" ON public.pivot_studios
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- studio_teachers: 본인 소유 요가원의 지도자
DROP POLICY IF EXISTS "Owner can view own studio teachers" ON public.studio_teachers;
CREATE POLICY "Owner can view own studio teachers" ON public.studio_teachers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pivot_studios s
    WHERE s.id = studio_teachers.studio_id AND s.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Owner can remove own studio teachers" ON public.studio_teachers;
CREATE POLICY "Owner can remove own studio teachers" ON public.studio_teachers
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pivot_studios s
    WHERE s.id = studio_teachers.studio_id AND s.owner_id = auth.uid()
  ));

-- student_profiles: 본인 요가원 지도자의 회원 (또는 본인이 지도자인 경우)
DROP POLICY IF EXISTS "Owner can view own studio students" ON public.student_profiles;
CREATE POLICY "Owner can view own studio students" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (public.owns_studio_teacher(student_profiles.teacher_id));

-- =========================================
-- 5. 일괄 등록 RPC — super_admin OR 본인 요가원 지도자 대상 원장
-- =========================================
CREATE OR REPLACE FUNCTION public.admin_bulk_create_students(
  p_teacher_id  uuid,
  p_rows        jsonb,
  p_with_consent boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row jsonb; v_name text; v_phone text; v_memo text;
  v_created jsonb := '[]'::jsonb;
  v_created_count int := 0; v_skipped_count int := 0;
  v_new_id uuid; v_new_code text;
BEGIN
  -- 권한: super_admin 이거나, 대상 지도자가 본인 요가원 소속인 원장
  IF NOT (public.is_app_admin() OR public.owns_studio_teacher(p_teacher_id)) THEN
    RAISE EXCEPTION 'forbidden: not allowed for this teacher';
  END IF;
  IF p_teacher_id IS NULL THEN
    RAISE EXCEPTION 'teacher_id is required';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  LOOP
    v_name  := nullif(btrim(coalesce(v_row->>'name', '')), '');
    v_phone := nullif(regexp_replace(coalesce(v_row->>'phone', ''), '[^0-9]', '', 'g'), '');
    v_memo  := nullif(btrim(coalesce(v_row->>'memo', '')), '');

    IF v_name IS NULL THEN
      v_skipped_count := v_skipped_count + 1; CONTINUE;
    END IF;
    IF v_phone IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.student_profiles s
      WHERE s.teacher_id = p_teacher_id AND s.phone = v_phone
    ) THEN
      v_skipped_count := v_skipped_count + 1; CONTINUE;
    END IF;

    INSERT INTO public.student_profiles (teacher_id, name, phone, phone_consent_at, memo, status)
    VALUES (
      p_teacher_id, v_name, v_phone,
      CASE WHEN p_with_consent AND v_phone IS NOT NULL THEN now() ELSE NULL END,
      v_memo, 'active'
    )
    RETURNING id, invite_code INTO v_new_id, v_new_code;

    v_created := v_created || jsonb_build_object(
      'id', v_new_id, 'name', v_name, 'phone', v_phone, 'invite_code', v_new_code);
    v_created_count := v_created_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'created_count', v_created_count,
    'skipped_count', v_skipped_count,
    'created', v_created);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_bulk_create_students(uuid, jsonb, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_bulk_create_students(uuid, jsonb, boolean) TO authenticated;

-- =========================================
-- 6. 확인
-- =========================================
SELECT 'bo_users' AS t, role, count(*) FROM public.bo_users GROUP BY role
UNION ALL
SELECT 'overrides', null, count(*) FROM public.bo_menu_overrides;
