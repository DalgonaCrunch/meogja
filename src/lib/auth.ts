import { getSupabase } from "./supabase";

export type AuthUser = {
  id: string;
  email?: string;
  display_name?: string;
};

export type GuestUser = {
  name: string;
};

export type CurrentUser =
  | { type: "auth"; user: AuthUser }
  | { type: "guest"; user: GuestUser }
  | { type: "none" };

const GUEST_KEY = "meogja_guest";
const DEVICE_KEY = "meogja_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function getGuestUser(): GuestUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(GUEST_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setGuestUser(name: string) {
  localStorage.setItem(GUEST_KEY, JSON.stringify({ name }));
  // 헤더 즉시 업데이트를 위한 커스텀 이벤트
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("meogja-auth-change"));
  }
}

export function clearGuestUser() {
  localStorage.removeItem(GUEST_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("meogja-auth-change"));
  }
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const { data: { user } } = await getSupabase().auth.getUser();
  if (user) {
    const { data: profile } = await getSupabase()
      .from("user_profiles").select("*").eq("id", user.id).single();
    const metaName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.preferred_username;
    const displayName = profile?.display_name || metaName || user.email?.split("@")[0] || "";
    // 프로필 행 없으면 생성 (소셜 로그인 콜백이 누락된 경우 대비)
    if (!profile) {
      const profileImage = user.user_metadata?.avatar_url || "/mascot/avatars/cat-00.png";
      getSupabase().from("user_profiles").insert({
        id: user.id,
        display_name: displayName,
        profile_image: profileImage,
      }).then(() => {});
    }
    return {
      type: "auth",
      user: { id: user.id, email: user.email, display_name: displayName }
    };
  }
  const guest = getGuestUser();
  if (guest) return { type: "guest", user: guest };
  return { type: "none" };
}

// 네이버 로그인은 커스텀 OAuth 라우트 사용 (/api/auth/naver)
// signInWithNaver는 직접 window.location.href 사용

export async function signInWithGoogle(next?: string) {
  const callbackUrl = next
    ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    : `${window.location.origin}/auth/callback`;
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl },
  });
  if (error) throw error;
}

export async function signInWithKakao(next?: string) {
  const callbackUrl = next
    ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    : `${window.location.origin}/auth/callback`;
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: "kakao",
    options: { redirectTo: callbackUrl },
  });
  if (error) throw error;
}

export async function signOut() {
  await getSupabase().auth.signOut();
  clearGuestUser();
}

export async function ensureUserProfile(userId: string, displayName?: string) {
  const { data } = await getSupabase()
    .from("user_profiles").select("id").eq("id", userId).single();
  if (!data) {
    await getSupabase().from("user_profiles").insert({ id: userId, display_name: displayName });
  }
}
