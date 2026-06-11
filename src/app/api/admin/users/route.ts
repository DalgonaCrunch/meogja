import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const supabase = getAdmin();

  // auth users with profiles
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const userIds = authUsers.map(u => u.id);
  const { data: profiles } = await supabase.from("user_profiles").select("id, display_name, suspended_until, is_deleted").in("id", userIds);
  const profileMap: Record<string, { display_name: string | null; suspended_until: string | null; is_deleted: boolean | null }> = {};
  profiles?.forEach(p => { profileMap[p.id] = p; });

  const members = authUsers.map(u => ({
    id: u.id,
    type: "auth" as const,
    name: profileMap[u.id]?.display_name || u.email?.split("@")[0] || "알 수 없음",
    email: u.email || null,
    created_at: u.created_at,
    suspended_until: profileMap[u.id]?.suspended_until || null,
    is_deleted: profileMap[u.id]?.is_deleted || false,
  }));

  // guests
  const { data: guests } = await supabase.from("guest_accounts").select("id, name, created_at, suspended_until").order("created_at", { ascending: false });
  const guestList = (guests || []).map(g => ({
    id: g.id,
    type: "guest" as const,
    name: g.name,
    email: null,
    created_at: g.created_at,
    suspended_until: g.suspended_until || null,
  }));

  return NextResponse.json({ members, guests: guestList });
}

export async function POST(req: NextRequest) {
  const { userId, userType, suspendedUntil } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const supabase = getAdmin();

  if (userType === "auth") {
    await supabase.from("user_profiles").upsert({ id: userId, suspended_until: suspendedUntil || null });
  } else {
    await supabase.from("guest_accounts").update({ suspended_until: suspendedUntil || null }).eq("id", userId);
  }

  return NextResponse.json({ ok: true });
}
