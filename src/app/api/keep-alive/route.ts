import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase 무료 플랜은 7일간 요청이 없으면 프로젝트를 일시정지한다.
// Vercel Cron(vercel.json)이 하루 1번 이 라우트를 불러 가벼운 조회 한 번으로 깨워 둔다.
//
// 같은 크론으로 BLOCKPOP(별도 저장소 DalgonaCrunch/blockpop, Vercel 프로젝트 없음)의
// Supabase 도 같이 깨운다. 정적 앱이라 자기 크론을 돌릴 곳이 없어서 여기에 얹었다.
// 둘은 서로 독립이다 — 한쪽이 실패해도 다른 쪽 조회는 그대로 한다.
export const dynamic = "force-dynamic";

type Result = { ok: true } | { ok: false; error: string } | { ok: null; skipped: string };

async function pingMeogja(): Promise<Result> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await supabase.from("app_settings").select("key").limit(1);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// BLOCKPOP 의 app_config 는 anon 키로 읽는 공개 표다(앱이 켤 때마다 같은 조회를 한다).
// anon 키는 앱 번들에도 들어 있는 공개 값이라 비밀키가 필요 없다.
async function pingBlockpop(): Promise<Result> {
  const url = process.env.BLOCKPOP_SUPABASE_URL;
  const key = process.env.BLOCKPOP_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: null, skipped: "BLOCKPOP_SUPABASE_URL/ANON_KEY 미설정" };
  try {
    const res = await fetch(`${url}/rest/v1/app_config?select=min_build&id=eq.1&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: NextRequest) {
  // CRON_SECRET 이 설정돼 있으면 Vercel Cron 이 보내는 Bearer 토큰만 받는다.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const [meogja, blockpop] = await Promise.all([
    pingMeogja().catch((e): Result => ({ ok: false, error: String(e) })),
    pingBlockpop(),
  ]);
  const ok = meogja.ok !== false && blockpop.ok !== false;
  const result = { ok, at: new Date().toISOString(), meogja, blockpop };

  // Hobby 플랜 런타임 로그는 금방 사라진다. 결과를 로그로 남기고,
  // 나중에 "오늘 크론 돌았나?" 를 볼 수 있게 app_settings 에도 마지막 결과를 적어 둔다.
  console.log("[keep-alive]", JSON.stringify(result));
  await recordLastRun(result);

  return NextResponse.json(result, { status: ok ? 200 : 500 });
}

// app_settings 는 누구나 읽는 표라 비밀 값은 넣지 않는다(성공 여부·오류 문구·시각만).
// 기록에 실패해도 크론 응답은 그대로 둔다.
async function recordLastRun(result: object) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error } = await admin
      .from("app_settings")
      .upsert(
        { key: "keep_alive_last_run", value: result, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (error) console.error("[keep-alive] 기록 실패:", error.message);
  } catch (e) {
    console.error("[keep-alive] 기록 실패:", e instanceof Error ? e.message : String(e));
  }
}
