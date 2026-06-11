import { createClient } from "@supabase/supabase-js";
import { Metadata } from "next";

const BASE_URL = "https://meogja.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ voteId: string }>;
}): Promise<Metadata> {
  const { voteId } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: vote } = await supabase
    .from("group_votes")
    .select("title")
    .eq("id", voteId)
    .single();

  const voteTitle = vote?.title ? `"${vote.title}" 투표` : "투표";
  const title = `🗳️ ${voteTitle} 결과는? — meogja`;
  const description = "지금 meogja에서 확인해봐요!";
  const ogImage = `${BASE_URL}/api/og?type=vote`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/vote/${voteId}`,
      siteName: "meogja",
      images: [{ url: ogImage, width: 1200, height: 630, alt: voteTitle }],
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

export default function VoteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
