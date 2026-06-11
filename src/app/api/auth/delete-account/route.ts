import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getAdmin();

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = user.id;

  try {
    // 1. 내가 모임장인 모임 삭제 (CASCADE로 멤버/히스토리 등 자동 삭제)
    const { data: ownedGroups } = await supabase.from("groups").select("id").eq("owner_id", userId);
    if (ownedGroups && ownedGroups.length > 0) {
      const groupIds = ownedGroups.map(g => g.id);
      await supabase.from("groups").delete().in("id", groupIds);
    }

    // 2. 내가 멤버인 모임에서 탈퇴
    await supabase.from("group_memberships").delete().eq("user_id", userId);

    // 3. 개인 데이터 정리 (push, 음식 선호도)
    await Promise.allSettled([
      supabase.from("push_subscriptions").delete().eq("user_id", userId),
      supabase.from("user_food_preferences").delete().eq("user_id", userId),
    ]);

    // 4. 프로필 소프트 삭제 — 이미지 익명화, is_deleted 플래그 (닉네임 유지)
    await supabase.from("user_profiles").update({
      profile_image: null,
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    }).eq("id", userId);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
