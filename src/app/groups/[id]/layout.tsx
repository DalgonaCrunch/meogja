import { createClient } from "@supabase/supabase-js";
import { Metadata } from "next";

const BASE_URL = "https://meogja.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: group } = await supabase
    .from("groups")
    .select("name, emoji")
    .eq("id", id)
    .single();

  const groupLabel = group ? `${group.emoji || "🍽️"} ${group.name}` : "우리 모임";
  const title = `${groupLabel} — 오늘 뭐 먹지?`;
  const description = "같이 뭐 먹을지 투표·추천·배틀로 정해봐요!";
  const ogImage = `${BASE_URL}/api/og?type=group&title=${encodeURIComponent(groupLabel)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/groups/${id}`,
      siteName: "meogja",
      images: [{ url: ogImage, width: 1200, height: 630, alt: groupLabel }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
