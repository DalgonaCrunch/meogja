import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");
  if (!lat || !lon) return NextResponse.json({ error: "missing lat/lon" }, { status: 400 });

  try {
    const res = await fetch(
      `https://wttr.in/${lat},${lon}?format=j1`,
      { headers: { "User-Agent": "meogja-app/1.0" }, signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) throw new Error("wttr_failed");
    const data = await res.json();
    const cc = data.current_condition?.[0];
    if (!cc) throw new Error("no_data");

    const tempC = parseInt(cc.temp_C);
    const weatherCode = parseInt(cc.weatherCode);

    // 날씨 조건 분류
    let condition: "hot" | "warm" | "cool" | "cold" | "rainy" | "snowy";
    if (weatherCode >= 395 || (weatherCode >= 338 && weatherCode <= 371)) condition = "snowy";
    else if (weatherCode >= 293 || (weatherCode >= 176 && weatherCode <= 284)) condition = "rainy";
    else if (tempC >= 28) condition = "hot";
    else if (tempC >= 18) condition = "warm";
    else if (tempC >= 8) condition = "cool";
    else condition = "cold";

    const emojis: Record<string, string> = {
      hot: "☀️", warm: "🌤️", cool: "🍂", cold: "❄️", rainy: "🌧️", snowy: "⛄"
    };

    return NextResponse.json({ tempC, condition, emoji: emojis[condition] });
  } catch {
    return NextResponse.json({ error: "weather_unavailable" }, { status: 200 });
  }
}
