import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const userType = req.nextUrl.searchParams.get("type");
  if (!userId) return NextResponse.json({ groups: [] });

  const supabase = getAdmin();

  let groupIds: string[] = [];

  if (userType === "auth") {
    const { data } = await supabase.from("members").select("group_id").eq("user_id", userId);
    groupIds = (data || []).map(m => m.group_id);
    // also check if owner
    const { data: owned } = await supabase.from("groups").select("id").eq("owner_id", userId);
    const ownedIds = (owned || []).map(g => g.id);
    groupIds = [...new Set([...groupIds, ...ownedIds])];
  } else {
    const { data } = await supabase.from("members").select("group_id").eq("guest_account_id", userId);
    groupIds = (data || []).map(m => m.group_id);
  }

  if (groupIds.length === 0) return NextResponse.json({ groups: [] });

  const { data: groups } = await supabase.from("groups").select("id, name, emoji, is_private, created_at").in("id", groupIds);
  return NextResponse.json({ groups: groups || [] });
}
