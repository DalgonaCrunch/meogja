import { NextRequest, NextResponse } from "next/server";
import { getApiStats } from "@/lib/apiTracker";

export async function GET(req: NextRequest) {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const authHeader = req.headers.get("x-admin-email");
  if (!adminEmail || authHeader !== adminEmail) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  try {
    const stats = await getApiStats();
    return NextResponse.json({ stats });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
