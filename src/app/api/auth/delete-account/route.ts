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

    // 4. 프로필 익명화 + 소프트 삭제.
    //    닉네임(display_name)만 남긴다 — 남의 모임 기록에서 참여자 이름이 깨지지 않게.
    //    나머지 개인정보는 전부 지운다. 공개 페이지(/delete-account)에 적은
    //    "남는 것은 닉네임·탈퇴기록·로그인 이메일뿐"과 실제 동작을 맞추기 위한 것이다.
    const deletedAt = new Date().toISOString();
    const anonymized = {
      profile_image: null,
      email: null,
      name: null,
      nickname: null,
      mobile: null,
      gender: null,
      birthday: null,
      age: null,
      mbti: null,
      disliked_foods: null,
      is_deleted: true,
      deleted_at: deletedAt,
    };

    const { error: anonErr } = await supabase
      .from("user_profiles").update(anonymized).eq("id", userId);

    if (anonErr) {
      // 컬럼이 하나라도 없으면 update 전체가 실패한다. 그때도 탈퇴 자체는 되게 한다 —
      // 사용자가 "탈퇴가 안 된다"고 막히는 것이 더 나쁘다. 남은 익명화는 로그로 남긴다.
      console.error("[delete-account] 프로필 익명화 실패, 최소 처리로 대체", anonErr.message);
      await supabase.from("user_profiles").update({
        profile_image: null,
        is_deleted: true,
        deleted_at: deletedAt,
      }).eq("id", userId);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
