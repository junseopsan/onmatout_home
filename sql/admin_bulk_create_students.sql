-- 회원 명단(student_profiles) 일괄 등록 BO 기능용 백엔드
-- - admin_bulk_create_students(): 어드민이 특정 지도자 명의로 회원 카드 일괄 생성
--   · student_profiles INSERT RLS 는 teacher_id = auth.uid() 만 허용하므로
--     어드민(다른 uid)은 SECURITY DEFINER RPC 로만 대리 생성 가능.
--   · 초대코드(invite_code)는 기존 BEFORE INSERT 트리거가 자동 생성.
--   · teacher_id + phone 중복은 건너뜀.
-- - student_profiles 어드민 SELECT RLS (지도자별 기존 회원 미리보기용)
-- Supabase SQL Editor에서 1회 실행. 재실행 안전.

-- 어드민 판별 헬퍼 (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_app_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- 어드민: student_profiles 전체 조회 (지도자별 기존 회원 수/명단 확인)
DROP POLICY IF EXISTS "Admins can view all student_profiles" ON public.student_profiles;
CREATE POLICY "Admins can view all student_profiles" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (public.is_app_admin());

-- 일괄 등록 RPC
-- p_rows: [{ "name": "홍길동", "phone": "01012345678", "memo": "..." }, ...]
-- p_with_consent: 전화번호 수집 동의 확보 여부 (true 면 phone 있는 행에 phone_consent_at 기록)
-- 반환: { created_count, skipped_count, created: [{ id, name, phone, invite_code }] }
CREATE OR REPLACE FUNCTION public.admin_bulk_create_students(
  p_teacher_id  uuid,
  p_rows        jsonb,
  p_with_consent boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     jsonb;
  v_name    text;
  v_phone   text;
  v_memo    text;
  v_created jsonb := '[]'::jsonb;
  v_created_count int := 0;
  v_skipped_count int := 0;
  v_new_id   uuid;
  v_new_code text;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  IF p_teacher_id IS NULL THEN
    RAISE EXCEPTION 'teacher_id is required';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  LOOP
    v_name  := nullif(btrim(coalesce(v_row->>'name', '')), '');
    v_phone := nullif(regexp_replace(coalesce(v_row->>'phone', ''), '[^0-9]', '', 'g'), '');
    v_memo  := nullif(btrim(coalesce(v_row->>'memo', '')), '');

    -- 이름 없으면 스킵
    IF v_name IS NULL THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- 동일 지도자 + 동일 전화번호 중복 스킵
    IF v_phone IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.student_profiles s
      WHERE s.teacher_id = p_teacher_id AND s.phone = v_phone
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.student_profiles (
      teacher_id, name, phone, phone_consent_at, memo, status
    )
    VALUES (
      p_teacher_id,
      v_name,
      v_phone,
      CASE WHEN p_with_consent AND v_phone IS NOT NULL THEN now() ELSE NULL END,
      v_memo,
      'active'
    )
    RETURNING id, invite_code INTO v_new_id, v_new_code;

    v_created := v_created || jsonb_build_object(
      'id', v_new_id, 'name', v_name, 'phone', v_phone, 'invite_code', v_new_code
    );
    v_created_count := v_created_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'created_count', v_created_count,
    'skipped_count', v_skipped_count,
    'created', v_created
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_create_students(uuid, jsonb, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_bulk_create_students(uuid, jsonb, boolean) TO authenticated;

-- 확인
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE proname = 'admin_bulk_create_students';
