import { createClient } from "@supabase/supabase-js";

// 서버(랜딩/OG)에서 공개 시퀀스 제목을 읽기 위한 익명 클라이언트.
// RLS: routines_select_public_anon (visibility='public') 로 anon SELECT 허용됨.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export interface RoutineMeta {
  title: string;
}

export async function getRoutineMeta(id: string): Promise<RoutineMeta | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY || !id) return null;
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("routines")
      .select("title")
      .eq("id", id)
      .maybeSingle();
    if (error || !data?.title) return null;
    return { title: data.title };
  } catch {
    return null;
  }
}
