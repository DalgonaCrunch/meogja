import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// 설정 캐시 (60초 TTL)
let cachedLimits: { perMinute: number; perDay: number } | null = null;
let cacheExpiresAt = 0;

async function getLimits(): Promise<{ perMinute: number; perDay: number }> {
  const now = Date.now();
  if (cachedLimits && now < cacheExpiresAt) return cachedLimits;

  try {
    const admin = getAdmin();
    const { data } = await admin
      .from("app_settings")
      .select("key, value")
      .in("key", ["rate_limit_per_minute", "rate_limit_per_day"]);

    const map: Record<string, number> = {};
    (data ?? []).forEach((r: { key: string; value: string }) => {
      map[r.key] = parseInt(String(r.value)) || 0;
    });
    cachedLimits = {
      perMinute: map["rate_limit_per_minute"] || 10,
      perDay: map["rate_limit_per_day"] || 100,
    };
    cacheExpiresAt = now + 60_000;
  } catch {
    cachedLimits = { perMinute: 10, perDay: 100 };
    cacheExpiresAt = Date.now() + 30_000;
  }
  return cachedLimits;
}

/**
 * IP 기반 레이트 리밋 체크.
 * 초과 시 429 NextResponse 반환, 통과 시 null 반환.
 * 설정값은 app_settings 테이블에서 읽고 60초 캐시.
 */
export async function checkRateLimit(
  req: NextRequest,
  endpoint: string,
  opts: { perMinute?: number; perDay?: number } = {}
): Promise<NextResponse | null> {
  const limits = await getLimits();
  const perMinute = opts.perMinute ?? limits.perMinute;
  const perDay = opts.perDay ?? limits.perDay;

  // 0이면 무제한
  if (perMinute === 0 && perDay === 0) return null;

  const ip = getClientIp(req);
  const now = Date.now();
  const minuteWindow = `min_${Math.floor(now / 60000)}`;
  const dayWindow = `day_${new Date(now).toISOString().slice(0, 10)}`;

  const admin = getAdmin();

  try {
    if (perMinute > 0) {
      const { data: minCount } = await admin.rpc("increment_rate_limit", {
        p_ip: ip,
        p_endpoint: endpoint,
        p_window_key: minuteWindow,
        p_expires_at: new Date(now + 120_000).toISOString(),
      });
      if ((minCount as number) > perMinute) {
        return NextResponse.json(
          { error: "요청이 너무 많아요. 잠시 후 다시 시도해주세요." },
          { status: 429 }
        );
      }
    }

    if (perDay > 0) {
      const { data: dayCount } = await admin.rpc("increment_rate_limit", {
        p_ip: ip,
        p_endpoint: endpoint,
        p_window_key: dayWindow,
        p_expires_at: new Date(now + 172_800_000).toISOString(),
      });
      if ((dayCount as number) > perDay) {
        return NextResponse.json(
          { error: "오늘 사용 한도를 초과했어요. 내일 다시 이용해주세요." },
          { status: 429 }
        );
      }
    }
  } catch {
    // 레이트 리밋 체크 실패 시 통과 (서비스 안정성 우선)
  }

  return null;
}
