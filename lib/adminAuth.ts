import { supabase } from "./supabase";
import {
  resolveMenus,
  type BoMenu,
  type BoRole,
  type MenuOverride,
} from "./boMenus";

// 빈 문자열이면 ?? 가 무시되므로 명시적으로 trim + fallback
const RAW_TEST_PHONE = (
  process.env.NEXT_PUBLIC_ADMIN_TEST_PHONE ?? ""
).trim();
const TEST_PHONE = RAW_TEST_PHONE.length > 0 ? RAW_TEST_PHONE : "01000000000";
const TEST_PASSWORD = "Test1234!"; // 모바일 앱과 동일한 테스트 계정 비밀번호
const TEST_CODE = "000000";

// 항상 테스트 번호로 취급할 정규화된 형태들 (환경변수와 무관하게)
const HARDCODED_TEST_DIGITS = new Set([
  "01000000000",
  "1000000000",
  "821000000000",
]);

// 한국 휴대폰 번호를 supabase auth 가 사용하는 E.164 (앞에 + 포함) 형태로 변환
// 01012345678 → +821012345678
function toE164KR(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("82")) return `+${digits}`;
  if (digits.startsWith("0")) return `+82${digits.slice(1)}`;
  return `+82${digits}`;
}

function isTestPhone(phone: string) {
  const digits = phone.replace(/[^0-9]/g, "");
  if (HARDCODED_TEST_DIGITS.has(digits)) return true;
  return digits === TEST_PHONE.replace(/[^0-9]/g, "");
}

// 01000000000 테스트 계정의 실제 user_id (DB 등록값)
const TEST_USER_ID = "7ec451a9-5895-40f5-bbc0-b6605c1407ed";

// 현재 세션이 테스트 계정인지 — bo_users 등록 없이도 super_admin 으로 통과시키기 위함
function isTestSession(
  session: { user?: { id?: string | null; phone?: string | null } } | null,
): boolean {
  if (!session?.user) return false;
  if (session.user.id === TEST_USER_ID) return true;
  return isTestPhone(session.user.phone ?? "");
}

export const adminAuth = {
  isTestPhone,
  testCode() {
    return TEST_CODE;
  },

  // 인증번호 요청
  async requestOtp(phone: string) {
    if (isTestPhone(phone)) {
      return {
        sent: true,
        hint: `테스트 코드: ${TEST_CODE}`,
        mode: "test" as const,
      };
    }
    // 실제 번호 → Supabase Phone OTP
    const phoneE164 = toE164KR(phone);
    const { error } = await supabase.auth.signInWithOtp({
      phone: phoneE164,
      options: {
        // 새 계정 생성은 차단 (어드민 BO에서는 등록된 어드민만 로그인)
        shouldCreateUser: false,
      },
    });
    if (error) {
      // SMS 게이트웨이 미설정 / 등록되지 않은 번호 등
      throw new Error(
        error.message ||
          "인증번호를 보내지 못했어요. SMS 제공자 설정 또는 등록된 어드민 번호인지 확인해주세요.",
      );
    }
    return { sent: true, hint: null, mode: "sms" as const };
  },

  // 인증번호 확인 + 로그인 + 어드민 권한 체크
  async verifyAndSignIn(phone: string, code: string) {
    const phoneE164 = toE164KR(phone);

    let sessionUserId: string | null = null;

    if (isTestPhone(phone)) {
      if (code.trim() !== TEST_CODE) {
        throw new Error("인증번호가 일치하지 않습니다.");
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: phoneE164,
        password: TEST_PASSWORD,
      });
      if (error) throw error;
      if (!data.session) throw new Error("세션을 가져오지 못했어요.");
      sessionUserId = data.session.user.id;
    } else {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneE164,
        token: code.trim(),
        type: "sms",
      });
      if (error) throw error;
      if (!data.session) throw new Error("세션을 가져오지 못했어요.");
      sessionUserId = data.session.user.id;
    }

    // 테스트 계정은 bo_users 등록 없이도 통과 (개발/심사 편의)
    if (isTestPhone(phone)) {
      const { data: session } = await supabase.auth.getSession();
      return session.session;
    }

    // BO 멤버십 확인 (역할 무관: super_admin | studio_owner)
    const { data: boRow, error: boErr } = await supabase
      .from("bo_users")
      .select("user_id")
      .eq("user_id", sessionUserId)
      .maybeSingle();
    if (boErr) throw boErr;
    if (!boRow) {
      await supabase.auth.signOut();
      throw new Error("이 계정은 BO 접근 권한이 없습니다.");
    }
    const { data: session } = await supabase.auth.getSession();
    return session.session;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async getAdminSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    if (isTestSession(data.session)) return data.session;
    const { data: boRow } = await supabase
      .from("bo_users")
      .select("user_id")
      .eq("user_id", data.session.user.id)
      .maybeSingle();
    return boRow ? data.session : null;
  },

  // BO 컨텍스트: 세션 + 역할 + 유효 메뉴
  async getBoContext(): Promise<BoContext | null> {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    const uid = data.session.user.id;

    // 테스트 계정 폴백: bo_users/overrides 조회 없이 super_admin + 전체 메뉴
    if (isTestSession(data.session)) {
      return {
        session: data.session,
        role: "super_admin",
        menus: resolveMenus("super_admin", []),
        identifier:
          data.session.user.phone ?? data.session.user.email ?? null,
      };
    }

    const [{ data: boRow }, { data: overrides }] = await Promise.all([
      supabase.from("bo_users").select("role").eq("user_id", uid).maybeSingle(),
      supabase
        .from("bo_menu_overrides")
        .select("menu_key, allowed")
        .eq("user_id", uid),
    ]);
    if (!boRow) return null;

    const role = boRow.role as BoRole;
    const menus = resolveMenus(role, (overrides ?? []) as MenuOverride[]);
    return {
      session: data.session,
      role,
      menus,
      identifier:
        data.session.user.phone ?? data.session.user.email ?? null,
    };
  },
};

export type BoContext = {
  session: NonNullable<
    Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]
  >;
  role: BoRole;
  menus: BoMenu[];
  identifier: string | null;
};
