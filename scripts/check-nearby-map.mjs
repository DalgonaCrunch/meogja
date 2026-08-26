/**
 * /nearby 지도 보기 화면 확인 스크립트 (로컬 전용, 배포에 포함되지 않는다)
 *
 * 실제 카카오 검색 API 키가 로컬에 없으므로 /api/nearby 응답을 가짜로 끼워 넣고,
 * 위치도 강남역으로 고정한다. 확인하려는 것은 검색이 아니라 '지도가 그려지는가' 다.
 *
 *   node scripts/check-nearby-map.mjs            (기본 http://localhost:3000)
 *   BASE=http://localhost:3311 node scripts/...
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/tmp/meogja-map";

// 강남역 근처 실제 좌표들
const CENTER = { lat: 37.4979, lng: 127.0276 };
const FAKE = [
  { title: "김밥천국 강남점", category: "음식점 > 분식", address: "서울 강남구 강남대로 396", mapx: "127.0271", mapy: "37.4985", distance: 90, phone: "02-123-4567", link: "" },
  { title: "역전우동 강남", category: "음식점 > 일식 > 우동", address: "서울 강남구 테헤란로 1", mapx: "127.0301", mapy: "37.4972", distance: 240, phone: "", link: "" },
  { title: "버거킹 강남중앙", category: "음식점 > 패스트푸드", address: "서울 강남구 강남대로 390", mapx: "127.0259", mapy: "37.4961", distance: 260, phone: "", link: "" },
  { title: "스타벅스 강남대로점", category: "음식점 > 카페", address: "서울 강남구 강남대로 402", mapx: "127.0289", mapy: "37.5002", distance: 300, phone: "", link: "" },
  { title: "교촌치킨 역삼", category: "음식점 > 치킨", address: "서울 강남구 역삼동", mapx: "127.0325", mapy: "37.4995", distance: 480, phone: "", link: "" },
];

const problems = [];

const ctxOpts = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "ko-KR",
  geolocation: { latitude: CENTER.lat, longitude: CENTER.lng },
  permissions: ["geolocation"],
};

const browser = await chromium.launch();
const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();

const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

// 검색 결과·설정·이미지는 가짜로 (로컬에 키가 없다)
await page.route("**/api/nearby*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: FAKE, total: FAKE.length }) }));
await page.route("**/api/admin/settings*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ search_provider: "kakao" }) }));
await page.route("**/api/food-image*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) }));
await page.route("**dummy-local.supabase.co/**", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await page.route("**dummy-local.supabase.co/**", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

await page.goto(`${BASE}/nearby`, { waitUntil: "domcontentloaded" });

// 목록이 뜨는지 먼저
await page.waitForSelector("text=김밥천국 강남점", { timeout: 15000 }).catch(() => problems.push("목록에 가짜 결과가 뜨지 않음"));
await page.screenshot({ path: `${OUT}-1-list.png` });

// 지도로 전환
const mapBtn = page.getByRole("button", { name: /지도/ });
await mapBtn.click();
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}-2-map.png` });

// SDK 가 실제로 붙었는지 / 지도 타일이 생겼는지
const diag = await page.evaluate(() => {
  const w = window;
  const sdk = !!(w.kakao && w.kakao.maps && w.kakao.maps.LatLng);
  // 카카오 지도는 컨테이너 안에 자체 DOM 을 만든다
  const container = document.querySelector('div[style*="border-radius: 16px"]');
  const tiles = document.querySelectorAll('img[src*="map"], img[src*="daumcdn"]').length;
  const overlays = document.querySelectorAll(".overlay_info, div").length;
  const errText = document.body.innerText.includes("지도를 불러오지 못했어요");
  const loadingText = document.body.innerText.includes("지도 여는 중");
  return { sdk, tiles, hasContainer: !!container, errText, loadingText, overlays };
});

// 마커(이모지 오버레이) 클릭 → 가게 카드
let cardShown = false;
if (diag.sdk && !diag.errText) {
  const marker = page.locator("text=역전우동 강남").last();
  if (await marker.count()) {
    await marker.click({ force: true }).catch(() => {});
    await page.waitForTimeout(900);
    cardShown = await page.locator("text=서울 강남구 테헤란로 1").count() > 0;
    await page.screenshot({ path: `${OUT}-3-picked.png` });
  }
}

if (!diag.sdk) problems.push("카카오 지도 SDK 가 로드되지 않음 (도메인 미등록이거나 키 문제)");
if (diag.errText) problems.push("화면에 '지도를 불러오지 못했어요' 표시됨");
if (diag.loadingText) problems.push("여전히 '지도 여는 중' 상태");
if (diag.sdk && !diag.errText && diag.tiles === 0) problems.push("지도 타일 이미지가 하나도 없음");
if (diag.sdk && !diag.errText && !cardShown) problems.push("마커를 눌러도 가게 카드가 안 뜸");

console.log(JSON.stringify({ diag, cardShown, problems, consoleErrors: consoleErrors.slice(0, 8) }, null, 2));
console.log(problems.length ? "\n❌ 문제 " + problems.length + "건" : "\n✅ 지도 확인 통과");

await browser.close();
process.exit(problems.length ? 1 : 0);
