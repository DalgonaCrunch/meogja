import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uid = user.id;

  // 이미 획득한 뱃지
  const { data: existingBadges } = await supabase.from("user_badges").select("badge_id").eq("user_id", uid);
  const earned = new Set((existingBadges || []).map((b: { badge_id: string }) => b.badge_id));

  // 통계 수집
  const [
    { count: voteCount },
    { count: groupMemberCount },
    { data: ownedGroups },
    { data: decisions },
    { data: foodPrefs },
    { data: worldcupSessions },
  ] = await Promise.all([
    supabase.from("menu_vote_responses").select("*", { count: "exact", head: true }).eq("voter_id", uid),
    supabase.from("group_memberships").select("*", { count: "exact", head: true }).eq("user_id", uid),
    supabase.from("groups").select("id").eq("owner_id", uid),
    supabase.from("menu_votes").select("id").eq("created_by", uid),
    supabase.from("user_food_preferences").select("id").eq("user_id", uid),
    supabase.from("user_food_scores").select("food_name").eq("user_id", uid).gt("score", 0),
  ]);

  const votes = voteCount || 0;
  const groupCount = groupMemberCount || 0;
  const ownedCount = (ownedGroups || []).length;
  const decisionCount = (decisions || []).length;
  const prefCount = (foodPrefs || []).length;
  const worldcupCount = (worldcupSessions || []).length;

  // 조건 체크
  const newBadges: string[] = [];
  function check(id: string, condition: boolean) {
    if (condition && !earned.has(id)) newBadges.push(id);
  }

  check("beginner",  votes >= 1);
  check("regular",   groupCount >= 5);
  check("expert",    votes >= 20);
  check("fighter",   votes >= 50);
  check("creator",   ownedCount >= 3);
  check("decider",   decisionCount >= 10);
  check("foodie",    prefCount >= 10);
  check("worldcup",  worldcupCount >= 10);

  // 새 뱃지 삽입
  if (newBadges.length > 0) {
    await supabase.from("user_badges").insert(
      newBadges.map(badge_id => ({ user_id: uid, badge_id }))
    );
  }

  // 전체 획득 뱃지 반환
  const { data: allBadges } = await supabase.from("user_badges").select("badge_id, earned_at").eq("user_id", uid);

  return NextResponse.json({ newBadges, allBadges: allBadges || [] });
}
