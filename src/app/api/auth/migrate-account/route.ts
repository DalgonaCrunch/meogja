import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// fromUserId(구 간편가입) 데이터를 toUserId(새 소셜)로 이전
export async function POST(req: NextRequest) {
  const { fromUserId, toUserId, keepSourceProfile } = await req.json();
  if (!fromUserId || !toUserId || fromUserId === toUserId) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const admin = getAdmin();

  // fromUserId가 간편가입(@meogja.app) 계정인지 검증
  const { data: fromUser, error: fromErr } = await admin.auth.admin.getUserById(fromUserId);
  if (fromErr || !fromUser.user?.email?.endsWith("@meogja.app")) {
    return NextResponse.json({ error: "이전 불가 계정입니다" }, { status: 403 });
  }
  // toUserId가 실제 현재 인증된 세션인지 검증 (Authorization 헤더)
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user: callerUser } } = await anonClient.auth.getUser();
  if (!callerUser || callerUser.id !== toUserId) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  try {
    // 1. user_profiles: keepSourceProfile=true면 from 데이터로 덮어씀, 아니면 to 프로필 우선
    const { data: fromPro } = await admin.from("user_profiles").select("*").eq("id", fromUserId).single();
    const { data: toPro } = await admin.from("user_profiles").select("id").eq("id", toUserId).single();
    if (keepSourceProfile && fromPro) {
      // 현재(간편가입) 계정 정보로 소셜 계정 프로필 덮어쓰기
      if (toPro) {
        const { id: _id, ...rest } = fromPro;
        await admin.from("user_profiles").update(rest).eq("id", toUserId);
      } else {
        await admin.from("user_profiles").insert({ ...fromPro, id: toUserId });
      }
    } else if (!toPro && fromPro) {
      // 소셜 계정에 프로필 없으면 from 데이터 복사
      await admin.from("user_profiles").insert({ ...fromPro, id: toUserId });
    }

    // 2. groups (owner_id)
    await admin.from("groups").update({ owner_id: toUserId }).eq("owner_id", fromUserId);

    // 3. group_memberships
    await admin.from("group_memberships").update({ user_id: toUserId }).eq("user_id", fromUserId);

    // 3. members (user_id 컬럼)
    await admin.from("members").update({ user_id: toUserId }).eq("user_id", fromUserId);

    // 4. food_preferences
    await admin.from("food_preferences").update({ user_id: toUserId }).eq("user_id", fromUserId);

    // 5. food_events
    await admin.from("food_events").update({ user_id: toUserId }).eq("user_id", fromUserId);

    // 6. worldcup_selections
    await admin.from("worldcup_selections").update({ user_id: toUserId }).eq("user_id", fromUserId);

    // 7. direct_messages (sender / receiver 모두)
    await admin.from("direct_messages").update({ sender_id: toUserId }).eq("sender_id", fromUserId);
    await admin.from("direct_messages").update({ receiver_id: toUserId }).eq("receiver_id", fromUserId);

    // 8. reviews
    await admin.from("reviews").update({ user_id: toUserId }).eq("user_id", fromUserId);

    // 9. favorites
    await admin.from("favorites").update({ user_id: toUserId }).eq("user_id", fromUserId);

    // 10. push_subscriptions
    await admin.from("push_subscriptions").update({ user_id: toUserId }).eq("user_id", fromUserId);

    // 11. menu_votes (created_by)
    await admin.from("menu_votes").update({ created_by: toUserId }).eq("created_by", fromUserId);

    // 12. menu_vote_responses
    await admin.from("menu_vote_responses").update({ voter_id: toUserId }).eq("voter_id", fromUserId);

    // 13. reports (reporter)
    await admin.from("reports").update({ reporter_id: toUserId }).eq("reporter_id", fromUserId);

    // 14. feedbacks
    await admin.from("feedbacks").update({ user_id: toUserId }).eq("user_id", fromUserId);

    // 15. 구 간편가입 user_profiles 삭제 후 auth 계정 삭제
    await admin.from("user_profiles").delete().eq("id", fromUserId);
    await admin.from("guest_accounts").delete().eq("id", fromUserId);
    await admin.auth.admin.deleteUser(fromUserId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Migration error:", err);
    return NextResponse.json({ error: "이전 중 오류 발생" }, { status: 500 });
  }
}
