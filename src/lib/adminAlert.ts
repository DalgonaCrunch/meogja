/**
 * 관리자에게만 보내는 경고 (서버 전용).
 *
 * 외부 API 가 한도를 넘거나 열쇠가 잘못돼 죽는 일은 **사용자에게 보여줄 일이 아니다**.
 * 사용자 화면에서는 그 기능을 조용히 접고, 고칠 수 있는 사람에게만 알린다.
 *
 * 같은 사고로 수십 번 알림이 오면 그것도 안 보게 되므로, 같은 종류는 정해진 기간에
 * 한 번만 보낸다(기본 하루).
 */
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** 하루 한 번(기본). 월 한도 소진처럼 한 달에 한 번이면 되는 것은 windowHours 를 늘린다. */
export async function alertAdmin(
  kind: string,
  message: string,
  opts: { windowHours?: number; url?: string } = {},
): Promise<void> {
  const windowHours = opts.windowHours ?? 24;
  const admin = getAdmin();
  const stateKey = `admin_alert:${kind}`;

  try {
    // 1) 최근에 같은 알림을 보냈으면 조용히 넘긴다
    const { data } = await admin.from("app_settings").select("value").eq("key", stateKey).single();
    const lastAt = data?.value ? parseInt(String(data.value)) || 0 : 0;
    if (lastAt && Date.now() - lastAt < windowHours * 3600_000) return;

    // 2) 보냈다고 먼저 적는다 — 알림 전송이 느려도 같은 요청이 몰려 여러 번 가지 않게
    await admin.from("app_settings").upsert({ key: stateKey, value: String(Date.now()) }, { onConflict: "key" });

    // 3) 관리자 계정 찾기
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (!adminEmail) return;
    const { data: profile } = await admin.from("user_profiles").select("id").eq("email", adminEmail).single();
    if (!profile?.id) return;

    const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", profile.id);
    if (!subs || subs.length === 0) return;

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@meogja.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    const payload = JSON.stringify({
      title: "⚠️ meogja 점검이 필요해요",
      body: message.slice(0, 180),
      url: opts.url || "/admin",
    });
    await Promise.allSettled(
      subs.map((s: { endpoint: string; p256dh: string; auth: string }) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload),
      ),
    );
  } catch {
    /* 알림에 실패해도 서비스는 계속 돈다 — 여기서 던지면 사용자 요청이 깨진다 */
  }
}

/** 외부 지도/장소 API 가 실패했을 때. 상태코드로 원인을 갈라 문구를 만든다. */
export async function alertApiFailure(
  api: string,
  status: number,
  detail: string,
): Promise<void> {
  const quotaish = status === 429 || status === 403 || status === 402;
  const kind = quotaish ? `${api}_quota` : `${api}_error_${status}`;
  const head = quotaish
    ? `${api} 한도/권한 문제로 응답이 막혔어요 (HTTP ${status})`
    : `${api} 호출이 실패했어요 (HTTP ${status})`;
  await alertAdmin(kind, `${head}\n${detail.slice(0, 140)}`, {
    // 한도 소진은 하루 한 번, 그 밖의 오류는 여섯 시간마다
    windowHours: quotaish ? 24 : 6,
  });
}
