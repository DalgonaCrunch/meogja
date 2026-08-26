/**
 * 공유된 결과 카드 — "우리 오늘 이거 먹어요".
 *
 * 서버에 저장하는 것이 없다. 주소에 담긴 것만으로 화면과 미리보기 이미지를 만든다
 * (m=메뉴, g=모임 이름, who=고른 사람들).
 *
 * 이 화면의 목적은 자랑이 아니라 **다음 사람이 눌러보게 만드는 것**이다.
 * 그래서 큰 그림 + 누가 골랐는지 + "우리도 정해보기" 버튼만 둔다.
 */

import type { Metadata } from "next";
import ResultCard from "./ResultCard";

const BASE_URL = "https://meogja.vercel.app";

type Search = { m?: string; g?: string; who?: string };

function parse(sp: Search) {
  const menus = (sp.m || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 4);
  const who = (sp.who || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 8);
  const groupName = (sp.g || "").trim();
  return { menus, who, groupName };
}

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<Search> }
): Promise<Metadata> {
  const { menus, who, groupName } = parse(await searchParams);
  const menu = menus[0] || "오늘 메뉴";
  const title = groupName ? `${groupName} 오늘 메뉴는 ${menu}!` : `오늘 메뉴는 ${menu}!`;
  const description = who.length
    ? `${who.join(", ")} 취향을 모아서 정했어요. 우리도 정해볼까요?`
    : "먹자냥이 취향을 모아 메뉴를 정해줘요.";
  const og = `${BASE_URL}/api/og?type=result&title=${encodeURIComponent(menu)}`
    + `&sub=${encodeURIComponent(groupName || (who.length ? who.join(", ") : ""))}`;

  return {
    title, description,
    openGraph: { title, description, images: [og], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

export default async function ResultPage(
  { searchParams }: { searchParams: Promise<Search> }
) {
  const { menus, who, groupName } = parse(await searchParams);
  return <ResultCard menus={menus} who={who} groupName={groupName} />;
}
