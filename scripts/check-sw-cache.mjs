/**
 * 서비스워커 캐시 확인 스크립트.
 *
 * owner 지적: "돌리기하고 바로 뒤로가기 눌렀더니 또 종료팝업이 한번 떴어."
 *   → 소스와 프로덕션 번들에는 그 팝업이 없다. 옛 클라이언트가 살아난 것이다.
 *
 * 옛 SW 캐시(meogja-v2)에는 **설치 시점의 "/" HTML** 이 들어 있었고, 그 HTML 은
 * 그 시점의 청크를 가리킨다. 청크 파일은 Vercel 에 계속 남아 있으니 네트워크가
 * 한 번 흔들려 캐시로 떨어지면 몇 달 전 앱이 그대로 되살아난다 —
 * 지운 기능(종료 팝업)이 다시 보이는 경로다.
 *
 * 확인 항목
 *  1) 화면 요청이 성공할 때마다 캐시가 갱신된다 → 오프라인 폴백이 최신 HTML 이다
 *  2) API/청크 요청이 실패했을 때 HTML 을 돌려주지 않는다 (JSON 파싱이 깨지면 안 된다)
 *
 *   node scripts/check-sw-cache.mjs
 *   BASE=https://meogja.vercel.app node scripts/check-sw-cache.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const problems = [];

const browser = await chromium.launch();
// serviceWorkers 를 block 하면 이 검사 자체가 헛돈다 — 반드시 allow
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, locale: "ko-KR", serviceWorkers: "allow",
});
const page = await ctx.newPage();

await page.goto(BASE, { waitUntil: "load" });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(1200);

// 1) 활성 캐시 이름
const caches1 = await page.evaluate(() => caches.keys());
console.log("캐시 목록:", caches1.join(", ") || "(없음)");
if (!caches1.includes("meogja-v3")) problems.push(`meogja-v3 캐시가 없다 (있는 것: ${caches1.join(", ") || "없음"})`);
if (caches1.some(k => k !== "meogja-v3")) problems.push(`옛 캐시가 남아 있다: ${caches1.filter(k => k !== "meogja-v3").join(", ")}`);

// 2) 캐시에 든 "/" HTML 이 지금 배포본인지 — 스플래시가 있고 종료 팝업 문구가 없어야 한다
const cached = await page.evaluate(async () => {
  const c = await caches.open("meogja-v3");
  const r = await c.match("/");
  return r ? await r.text() : null;
});
if (!cached) problems.push('캐시에 "/" HTML 이 없다');
else {
  if (!cached.includes("meogja-splash")) problems.push('캐시된 HTML 에 스플래시가 없다 — 옛 화면이 들어 있다');
  if (cached.includes("종료하시겠습니까")) problems.push("캐시된 HTML 에 종료 팝업 문구가 있다");
}

// 3) 낡은 HTML 이 캐시에 있어도 온라인 접속 한 번에 덮어써진다 (이게 이번 수정의 핵심)
await page.evaluate(async () => {
  const c = await caches.open("meogja-v3");
  await c.put("/", new Response("<html><body>STALE-OLD-APP</body></html>",
    { headers: { "content-type": "text/html" } }));
});
await page.goto(BASE, { waitUntil: "load" });
await page.waitForTimeout(1200);
const refreshed = await page.evaluate(async () => {
  const c = await caches.open("meogja-v3");
  const r = await c.match("/");
  return r ? (await r.text()).slice(0, 200) : null;
});
if (!refreshed || refreshed.includes("STALE-OLD-APP")) {
  problems.push("화면 요청이 성공해도 캐시가 갱신되지 않는다 — 옛 HTML 이 남는다");
}
console.log("낡은 캐시 갱신:", refreshed && !refreshed.includes("STALE-OLD-APP") ? "덮어써짐" : "갱신 안 됨");

// 4) 오프라인에서도 지금 화면이 뜬다
await ctx.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(1200);
const offlineHtml = await page.content();
if (!offlineHtml.includes("meogja")) problems.push("오프라인에서 화면이 뜨지 않는다");
if (offlineHtml.includes("종료하시겠습니까")) problems.push("오프라인 화면에 종료 팝업이 있다");
console.log("오프라인 폴백:", offlineHtml.includes("meogja-splash") ? "현재 HTML" : "확인 필요");

// 5) 실패한 API 요청에 HTML 을 돌려주지 않는다
const apiFallback = await page.evaluate(async () => {
  try {
    const r = await fetch("/api/weather?lat=37.5&lon=127");
    const t = await r.text();
    return t.slice(0, 40);
  } catch {
    return "__failed__"; // 깨끗하게 실패 = 정상
  }
});
if (apiFallback !== "__failed__" && /<!DOCTYPE|<html/i.test(apiFallback)) {
  problems.push(`오프라인 API 요청에 HTML 이 돌아왔다: ${apiFallback}`);
}
console.log("오프라인 API 응답:", apiFallback === "__failed__" ? "정상 실패" : apiFallback);

await ctx.setOffline(false);
await ctx.close();
await browser.close();

if (problems.length) {
  console.error("\n❌ 문제\n" + problems.map(p => " - " + p).join("\n"));
  process.exit(1);
}
console.log("\n✅ SW 캐시가 최신 화면만 들고 있고, 실패한 API 에 HTML 을 주지 않는다");
