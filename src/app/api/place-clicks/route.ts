import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function normalize(name: string) {
  return name.replace(/\s/g, "").replace(/(본점|지점|분점|직영점|[가-힣]{1,4}점)$/, "").toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const { place_name } = await req.json();
    if (!place_name) return NextResponse.json({ ok: false }, { status: 400 });
    await getAdmin().rpc("upsert_place_click", { p_name: normalize(place_name) });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("names");
  if (!raw) return NextResponse.json({});
  const names = raw.split(",").map(normalize).filter(Boolean);
  const { data } = await getAdmin()
    .from("place_click_stats")
    .select("place_name, clicks")
    .in("place_name", names);
  const result: Record<string, number> = {};
  (data || []).forEach((r: { place_name: string; clicks: number }) => { result[r.place_name] = r.clicks; });
  return NextResponse.json(result);
}
