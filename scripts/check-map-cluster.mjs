/**
 * 마커 뭉치기(클러스터) 확인 스크립트 (로컬 전용, 배포에 포함되지 않는다).
 *
 * 같은 건물 수준으로 붙어 있는 가짜 식당을 몰아 넣어, 이름표가 엉키지 않고
 * "N곳" 동그라미로 묶이는지 / 눌러서 확대하면 풀리는지 본다.
 *
 *   node scripts/check-map-cluster.mjs
 *   BASE=https://meogja.vercel.app node scripts/check-map-cluster.mjs
 */
import { launchBrowser } from "./_browser.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/tmp/meogja-cluster";
const CENTER = { lat: 37.4979, lng: 127.0276 };

// 한 지점에 8곳을 몰아 넣는다(수 m 간격) + 멀리 떨어진 2곳
const FAKE = [
  ...Array.from({ length: 8 }, (_, i) => ({
    title: `붙어있는가게${i + 1}`,
    category: "음식점 > 한식",
    address: `서울 강남구 테스트로 ${i + 1}`,
    mapx: String(127.0276 + i * 0.00004),
    mapy: String(37.4979 + i * 0.00003),
    distance: 30 + i, phone: "", link: "",
  })),
  { title: "멀리있는우동", category: "음식점 > 일식 > 우동", address: "서울 강남구 멀리로 1", mapx: "127.0360", mapy: "37.5010", distance: 900, phone: "", link: "" },
  { title: "멀리있는치킨", category: "음식점 > 치킨", address: "서울 강남구 멀리로 2", mapx: "127.0200", mapy: "37.4940", distance: 950, phone: "", link: "" },
];

const problems = [];
const { browser, close: closeBrowser } = await launchBrowser();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ko-KR",
  geolocation: { latitude: CENTER.lat, longitude: CENTER.lng },
  permissions: ["geolocation"],
  serviceWorkers: "block", // PWA 서비스워커가 가로채면 모킹이 무시된다
});
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

await ctx.route("**/api/nearby*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: FAKE, total: FAKE.length }) }));
await ctx.route("**/api/admin/settings*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ search_provider: "kakao" }) }));
await ctx.route("**/api/food-image*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await ctx.route("**/api/reverse-geocode*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ address: "역삼동" }) }));
await ctx.route("**dummy-local.supabase.co/**", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

await page.goto(`${BASE}/nearby`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);
await page.screenshot({ path: `${OUT}-1-clustered.png` });

/* 묶인 자리의 이름표는 "붙어있는가게1 · 붙어있는가게2 +6곳" 형태다.
   (묶였어도 이름을 보여준다 — 2026-08-26 owner 요청) */
const clusterCount = await page.locator("text=/\\+\\d+곳/").count();
const namesShown = await page.locator("text=/^붙어있는가게\\d$/").count();
const clusterLabel = clusterCount
  ? (await page.locator("text=/\\+\\d+곳/").first().textContent()) || ""
  : "";
const farShown = await page.locator("text=멀리있는우동").count() > 0;

if (clusterCount === 0) problems.push('겹친 마커가 묶이지 않음 (묶음 이름표가 없다)');
if (clusterCount && !clusterLabel.includes("붙어있는가게")) {
  problems.push(`묶음 이름표에 가게 이름이 없다("${clusterLabel}")`);
}
if (!farShown) problems.push("떨어져 있는 마커까지 묶여 버렸다");

/* 클러스터를 누르면 확대되어 풀린다. 같은 자리에 몰려 있으면 최대 확대까지
   가도 안 갈라지는데, 그때는 동그랗게 펼쳐져야 한다 — 계속 눌러 끝을 본다. */
let expandedOk = false;
let namesAfter = namesShown;
for (let i = 0; i < 6 && !expandedOk; i++) {
  const cluster = page.locator("text=/\\+\\d+곳/").first();
  if (!(await cluster.count())) break;
  await cluster.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  namesAfter = await page.locator("text=/^붙어있는가게\\d$/").count();
  expandedOk = namesAfter >= 4; // 8곳 중 최소 절반은 이름이 보여야 고를 수 있다
}
await page.screenshot({ path: `${OUT}-2-expanded.png` });
if (!expandedOk) problems.push(`클러스터를 끝까지 눌러도 가게를 고를 수 없다(이름표 ${namesShown} → ${namesAfter})`);

/* 한 자리를 펼친 뒤 다른 자리를 펼치면, 앞서 펼친 것이 접혀서는 안 된다
   (2026-08-26 owner 신고: "하나를 펼치면 다른 게 접힌다"). */
let keepBothOpen = true;
{
  const remaining = await page.locator("text=/\\+\\d+곳/").count();
  const namesList = await page.locator("text=/^붙어있는가게\\d$/").allTextContents();
  if (remaining > 0 && namesList.length > 0) {
    await page.locator("text=/\\+\\d+곳/").first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
    const listAfter = await page.locator("text=/^붙어있는가게\\d$/").allTextContents();
    /* 지도가 확대되면 화면 밖으로 나간 마커는 DOM 에서 사라진다(카카오가 그린다).
       그래서 개수로만 보면 접힌 것과 구분이 안 된다 → **앞서 펼친 이름이 남아 있는지**
       를 본다. 하나라도 남아 있으면 접히지 않은 것이다. */
    const survived = namesList.filter(n => listAfter.includes(n));
    keepBothOpen = survived.length > 0;
    if (!keepBothOpen) problems.push(`다른 자리를 펼치자 앞서 펼친 것이 모두 사라졌다(${namesList.join(",")} → ${listAfter.join(",")})`);
    await page.screenshot({ path: `${OUT}-5-two-open.png` });
  }
}

// 클러스터를 눌러 확대한 것이 "이 지역에서 다시 찾기" 로 오해되면 안 된다
const researchBtn = await page.getByRole("button", { name: /이 지역에서 다시 찾기/ }).count();
if (researchBtn > 0) problems.push('클러스터 확대만으로 "이 지역에서 다시 찾기" 가 떴다(줌은 이동이 아니다)');

console.log(JSON.stringify({ clusterCount, namesShown, clusterLabel, farShown, expandedOk, keepBothOpen, researchBtn, problems, consoleErrors: consoleErrors.slice(0, 6) }, null, 2));
console.log(problems.length ? "\n❌ 문제 " + problems.length + "건" : "\n✅ 클러스터 확인 통과");

await closeBrowser();
process.exit(problems.length ? 1 : 0);
