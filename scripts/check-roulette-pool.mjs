/**
 * 홈 "돌리기" 후보 풀 확인 스크립트 (로컬·실서비스 공용).
 *
 * owner 지적: "가끔 돌리기를 눌러도 떡볶이로 고정되어 있다가 결과도 떡볶이로 나온다.
 *              최초에만 이러고 그다음엔 안 그런다."
 *
 * 원인 자리:
 *   후보 풀을 시간대·나이대·날씨·트렌딩에서 모은다. 그런데 첫 진입 팝업은 mount 즉시 뜨고
 *   트렌딩·나이·날씨는 그때 아직 로드되지 않았다. 남는 것은 시간대 목록뿐인데, 거기서
 *   한 끼(isMealFood)만 걸러내면 오후(14~17시)는 "떡볶이" 하나만 남는다.
 *   후보가 하나면 몇 번을 돌려도 같은 결과라, 사용자에게는 버튼이 죽은 것으로 보인다.
 *
 * 그래서 이 스크립트는 **트렌딩 응답을 15초 지연**시켜 첫 진입 순간을 붙잡아 둔 뒤
 * 시간대별로 여러 번 돌려, 결과가 한 가지로 고정되는 시간대가 있으면 잡는다.
 * 응답을 즉시 채워 주면 트렌딩 기본 목록이 곧바로 들어와 문제가 가려진다 — 지연이 핵심이다.
 *
 *   node scripts/check-roulette-pool.mjs
 *   BASE=https://meogja.vercel.app node scripts/check-roulette-pool.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const SPINS = Number(process.env.SPINS || 6);
const MIN_UNIQUE = Number(process.env.MIN_UNIQUE || 3);
// 시간대마다 하나씩 (새벽·아침·오전·점심·오후·저녁·야식)
const HOURS = (process.env.HOURS || "2,7,10,12,15,19,23").split(",").map(Number);

const problems = [];
const browser = await chromium.launch();

for (const hour of HOURS) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, locale: "ko-KR", serviceWorkers: "block",
  });
  // 시간대만 고정한다. Date 전체를 갈면 다른 로직이 흔들린다.
  await ctx.addInitScript(`(() => { const h = ${hour}; Date.prototype.getHours = function () { return h; }; })()`);
  // 첫 진입 순간 고정: 트렌딩(Supabase)·날씨가 아직 안 온 상태를 유지한다.
  // 즉시 응답하면 트렌딩 기본 목록이 바로 채워져 문제가 보이지 않는다.
  await ctx.route("**/rest/v1/**", async r => {
    await new Promise(res => setTimeout(res, 15000));
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await ctx.route("**/api/weather**", async r => {
    await new Promise(res => setTimeout(res, 15000));
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  // 첫 진입 팝업이 온보딩 투어에 가릴 수 있다 — 투어만 걷어내고 팝업은 남긴다
  await page.locator("text=건너뛰기").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);

  // 팝업이 떠 있으면 팝업의 돌리기를, 아니면 홈 카드의 돌리기를 쓴다
  const popupResult = page.locator('[data-testid="roulette-popup-result"]');
  const popupSpin = page.getByRole("button", { name: /돌리기/ }).first();
  const homeSpin = page.locator('[data-tour-id="tour-roulette"]').first();
  const usePopup = await popupSpin.count() > 0 && await page.locator("text=나중에").count() > 0;
  const spin = usePopup ? popupSpin : homeSpin;
  const result = usePopup ? popupResult : page.locator('[data-testid="roulette-result"]');

  if (!(await spin.count())) { problems.push(`${hour}시: 돌리기 버튼을 찾지 못했다`); await ctx.close(); continue; }

  const results = new Set();
  for (let i = 0; i < SPINS; i++) {
    await spin.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2600); // 룰렛이 20틱 돌고 멈춘다
    const txt = await result.first().innerText().catch(() => "");
    if (txt) results.add(txt.replace("!", "").trim());
  }

  const slot = hour < 5 ? "새벽" : hour < 9 ? "아침" : hour < 11 ? "오전"
    : hour < 14 ? "점심" : hour < 17 ? "오후" : hour < 21 ? "저녁" : "야식";
  const list = [...results];
  console.log(`${hour}시(${slot}) ${usePopup ? "팝업" : "홈카드"} ${SPINS}회 → ${list.length}종: ${list.join(", ") || "결과 없음"}`);
  if (list.length < MIN_UNIQUE) {
    problems.push(`${hour}시(${slot}): ${SPINS}번 돌렸는데 ${list.length}종만 나왔다 (${list.join(", ") || "결과 없음"})`);
  }
  await ctx.close();
}

await browser.close();

if (problems.length) {
  console.error("\n❌ 문제\n" + problems.map(p => " - " + p).join("\n"));
  process.exit(1);
}
console.log("\n✅ 첫 진입 순간에도 모든 시간대에서 후보가 충분히 섞인다");
