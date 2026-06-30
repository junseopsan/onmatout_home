-- BO 시퀀스(routines) 관리 RLS
-- - super_admin: 앱의 모든 시퀀스 조회·수정·삭제 (is_app_admin override)
-- - studio_owner(원장): 본인 명의(teacher_id = auth.uid()) 시퀀스만 관리
--   → 기존 routines_*_teacher / routine_items_*_teacher 정책으로 이미 커버됨.
-- 기존 teacher 스코프 정책과 OR 로 공존하도록 admin override 정책만 추가.
-- admin_rbac.sql 적용(=is_app_admin 가 bo_users 기준) 이후 실행. 재실행 안전.

-- routines: super_admin 전체 관리
DROP POLICY IF EXISTS "routines_admin_all" ON public.routines;
CREATE POLICY "routines_admin_all" ON public.routines
  FOR ALL TO authenticated
  USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

-- routine_items: super_admin 전체 관리
DROP POLICY IF EXISTS "routine_items_admin_all" ON public.routine_items;
CREATE POLICY "routine_items_admin_all" ON public.routine_items
  FOR ALL TO authenticated
  USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
