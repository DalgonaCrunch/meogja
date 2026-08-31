import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rateLimit";
import { trackApiUsage } from "@/lib/apiTracker";
import { alertAdmin, alertApiFailure } from "@/lib/adminAlert";

/**
 * 가게 영업시간 + 전화번호.
 *
 * 카카오·네이버 지역검색은 영업시간을 주지 않는다. 구글 Places 만 준다. 그런데
 * 구글은 영업시간을 포함하면 요금 등급이 올라가므로 **목록을 그릴 때가 아니라
 * 사용자가 그 가게를 눌렀을 때만** 부른다. 한 번 받은 값은 저장해 두고 재사용한다
 * (같은 가게를 여러 사람이 눌러도 한 번만 부른다).
 */

const CACHE_DAYS = 14;
const MONTHLY_LIMIT = parseInt(process.env.GOOGLE_PLACES_MONTHLY_LIMIT || "3000");

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function checkMonthlyQuota(): Promise<boolean> {
  if (MONTHLY_LIMIT <= 0) return true;
  const monthKey = `google_places_count_${new Date().toISOString().slice(0, 7)}`;
  const admin = getAdmin();
  try {
    const { data } = await admin.from("app_settings").select("value").eq("key", monthKey).single();
    const current = parseInt(String(data?.value || "0")) || 0;
    if (current >= MONTHLY_LIMIT) return false;
    await admin.from("app_settings").upsert({ key: monthKey, value: String(current + 1) }, { onConflict: "key" });
  } catch { /* 체크 실패 시 통과 */ }
  return true;
}

export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(request, "place-hours", { perMinute: 20, perDay: 200 });
  if (limited) return limited;

  const name = request.nextUrl.searchParams.get("name");
  const address = request.nextUrl.searchParams.get("address") || "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const cacheKey = `place_hours:${name}|${address.slice(0, 40)}`;
  const admin = getAdmin();

  // 1) 저장해 둔 값 먼저
  try {
    const { data } = await admin.from("app_settings").select("value").eq("key", cacheKey).single();
    if (data?.value) {
      const cached = JSON.parse(String(data.value));
      if (cached.at && Date.now() - cached.at < CACHE_DAYS * 86400_000) {
        return NextResponse.json({ ...cached.payload, cached: true });
      }
    }
  } catch { /* 없으면 새로 받는다 */ }

  /* 🔴 여기서부터는 사용자에게 오류를 보여주지 않는다. 영업시간은 있으면 좋은
     정보이고, 없다고 사용자가 할 수 있는 일이 없다. 기능을 접고(disabled) 고칠 수
     있는 사람에게만 알린다. */
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    void alertAdmin("google_places_key_missing", "구글 Places 열쇠가 설정되지 않아 영업시간을 못 보여주고 있어요");
    return NextResponse.json({ error: "not_configured", disabled: true });
  }

  if (!(await checkMonthlyQuota())) {
    void alertAdmin(
      `google_places_quota_${new Date().toISOString().slice(0, 7)}`,
      `구글 Places 월 한도(${MONTHLY_LIMIT}회)를 다 썼어요. 영업시간 표시는 이번 달 동안 조용히 꺼둡니다`,
      { windowHours: 24 * 30 },
    );
    return NextResponse.json({ error: "quota", disabled: true });
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.displayName",
        "places.nationalPhoneNumber",
        "places.regularOpeningHours.weekdayDescriptions",
        "places.regularOpeningHours.openNow",
      ].join(","),
    },
    body: JSON.stringify({ textQuery: `${name} ${address}`.trim(), languageCode: "ko", maxResultCount: 1 }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    void alertApiFailure("google_places", res.status, detail);
    /* 열쇠·결제 문제(403/429)면 기능을 접는다. 그 밖의 실패는 이 가게만 못 찾은 것일
       수 있으니 다음 가게는 다시 시도한다. */
    const disabled = res.status === 403 || res.status === 429 || res.status === 402;
    return NextResponse.json({ error: "lookup_failed", disabled });
  }

  const data = await res.json();
  const place = (data.places || [])[0] as
    | { nationalPhoneNumber?: string; regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] } }
    | undefined;

  const payload = {
    phone: place?.nationalPhoneNumber || null,
    openNow: place?.regularOpeningHours?.openNow ?? null,
    hours: place?.regularOpeningHours?.weekdayDescriptions || [],
  };

  // 2) 저장 (실패해도 응답은 돌려준다)
  try {
    await admin.from("app_settings").upsert(
      { key: cacheKey, value: JSON.stringify({ at: Date.now(), payload }) },
      { onConflict: "key" },
    );
  } catch { /* 저장 실패는 넘긴다 */ }

  trackApiUsage("google_places");
  return NextResponse.json(payload);
}
