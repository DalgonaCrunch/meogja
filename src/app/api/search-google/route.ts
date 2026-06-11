import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rateLimit";
import { trackApiUsage } from "@/lib/apiTracker";

const MONTHLY_LIMIT = parseInt(process.env.GOOGLE_PLACES_MONTHLY_LIMIT || "3000");

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function checkMonthlyQuota(): Promise<boolean> {
  if (MONTHLY_LIMIT <= 0) return true; // 0 = 무제한
  const monthKey = `google_places_count_${new Date().toISOString().slice(0, 7)}`;
  const admin = getAdmin();
  try {
    const { data } = await admin.from("app_settings").select("value").eq("key", monthKey).single();
    const current = parseInt(String(data?.value || "0")) || 0;
    if (current >= MONTHLY_LIMIT) return false;
    // increment
    await admin.from("app_settings").upsert(
      { key: monthKey, value: String(current + 1) },
      { onConflict: "key" }
    );
  } catch {
    // 체크 실패 시 통과
  }
  return true;
}

export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(request, "search-google", { perMinute: 10, perDay: 100 });
  if (limited) return limited;

  const query = request.nextUrl.searchParams.get("query");
  const x = request.nextUrl.searchParams.get("x"); // longitude
  const y = request.nextUrl.searchParams.get("y"); // latitude
  const radius = request.nextUrl.searchParams.get("radius") || "1000";

  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500 });

  const withinQuota = await checkMonthlyQuota();
  if (!withinQuota) {
    return NextResponse.json(
      { error: "이번 달 구글 검색 한도를 초과했습니다. 다음 달에 다시 이용해주세요." },
      { status: 429 }
    );
  }

  const textQuery = `${query} 맛집`;
  const body: Record<string, unknown> = { textQuery, languageCode: "ko", maxResultCount: 5 };

  if (x && y) {
    body.locationBias = {
      circle: {
        center: { latitude: parseFloat(y), longitude: parseFloat(x) },
        radius: parseFloat(radius),
      },
    };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.primaryTypeDisplayName,places.location,places.googleMapsUri",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = "";
    try { detail = JSON.parse(text)?.error?.message || text; } catch { detail = text; }
    return NextResponse.json({ error: `Google API 오류: ${detail}` }, { status: res.status });
  }

  const data = await res.json();
  const userLat = y ? parseFloat(y) : null;
  const userLng = x ? parseFloat(x) : null;

  const items = (data.places || []).map((p: Record<string, unknown>) => {
    const loc = p.location as { latitude: number; longitude: number } | undefined;
    let distance: number | null = null;
    if (userLat && userLng && loc) {
      distance = haversine(userLat, userLng, loc.latitude, loc.longitude);
    }
    return {
      title: (p.displayName as { text?: string })?.text || "",
      category: (p.primaryTypeDisplayName as { text?: string })?.text || "",
      address: (p.formattedAddress as string) || "",
      mapx: loc ? String(loc.longitude) : "",
      mapy: loc ? String(loc.latitude) : "",
      link: (p.googleMapsUri as string) || "",
      distance,
    };
  });

  if (userLat && userLng) {
    items.sort((a: { distance: number | null }, b: { distance: number | null }) => {
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      return 0;
    });
  }

  trackApiUsage("google_places");
  return NextResponse.json({ items });
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
