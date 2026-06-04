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
    return {
      type: "auth",
      user: { id: user.id, email: user.email, display_name: displayName }
    };
  }
  const guest = getGuestUser();
  if (guest) return { type: "guest", user: guest };
  return { type: "none" };
}

export async function signInWithGoogle() {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}

export async function signInWithKakao() {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: "kakao",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
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
