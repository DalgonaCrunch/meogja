import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/adminAuth";
import { getApiStats } from "@/lib/apiTracker";

export async function GET(req: NextRequest) {
  /* 로그인 토큰으로 확인한다 — 헤더에 이메일만 적어 부르던 방식은 누구나 흉내낼 수
     있었다(NEXT_PUBLIC_ADMIN_EMAIL 은 브라우저 번들에 들어 있다). */
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  try {
    const stats = await getApiStats();
    return NextResponse.json({ stats });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
