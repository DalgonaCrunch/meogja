/**
 * /search (홈 → "모임 없이 바로 주변 찾기" 로 들어가는 화면) 지도 확인 스크립트.
 * 로컬 전용 — 배포에 포함되지 않는다.
 *
 * 이 화면은 sessionStorage 의 meogja_preset_menus(고른 메뉴)와
 * meogja_search_location(기준 좌표)을 받아 검색한다. 로컬에는 검색 키가 없으므로
 * /api/search-kakao 응답을 가짜로 끼워 넣는다.
 *
 *   node scripts/check-search-map.mjs
 *   BASE=http://localhost:3311 node scripts/check-search-map.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/tmp/meogja-search-map";

const CENTER = { lat: 37.4979, lng: 127.0276 };
// 카카오/구글은 십진 도, 네이버는 1e7 배 정수를 준다 → 둘 다 섞어 넣어 변환을 확인한다
const FAKE_KAKAO = [
  { title: "김밥천국 강남점", category: "음식점 > 분식", address: "서울 강남구 강남대로 396", roadAddress: "서울 강남구 강남대로 396", mapx: "127.0271", mapy: "37.4985", distance: 90, link: "" },
  { title: "역전우동 강남", category: "음식점 > 일식 > 우동", address: "서울 강남구 테헤란로 1", roadAddress: "서울 강남구 테헤란로 1", mapx: "127.0301", mapy: "37.4972", distance: 240, link: "" },
  { title: "<b>버거킹</b> 강남중앙", category: "음식점 > 패스트푸드", address: "서울 강남구 강남대로 390", roadAddress: "서울 강남구 강남대로 390", mapx: "1270259000", mapy: "374961000", distance: 260, link: "" },
  { title: "좌표없는가게", category: "음식점 > 한식", address: "서울 강남구 어딘가", roadAddress: "", mapx: "", mapy: "", distance: 500, link: "" },
];

const problems = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "ko-KR",
  geolocation: { latitude: CENTER.lat, longitude: CENTER.lng },
  permissions: ["geolocation"],
  // PWA 서비스워커가 요청을 가로채면 route 모킹이 통째로 무시된다
  serviceWorkers: "block",
});
const page = await ctx.newPage();

const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

await ctx.route("**/api/search-kakao*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: FAKE_KAKAO }) }));
await ctx.route("**/api/admin/settings*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ search_provider: "kakao" }) }));
await ctx.route("**/api/food-image*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) }));
await ctx.route("**/api/food-stats*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await ctx.route("**dummy-local.supabase.co/**", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

// 홈에서 넘어온 상태를 재현: 고른 메뉴 + 기준 좌표
await ctx.addInitScript(([lat, lng]) => {
  sessionStorage.setItem("meogja_preset_menus", JSON.stringify(["우동", "분식"]));
  sessionStorage.setItem("meogja_search_location", JSON.stringify({ lat, lng }));
  sessionStorage.setItem("meogja_home_location", JSON.stringify({ lat, lng, label: "강남역" }));
}, [CENTER.lat, CENTER.lng]);

await page.goto(`${BASE}/search`, { waitUntil: "domcontentloaded" });

// 결과가 오는지
await page.waitForSelector("text=역전우동 강남", { timeout: 20000 })
  .catch(() => problems.push("검색 결과가 화면에 뜨지 않음"));
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}-1-map.png` });

const diag = await page.evaluate(() => {
  const w = window;
  return {
    sdk: !!(w.kakao && w.kakao.maps && w.kakao.maps.LatLng),
    tiles: document.querySelectorAll('img[src*="map"], img[src*="daumcdn"]').length,
    errText: document.body.innerText.includes("지도를 불러오지 못했어요"),
    loadingText: document.body.innerText.includes("지도 여는 중"),
    toggle: !!Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("지도")),
    skipNote: document.body.innerText.includes("지도에 표시되지 않아요"),
    htmlTagLeak: document.body.innerHTML.includes("&lt;b&gt;버거킹") || document.body.innerText.includes("<b>버거킹"),
  };
});

// 마커 클릭 → 가게 카드
let cardShown = false;
if (diag.sdk && !diag.errText) {
  const marker = page.locator("text=역전우동 강남").last();
  if (await marker.count()) {
    await marker.click({ force: true }).catch(() => {});
    await page.waitForTimeout(900);
    cardShown = await page.locator("text=같이 먹을 사람 구하기").count() > 0;
    await page.screenshot({ path: `${OUT}-2-picked.png` });
  }
}

// 목록 전환 (지도가 안 뜨는 환경의 대피로)
await page.getByRole("button", { name: /목록/ }).click().catch(() => problems.push("목록 토글 버튼이 없음"));
await page.waitForTimeout(500);
const listShown = await page.locator("text=좌표없는가게").count() > 0;
await page.screenshot({ path: `${OUT}-3-list.png` });

// 좌표 없는 가게에는 "지도에서" 버튼이 없어야 한다 (목록이 보이는 동안 센다)
const jumpCount = await page.getByRole("button", { name: /지도에서/ }).count();
if (jumpCount !== 3) problems.push(`"지도에서" 버튼 수가 3이 아님(${jumpCount}) — 좌표 있는 결과 3곳에만 붙어야 한다`);

// 목록 카드의 "지도에서" → 그 가게가 골라진 상태로 지도가 뜬다
let keepPick = false;
const jumpBtn = page.getByRole("button", { name: /지도에서/ }).nth(1); // 역전우동
if (await jumpBtn.count()) {
  await jumpBtn.click();
  await page.waitForTimeout(2500);
  keepPick = await page.locator("text=서울 강남구 테헤란로 1").count() > 0;
  await page.screenshot({ path: `${OUT}-4-jump.png` });
} else {
  problems.push('목록 카드에 "지도에서" 버튼이 없음');
}
if (!keepPick) problems.push('"지도에서" 로 넘어갔을 때 그 가게가 골라져 있지 않음');

if (!diag.toggle) problems.push("목록/지도 토글이 없음");
if (!diag.sdk) problems.push("카카오 지도 SDK 가 로드되지 않음 (도메인 미등록이거나 키 문제)");
if (diag.errText) problems.push("화면에 '지도를 불러오지 못했어요' 표시됨");
if (diag.loadingText) problems.push("여전히 '지도 여는 중' 상태");
if (diag.sdk && !diag.errText && diag.tiles === 0) problems.push("지도 타일 이미지가 하나도 없음");
if (diag.sdk && !diag.errText && !cardShown) problems.push("마커를 눌러도 가게 카드가 안 뜸");
if (!diag.skipNote) problems.push("좌표 없는 결과 안내 문구가 안 보임");
if (diag.htmlTagLeak) problems.push("제목의 <b> 태그가 그대로 노출됨");
if (!listShown) problems.push("목록 전환이 동작하지 않음(좌표 없는 가게가 목록에 없음)");

console.log(JSON.stringify({ diag, cardShown, listShown, problems, consoleErrors: consoleErrors.slice(0, 8) }, null, 2));
console.log(problems.length ? "\n❌ 문제 " + problems.length + "건" : "\n✅ /search 지도 확인 통과");

await browser.close();
process.exit(problems.length ? 1 : 0);
