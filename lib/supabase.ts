import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (typeof window !== "undefined") {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    // 브라우저에서만 console 에 명확히 띄움 (SSR 빌드 타임엔 false negative 가능하므로)
    // eslint-disable-next-line no-console
    console.error(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 가 비어있습니다. " +
        ".env.local (또는 .env.development) 를 확인하고 'npm run dev' 를 재시작해주세요.\n" +
        "현재 값: URL=" +
        JSON.stringify(SUPABASE_URL) +
        ", KEY=" +
        (SUPABASE_KEY ? "(set)" : "(missing)"),
    );
  } else if (SUPABASE_URL.includes("placeholder")) {
    // eslint-disable-next-line no-console
    console.error(
      "[supabase] placeholder URL 이 잡혔습니다. 실제 프로젝트 URL 로 바꿔주세요.",
    );
  }
}

export const supabase = createClient(
  SUPABASE_URL ?? "https://placeholder.supabase.co",
  SUPABASE_KEY ?? "placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);
