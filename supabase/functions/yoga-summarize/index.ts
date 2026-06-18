// supabase/functions/yoga-summarize/index.ts
//
// 어드민 전용 — 서적/문서의 원문 한 섹션을 받아, 저작권 안전한 "재서술 요약 노트"
// 초안으로 변환한다. 실제 적재는 하지 않음 (어드민이 검토·수정 후 yoga-ingest 로 적재).
// 원문 텍스트는 변환 입력으로만 쓰고 어디에도 저장하지 않는다.
//
// 입력: POST { text: string, book_title?: string, source_type?: string }
//      Authorization: Bearer <admin JWT>
// 출력: { title, content, safety, drop }
//
// 필요 env: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//          (yoga-ingest / yoga-distill 과 동일 — 추가 설정 불필요)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const LLM_MODEL = "gpt-4o-mini";
const MAX_INPUT = 16000; // 한 섹션 원문 입력 상한 (그 이상은 잘라서 전달)
const MAX_OUTPUT = 7000; // 요약 content 상한 (yoga-ingest 의 8000 제한 하한 여유)

const SYSTEM_PROMPT = `당신은 요가 지식베이스 큐레이터입니다.
요가 서적/문서의 원문 한 부분을 받아, 옴톡(요가 AI)이 답변 근거로 쓸 수 있는
"재서술된 한국어 요약 노트" 로 변환하세요.

저작권/품질 규칙:
- 원문 문장을 그대로 베끼지 마세요. 핵심 개념·사실·지침을 당신의 표현으로 다시 쓰세요(패러프레이즈).
- 긴 구절을 토씨까지 복사하지 마세요. 인용이 꼭 필요하면 한 문장 이내로 최소화.
- 원문에 없는 내용을 지어내지 마세요. 불확실하면 일반적 범위로만.
- 한국어. 검색에 도움되는 짧은 제목 + 1~4개 짧은 단락의 핵심 정리.
- 의료/부상/통증/임신/만성질환/금기 등 안전이 민감한 주제가 포함되면 safety=true.
- 이 섹션이 목차·색인·판권·머리말 등 지식 가치가 없거나 의미를 파악할 수 없으면 drop=true.

반드시 아래 JSON 객체만 출력:
{"title": string, "content": string, "safety": boolean, "drop": boolean}`;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  try {
    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("필수 env 누락");
    }

    const token = (req.headers.get("Authorization") ?? "").replace(
      /^Bearer\s+/i,
      "",
    );
    if (!token) return json({ error: "unauthenticated" }, 401);

    const authClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "invalid token" }, 401);

    // 어드민(app_admins) 확인
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: adminRow } = await admin
      .from("app_admins")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!adminRow) return json({ error: "forbidden" }, 403);

    const body = await req.json();
    const rawText = (body?.text ?? "").toString().trim();
    const bookTitle = (body?.book_title ?? "").toString().trim();
    if (!rawText) return json({ error: "text 필수" }, 400);

    const text = rawText.slice(0, MAX_INPUT);
    const userContent =
      (bookTitle ? `출처(서적): ${bookTitle}\n\n` : "") +
      `원문 섹션:\n${text}`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!r.ok) {
      throw new Error(`llm failed (${r.status}): ${await r.text()}`);
    }
    const j = await r.json();
    const raw = j?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { title?: string; content?: string; safety?: boolean; drop?: boolean };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("summarize JSON 파싱 실패");
    }

    return json({
      title: (parsed.title ?? "").toString().slice(0, 300),
      content: (parsed.content ?? "").toString().slice(0, MAX_OUTPUT),
      safety: !!parsed.safety,
      drop: !!parsed.drop,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
