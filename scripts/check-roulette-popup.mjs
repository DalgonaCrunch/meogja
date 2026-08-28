/**
 * 홈 랜덤 돌리기 팝업 노출 주기 확인 (로컬·실서비스 공용).
 *
 * owner 요청: "홈에서 랜덤 돌리기 팝업은 하루 한번만 띄우자"
 *   예전에는 sessionStorage 라 앱을 닫고 다시 열 때마다 떴다 — 하루에도 여러 번이다.
 *
 * 확인 항목
 *  1) 처음 들어오면 뜬다
 *  2) 같은 날 다시 들어오면 뜨지 않는다 (앱을 껐다 켠 상황 = 새 세션)
 *  3) 저장된 날짜가 어제면 다시 뜬다
 *  4) 날짜 키가 로컬 기준이다 — toISOString() 을 쓰면 한국은 오전 9시에 날이 바뀌어
 *     아침에 본 팝업이 9시에 또 뜬다
 *
 *   node scripts/check-roulette-popup.mjs
 *   BASE=https://meogja.vercel.app node scripts/check-roulette-popup.mjs
 */
import { launchBrowser } from "./_browser.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
const KEY = "meogja_roulette_seen_date";
const problems = [];

const { browser, close: closeBrowser } = await launchBrowser();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, locale: "ko-KR", serviceWorkers: "block",
  timezoneId: "Asia/Seoul",
});
const page = await ctx.newPage();

const popupShown = async () => {
  // 팝업 안에만 있는 "나중에" 버튼으로 판별한다
  await page.waitForTimeout(1500);
  return (await page.locator("text=나중에").count()) > 0;
};
const stored = () => page.evaluate((k) => localStorage.getItem(k), KEY);

// 1) 첫 방문
await page.goto(BASE, { waitUntil: "domcontentloaded" });
const first = await popupShown();
if (!first) problems.push("첫 방문에 팝업이 뜨지 않는다");
const savedKey = await stored();
console.log("첫 방문:", first ? "떴다" : "안 떴다", "/ 저장된 날짜:", savedKey);

// 4) 저장된 날짜가 로컬 기준인지 (UTC 로 저장하면 한국 오전 0~9시에 어제 날짜가 찍힌다)
const expected = await page.evaluate(() => {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
});
if (savedKey !== expected) problems.push(`날짜 키가 로컬 기준이 아니다 (저장 ${savedKey} / 로컬 ${expected})`);

// 2) 같은 날 재방문 — 앱을 껐다 켠 상황이므로 sessionStorage 는 비우고 localStorage 는 남긴다
await page.evaluate(() => sessionStorage.clear());
await page.goto(BASE, { waitUntil: "domcontentloaded" });
const second = await popupShown();
if (second) problems.push("같은 날 다시 들어왔는데 팝업이 또 뜬다");
console.log("같은 날 재방문:", second ? "또 떴다" : "안 떴다");

// 3) 어제 본 것으로 바꾸면 다시 뜬다
await page.evaluate((k) => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  const p = (n) => String(n).padStart(2, "0");
  localStorage.setItem(k, `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
}, KEY);
await page.goto(BASE, { waitUntil: "domcontentloaded" });
const nextDay = await popupShown();
if (!nextDay) problems.push("날이 바뀌었는데 팝업이 뜨지 않는다");
console.log("다음 날:", nextDay ? "다시 떴다" : "안 떴다");

await closeBrowser();

if (problems.length) {
  console.error("\n❌ 문제\n" + problems.map((p) => " - " + p).join("\n"));
  process.exit(1);
}
console.log("\n✅ 팝업이 하루 한 번만 뜬다");
