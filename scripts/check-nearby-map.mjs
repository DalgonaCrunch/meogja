/**
 * /nearby 지도 보기 화면 확인 스크립트 (로컬 전용, 배포에 포함되지 않는다)
 *
 * 실제 카카오 검색 API 키가 로컬에 없으므로 /api/nearby 응답을 가짜로 끼워 넣고,
 * 위치도 강남역으로 고정한다. 확인하려는 것은 검색이 아니라 '지도가 그려지는가' 다.
 *
 *   node scripts/check-nearby-map.mjs            (기본 http://localhost:3000)
 *   BASE=http://localhost:3311 node scripts/...
 */
import { launchBrowser } from "./_browser.mjs";

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
  // 서비스워커가 가로채면 page.route 가 안 먹는다(PWA 앱이라 SW 가 등록된다)
  serviceWorkers: "block",
};

const { browser, close: closeBrowser } = await launchBrowser();
const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();

const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

// 검색 결과·설정·이미지는 가짜로 (로컬에 키가 없다)
let nearbyCalls = 0;
await ctx.route("**/api/nearby*", (r) => {
  nearbyCalls++;
  return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: FAKE, total: FAKE.length }) });
});
await ctx.route("**/api/reverse-geocode*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ address: "역삼동" }) }));
await ctx.route("**/api/admin/settings*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ search_provider: "kakao" }) }));
await ctx.route("**/api/food-image*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) }));
await ctx.route("**dummy-local.supabase.co/**", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.route("**dummy-local.supabase.co/**", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

await page.goto(`${BASE}/nearby`, { waitUntil: "domcontentloaded" });

// 2026-08-26: 지도가 **기본 화면**이 되었다. 결과가 오면 바로 지도가 그려져야 한다.
await page.waitForSelector("text=김밥천국 강남점", { timeout: 15000 }).catch(() => problems.push("가짜 결과가 화면에 뜨지 않음"));
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}-2-map.png` });

// 목록 전환도 살아 있는지 (지도가 안 뜨는 환경의 대피로)
const listBtn = page.getByRole("button", { name: /목록/ });
await listBtn.click();
await page.waitForTimeout(600);
// 목록 화면은 지도 안내 문구가 사라지고 가게 이름은 그대로 보인다
//  (/nearby 목록 카드는 주소를 적지 않으므로 주소로 판정하면 안 된다)
const listShown =
  (await page.locator("text=파란 점이 내 위치예요").count()) === 0 &&
  (await page.locator("text=김밥천국 강남점").count()) > 0;
if (!listShown) problems.push("목록 전환이 동작하지 않음");
await page.screenshot({ path: `${OUT}-1-list.png` });

// 목록 카드의 "지도에서" → 그 가게가 골라진 상태로 지도가 뜬다
let keepPick = false;
const jumpBtn = page.getByRole("button", { name: /지도에서/ }).nth(1); // 두 번째 카드(역전우동)
if (await jumpBtn.count()) {
  await jumpBtn.click();
  await page.waitForTimeout(2500);
  keepPick = await page.locator("text=서울 강남구 테헤란로 1").count() > 0; // 지도 카드에만 주소가 있다
  await page.screenshot({ path: `${OUT}-4-jump.png` });
} else {
  problems.push('목록 카드에 "지도에서" 버튼이 없음');
}
if (!keepPick) problems.push('"지도에서" 로 넘어갔을 때 그 가게가 골라져 있지 않음');

// 마커 확인을 위해 선택 해제
await page.locator("text=✕").first().click().catch(() => {});
await page.waitForTimeout(600);

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

// 지도를 밀면 "이 지역에서 다시 찾기" 가 뜨고, 누르면 그 자리로 다시 검색한다
let searchHereOk = false;
if (diag.sdk && !diag.errText) {
  const box = await page.locator('div[style*="border-radius: 16px"]').first().boundingBox();
  if (box) {
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 170, cy - 150, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    const btn = page.getByRole("button", { name: /이 지역에서 다시 찾기/ });
    if (await btn.count()) {
      const before = nearbyCalls;
      await page.screenshot({ path: `${OUT}-5-moved.png` });
      await btn.click();
      await page.waitForTimeout(2500);
      searchHereOk = nearbyCalls > before &&
        (await page.getByRole("button", { name: /이 지역에서 다시 찾기/ }).count()) === 0;
      await page.screenshot({ path: `${OUT}-6-researched.png` });
    } else {
      problems.push('지도를 밀었는데 "이 지역에서 다시 찾기" 가 안 뜸');
    }
  }
  if (!searchHereOk) problems.push('"이 지역에서 다시 찾기" 가 재검색으로 이어지지 않음');
}

if (!diag.sdk) problems.push("카카오 지도 SDK 가 로드되지 않음 (도메인 미등록이거나 키 문제)");
if (diag.errText) problems.push("화면에 '지도를 불러오지 못했어요' 표시됨");
if (diag.loadingText) problems.push("여전히 '지도 여는 중' 상태");
if (diag.sdk && !diag.errText && diag.tiles === 0) problems.push("지도 타일 이미지가 하나도 없음");
if (diag.sdk && !diag.errText && !cardShown) problems.push("마커를 눌러도 가게 카드가 안 뜸");

console.log(JSON.stringify({ diag, cardShown, keepPick, searchHereOk, nearbyCalls, problems, consoleErrors: consoleErrors.slice(0, 8) }, null, 2));
console.log(problems.length ? "\n❌ 문제 " + problems.length + "건" : "\n✅ 지도 확인 통과");

await closeBrowser();
process.exit(problems.length ? 1 : 0);
