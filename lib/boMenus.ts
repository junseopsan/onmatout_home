// BO 메뉴 카탈로그 + 역할/권한 해석 (단일 정의)
// SQL(admin_rbac.sql)의 역할과 1:1 대응.

export type BoRole = "super_admin" | "studio_owner";

export type MenuKey =
  | "dashboard"
  | "users"
  | "members-import"
  | "permissions"
  | "support"
  | "studios"
  | "teachers"
  | "knowledge"
  | "ai-ops"
  | "content"
  | "asanas"
  | "routines"
  | "members"
  | "classes";

export type BoMenu = {
  key: MenuKey;
  href: string;
  label: string;
  // 이 역할이면 기본으로 노출되는 메뉴
  defaultRoles: BoRole[];
};

const ALL: BoRole[] = ["super_admin", "studio_owner"];
const SUPER: BoRole[] = ["super_admin"];

// 사이드바 표시 순서 = 이 배열 순서
export const BO_MENUS: BoMenu[] = [
  { key: "dashboard", href: "/admin/dashboard", label: "대시보드", defaultRoles: SUPER },
  { key: "users", href: "/admin/users", label: "사용자 관리", defaultRoles: SUPER },
  { key: "members", href: "/admin/members", label: "회원 관리", defaultRoles: ALL },
  { key: "members-import", href: "/admin/members-import", label: "회원 일괄등록", defaultRoles: ALL },
  { key: "classes", href: "/admin/classes", label: "수업 관리", defaultRoles: ALL },
  { key: "permissions", href: "/admin/permissions", label: "권한 관리", defaultRoles: SUPER },
  { key: "support", href: "/admin/support", label: "지원·신고", defaultRoles: SUPER },
  { key: "studios", href: "/admin/studios", label: "요가원 관리", defaultRoles: SUPER },
  { key: "teachers", href: "/admin/teachers", label: "지도자 관리", defaultRoles: ALL },
  { key: "asanas", href: "/admin/asanas", label: "아사나 관리", defaultRoles: SUPER },
  { key: "routines", href: "/admin/routines", label: "시퀀스 관리", defaultRoles: ALL },
  { key: "knowledge", href: "/admin/knowledge", label: "AI 지식베이스", defaultRoles: SUPER },
  { key: "ai-ops", href: "/admin/ai-ops", label: "AI·앱운영", defaultRoles: SUPER },
  { key: "content", href: "/admin/content", label: "콘텐츠", defaultRoles: SUPER },
];

export type MenuOverride = { menu_key: string; allowed: boolean };

// 역할 기본 메뉴 ± 사용자별 override → 유효 메뉴 키 집합
export function resolveMenuKeys(
  role: BoRole,
  overrides: MenuOverride[] = [],
): Set<MenuKey> {
  const set = new Set<MenuKey>();
  for (const m of BO_MENUS) {
    if (m.defaultRoles.includes(role)) set.add(m.key);
  }
  for (const o of overrides) {
    const key = o.menu_key as MenuKey;
    if (!BO_MENUS.some((m) => m.key === key)) continue; // 미지정 키 무시
    if (o.allowed) set.add(key);
    else set.delete(key);
  }
  return set;
}

// 유효 메뉴 키 → 표시 순서대로 메뉴 객체 목록
export function resolveMenus(
  role: BoRole,
  overrides: MenuOverride[] = [],
): BoMenu[] {
  const keys = resolveMenuKeys(role, overrides);
  return BO_MENUS.filter((m) => keys.has(m.key));
}

// pathname → 해당 메뉴 키 (게이팅용). 가장 긴 href 우선 매칭.
export function menuKeyForPath(pathname: string | null): MenuKey | null {
  if (!pathname) return null;
  const match = [...BO_MENUS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((m) => pathname === m.href || pathname.startsWith(m.href + "/"));
  return match?.key ?? null;
}
