import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function GET() {
  const { data, error } = await adminClient()
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data });
}

export async function PATCH(req: NextRequest) {
  const { id, status, admin_note } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id, status required" }, { status: 400 });
  const { error } = await adminClient()
    .from("reports")
    .update({ status, admin_note })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
