import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@meogja.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const { groupId, userIds: directUserIds, title, body, url, excludeUserId } = await req.json();
  if (!title) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const supabase = getAdmin();
  let userIds: string[];

  if (directUserIds && Array.isArray(directUserIds) && directUserIds.length > 0) {
    userIds = directUserIds.filter((id: string) => id !== excludeUserId);
  } else if (groupId) {
    // 모임 멤버들의 user_id 조회
    const { data: members } = await supabase
      .from("members").select("user_id").eq("group_id", groupId).eq("status", "approved").not("user_id", "is", null);
    if (!members || members.length === 0) return NextResponse.json({ sent: 0 });
    userIds = members.map((m: { user_id: string }) => m.user_id).filter(id => id !== excludeUserId);
  } else {
    return NextResponse.json({ error: "groupId or userIds required" }, { status: 400 });
  }

  if (userIds.length === 0) return NextResponse.json({ sent: 0 });

  const { data: subs } = await supabase.from("push_subscriptions").select("*").in("user_id", userIds);
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 });

  const payload = JSON.stringify({ title, body: body || "", url: url || "/" });
  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      ).catch(async (err) => {
        if (err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        throw err;
      })
    )
  );

  const sent = results.filter(r => r.status === "fulfilled").length;
  return NextResponse.json({ sent, total: subs.length });
}
