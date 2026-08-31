import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/adminAuth";
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
  /* 로그인 토큰으로 확인한다 — 헤더에 이메일만 적어 부르던 방식은 누구나 흉내낼 수
     있었다(NEXT_PUBLIC_ADMIN_EMAIL 은 브라우저 번들에 들어 있다). */
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const { userIds, title, body, url } = await req.json();
  if (!title) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const supabase = getAdmin();
  let query = supabase.from("push_subscriptions").select("*");
  if (userIds && userIds.length > 0) {
    query = query.in("user_id", userIds);
  }
  const { data: subs } = await query;
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 });

  const payload = JSON.stringify({ title, body: body || "", url: url || "/" });
  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      ).catch(async (err) => {
        // 만료된 구독 삭제
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
