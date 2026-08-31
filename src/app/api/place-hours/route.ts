import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rateLimit";
import { trackApiUsage } from "@/lib/apiTracker";

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

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "not_configured" });

  if (!(await checkMonthlyQuota())) {
    return NextResponse.json({ error: "quota" });
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

  if (!res.ok) return NextResponse.json({ error: "lookup_failed" });

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
