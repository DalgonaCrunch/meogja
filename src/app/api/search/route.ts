import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query");
  const x = request.nextUrl.searchParams.get("x");
  const y = request.nextUrl.searchParams.get("y");

  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Naver API credentials not configured" },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    query: `${query} 맛집`,
    display: "5",
    sort: x && y ? "random" : "comment",
  });

  if (x && y) {
    params.set("x", x);
    params.set("y", y);
  }

  const res = await fetch(
    `https://openapi.naver.com/v1/search/local.json?${params}`,
    {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "Naver API error", detail: text },
      { status: res.status }
    );
  }

  const data = await res.json();
  const items = (data.items || []).map(
    (d: Record<string, string>) => ({
      title: d.title?.replace(/<[^>]*>/g, ""),
      category: d.category,
      address: d.roadAddress || d.address,
      mapx: d.mapx,
      mapy: d.mapy,
      link: d.link,
    })
  );

  return NextResponse.json({ items });
}
