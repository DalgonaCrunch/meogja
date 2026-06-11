import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider");
  const authHeader = req.headers.get("authorization");
  if (!provider || !authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ found: false });
  }

  const token = authHeader.slice(7);
  const admin = getAdmin();
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user: callerUser } } = await anonClient.auth.getUser();
  if (!callerUser) return NextResponse.json({ found: false });

  try {
    // auth.identities에서 해당 provider로 가입한 계정 조회 (현재 유저 제외)
    const { data: identities } = await admin
      .schema("auth")
      .from("identities")
      .select("user_id, created_at")
      .eq("provider", provider)
      .neq("user_id", callerUser.id)
      .limit(1);

    if (!identities || identities.length === 0) return NextResponse.json({ found: false });

    const userId = identities[0].user_id;

    const [profileRes, ownedRes, joinedRes, authRes] = await Promise.all([
      admin.from("user_profiles").select("display_name, nickname, profile_image").eq("id", userId).single(),
      admin.from("groups").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      admin.from("group_memberships").select("id", { count: "exact", head: true }).eq("user_id", userId),
      admin.auth.admin.getUserById(userId),
    ]);

    return NextResponse.json({
      found: true,
      display_name: profileRes.data?.nickname || profileRes.data?.display_name || "알 수 없음",
      profile_image: profileRes.data?.profile_image,
      created_at: authRes.data?.user?.created_at,
      group_count: (ownedRes.count || 0) + (joinedRes.count || 0),
    });
  } catch {
    return NextResponse.json({ found: false });
  }
}
