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

    // 3) 남는 기록 — 푸시를 못 받는 상황에서도 나중에 확인할 수 있게 (최근 20건)
    try {
      const { data: logRow } = await admin.from("app_settings").select("value").eq("key", "admin_alert_log").single();
      const log: { at: string; kind: string; message: string }[] = logRow?.value ? JSON.parse(String(logRow.value)) : [];
      log.unshift({ at: new Date().toISOString(), kind, message });
      await admin.from("app_settings").upsert(
        { key: "admin_alert_log", value: JSON.stringify(log.slice(0, 20)) },
        { onConflict: "key" },
      );
    } catch { /* 기록 실패는 넘긴다 */ }

    // 4) 관리자 계정 찾기
    const adminUserId = await findAdminUserId(admin);
    if (!adminUserId) return;

    const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", adminUserId);
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

/**
 * 관리자 계정 id 찾기.
 *
 * 🔴 **로그인 계정(auth)의 이메일만** 본다. user_profiles.email 은 사용자가 프로필
 * 화면에서 아무 값으로나 고칠 수 있다 — 그 값으로 관리자를 찾으면, 남의 이메일을
 * 적어 넣은 사람에게 관리자 알림이 가게 된다(알림 내용이 새는 것이다).
 * 소셜 로그인 계정은 프로필 이메일이 비어 있는 경우도 많아(23명 중 8명만 채워짐)
 * 어차피 신뢰할 수도 없는 값이다.
 *
 * 한 번 찾으면 app_settings 에 적어 두고 다시 찾지 않는다.
 */
async function findAdminUserId(admin: ReturnType<typeof getAdmin>): Promise<string | null> {
  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!adminEmail) return null;

  try {
    const { data: cached } = await admin.from("app_settings").select("value").eq("key", "admin_user_id").single();
    if (cached?.value) return String(cached.value);
  } catch { /* 없으면 찾는다 */ }

  let found: string | null = null;

  // 로그인 계정의 이메일 (프로필 이메일은 쓰지 않는다 — 위 설명 참고)
  {
    try {
      for (let page = 1; page <= 5 && !found; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        const users = data?.users || [];
        if (users.length === 0) break;
        const hit = users.find((u) => {
          const meta = (u.user_metadata || {}) as Record<string, unknown>;
          return [u.email, meta.original_email, meta.email]
            .some((e) => typeof e === "string" && e.toLowerCase() === adminEmail);
        });
        if (hit) found = hit.id;
      }
    } catch { /* 넘어간다 */ }
  }

  if (found) {
    try {
      await admin.from("app_settings").upsert({ key: "admin_user_id", value: found }, { onConflict: "key" });
    } catch { /* 넘어간다 */ }
  }
  return found;
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
