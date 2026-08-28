/**
 * /taste (취향 스와이프) 화면 확인 스크립트 (로컬 전용).
 *
 * 로그인 상태가 필요해서 가짜 세션을 localStorage 에 심고, Supabase 호출은
 * 전부 가로채 가짜 응답을 준다. 보려는 것은 "카드가 넘어가고 저장이 나가는가" 다.
 *
 *   node scripts/check-taste.mjs
 */
import { launchBrowser } from "./_browser.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/tmp/meogja-taste";
const UID = "11111111-2222-3333-4444-555555555555";

const problems = [];
const { browser, close: closeBrowser } = await launchBrowser();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ko-KR",
  serviceWorkers: "block",
});

// 가짜 로그인 세션 (dummy-local 프로젝트 ref 기준 키)
await ctx.addInitScript(([uid]) => {
  const session = {
    access_token: "fake-token", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake-refresh",
    user: { id: uid, aud: "authenticated", role: "authenticated", email: "test@example.com",
            user_metadata: { full_name: "테스터" }, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  };
  localStorage.setItem("sb-dummy-local-auth-token", JSON.stringify(session));
}, [UID]);

const writes = [];
await ctx.route("**/auth/v1/user*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    id: UID, aud: "authenticated", role: "authenticated", email: "test@example.com",
    user_metadata: { full_name: "테스터" }, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" }) }));
await ctx.route("**/auth/v1/token*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await ctx.route("**/rest/v1/user_profiles*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: UID, display_name: "테스터" }) }));
await ctx.route("**/rest/v1/menu_ingredients*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
/* ⚠️ Playwright 는 **나중에 등록한 route 가 먼저** 잡는다. 그래서 세는 일은
   모두를 받는 route 안에서 한다(따로 두면 위 catch-all 에 가려 0건이 된다). */
await ctx.route("**/rest/v1/**", (r) => {
  const req = r.request();
  if (req.url().includes("user_food_preferences") && req.method() !== "GET") {
    writes.push({ method: req.method(), body: req.postData() || "" });
  }
  return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
});

const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

await page.goto(`${BASE}/taste?onboarding=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}-1-card.png` });

// 로그인 화면이 뜨면 가짜 세션이 안 먹은 것
if (await page.locator("text=먼저 로그인해 주세요").count()) {
  problems.push("가짜 세션이 안 먹혀 로그인 화면이 떴다(테스트 준비 실패)");
} else {
  // 첫 카드(중분류)가 보이는가
  const hasCard = await page.locator("text=어떤 걸 좋아해요?").count() > 0;
  if (!hasCard) problems.push("첫 카드 화면이 안 보인다");

  // 버튼으로 3장 넘긴다 (좋아 / 못 먹어 / 상관없어)
  const before = await page.locator("text=/^\\d+\\/\\d+$/").count();
  await page.getByRole("button", { name: "좋아" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "못 먹어" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "상관없어" }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}-2-after3.png` });
  if (writes.length < 2) problems.push(`저장 요청이 안 나갔다(${writes.length}건) — 넘길 때마다 저장돼야 한다`);
  void before;

  // "나중에 할게요" → 재료 화면
  await page.locator("text=나중에 할게요").click();
  await page.waitForTimeout(600);
  const onIngredient = await page.locator("text=못 먹는 재료가 있나요?").count() > 0;
  if (!onIngredient) problems.push("'나중에 할게요' 로 재료 화면에 못 갔다");
  await page.screenshot({ path: `${OUT}-3-ingredient.png` });

  // 재료 두 개 고르고 마무리
  await page.getByRole("button", { name: "새우" }).click();
  await page.getByRole("button", { name: "마라" }).click();
  await page.waitForTimeout(300);
  await page.locator("text=다 골랐어요").click();
  await page.waitForTimeout(900);
  const done = await page.locator("text=취향 등록 완료").count() > 0;
  if (!done) problems.push("마무리 화면이 안 나왔다");
  await page.screenshot({ path: `${OUT}-4-done.png` });
}

console.log(JSON.stringify({ writes: writes.length, problems, consoleErrors: consoleErrors.slice(0, 6) }, null, 2));
console.log(problems.length ? "\n❌ 문제 " + problems.length + "건" : "\n✅ 취향 화면 확인 통과");
await closeBrowser();
process.exit(problems.length ? 1 : 0);
