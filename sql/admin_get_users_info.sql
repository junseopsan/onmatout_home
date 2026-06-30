-- 관리자용: user_id 목록 → (user_id, phone, name) 조회
-- auth.users + user_profiles 를 SECURITY DEFINER 로 조인한다.
--
-- 주의: user_profiles.name 은 varchar(50), auth.users.phone 은 text 라
-- RETURNS TABLE(... text) 와 타입을 맞추기 위해 ::text 로 캐스팅해야 한다.
-- (캐스팅이 없으면 "structure of query does not match function result type" 발생)
--
-- 운영·개발 모두 적용됨 (migration: fix_admin_get_users_info_name_cast).

CREATE OR REPLACE FUNCTION public.admin_get_users_info(p_user_ids uuid[])
 RETURNS TABLE(user_id uuid, phone text, name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT
      u.id,
      u.phone::text,
      (SELECT up.name::text FROM public.user_profiles up WHERE up.user_id = u.id LIMIT 1)
    FROM auth.users u
    WHERE u.id = ANY (p_user_ids);
END;
$function$;
