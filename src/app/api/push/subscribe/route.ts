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
  const { subscription, userId, deviceId } = await req.json();
  if (!subscription?.endpoint) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const supabase = getAdmin();
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: userId || null,
    device_id: deviceId || null,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys?.p256dh || "",
    auth: subscription.keys?.auth || "",
  }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const supabase = getAdmin();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
