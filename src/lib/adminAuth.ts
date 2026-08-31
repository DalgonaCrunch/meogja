/**
 * 관리자 확인 (서버 전용).
 *
 * 🔴 예전에는 요청 헤더 `x-admin-email` 이 관리자 이메일과 같은지만 봤다. 그 값은
 * 클라이언트가 마음대로 붙일 수 있고, NEXT_PUBLIC_ADMIN_EMAIL 은 브라우저 번들에
 * 그대로 들어 있다 — 즉 누구나 이메일 한 줄을 헤더에 넣어 관리자 API 를 부를 수
 * 있었다. 로그인 토큰을 서버에서 검증하는 방식으로 바꾼다.
 */
import { NextRequest } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** 관리자면 그 계정을, 아니면 null. 토큰이 없거나 위조되면 null. */
export async function getAdminUser(req: NextRequest): Promise<User | null> {
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!adminEmail) return null;

  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  try {
    // 서비스 키로 토큰을 검증한다 — 서명이 맞지 않으면 여기서 걸린다
    const { data, error } = await getAdminClient().auth.getUser(token);
    if (error || !data?.user) return null;
    /* 로그인 계정의 이메일만 본다. user_profiles.email 은 사용자가 고칠 수 있으므로
       권한 판단에 절대 쓰지 않는다. */
    const email = (data.user.email || "").trim().toLowerCase();
    return email === adminEmail ? data.user : null;
  } catch {
    return null;
  }
}
