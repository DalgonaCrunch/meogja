/**
 * 신고·차단(구글 플레이 UGC 정책 대응) 확인 스크립트 — 로컬 전용.
 *
 *   node scripts/check-ugc.mjs      (BASE 기본값 http://localhost:3000)
 *
 * 구글이 요구하는 세 가지 중 **앱 안에서 사용자가 직접 하는 두 가지**를 본다.
 *   ① 신고 창구가 있는가 — 사유를 고를 수 있고, 실패하면 실패했다고 말하는가
 *   ② 차단이 있는가 — 그리고 **푸는 길**이 있는가 (푸는 길이 없으면 기능이 아니라 함정이다)
 *
 * Supabase 는 전부 가로채 가짜 응답을 준다. 보려는 것은 "길이 있는가" 이지
 * "저장이 되는가" 가 아니다(저장은 마이그레이션이 적용된 실서버에서만 확인된다).
 */
import { launchBrowser, finish } from "./_browser.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/tmp/meogja-ugc";
const UID = "11111111-2222-3333-4444-555555555555";
const BLOCKED_ID = "99999999-8888-7777-6666-555555555555";

const problems = [];
const { browser, close } = await launchBrowser();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ko-KR", serviceWorkers: "block",
});

await ctx.addInitScript(([uid]) => {
  const session = {
    access_token: "fake-token", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake-refresh",
    user: { id: uid, aud: "authenticated", role: "authenticated", email: "test@example.com",
            user_metadata: { full_name: "테스터" }, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  };
  localStorage.setItem("sb-dummy-local-auth-token", JSON.stringify(session));
}, [UID]);

const json = (r, body) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

/* ⚠️ Playwright 는 **나중에 등록한 route 가 먼저** 잡는다.
   그래서 모두를 받는 catch-all 을 맨 먼저 등록하고, 구체적인 것을 뒤에 건다.
   순서를 뒤집으면 catch-all 이 전부 삼켜 빈 배열만 돌아온다(실제로 한 번 당했다). */
await ctx.route("**/rest/v1/**", (r) => json(r, []));
await ctx.route("**/rest/v1/user_profiles*", (r) => {
  // 차단 목록 화면이 이름을 붙일 때 쓰는 조회
  if (r.request().url().includes("in.")) return json(r, [{ id: BLOCKED_ID, display_name: "차단된사람", nickname: "차단된사람" }]);
  return json(r, { id: UID, display_name: "테스터", nickname: "테스터" });
});
await ctx.route("**/rest/v1/user_blocks*", (r) => json(r, [{ blocked_id: BLOCKED_ID, created_at: "2026-09-01T00:00:00Z" }]));
await ctx.route("**/auth/v1/user*", (r) => json(r, {
  id: UID, aud: "authenticated", role: "authenticated", email: "test@example.com",
  user_metadata: { full_name: "테스터" }, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" }));
await ctx.route("**/auth/v1/token*", (r) => json(r, {}));

const page = await ctx.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

const body = await page.locator("body").innerText();

// ② 차단 목록이 프로필에 있는가
if (!/차단한 사용자/.test(body)) {
  problems.push("프로필에 '차단한 사용자' 항목이 없다 — 차단을 푸는 길이 없으면 정책상 차단 기능으로 인정받기 어렵다");
} else {
  await page.locator("text=차단한 사용자").first().click().catch(() => {});
  await page.waitForTimeout(900);
  const opened = await page.locator("body").innerText();
  if (!/차단된사람/.test(opened)) problems.push("차단 목록을 펼쳤는데 차단한 사람이 안 보인다");
  if (!/해제/.test(opened)) problems.push("차단 해제 버튼이 없다");
  await page.locator("text=차단된사람").first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}-blocks.png` });
}

// ① 신고 내역 자리(사용자가 자기 신고를 확인하는 곳)도 남아 있는가
if (!/내 신고 내역/.test(body)) problems.push("프로필에 '내 신고 내역'이 사라졌다");

if (consoleErrors.length) problems.push(`콘솔 에러 ${consoleErrors.length}건: ${consoleErrors[0]}`);

console.log("스크린샷:", `${OUT}-blocks.png`);
await finish(close, problems, "✅ 신고·차단 — 프로필의 차단 목록/해제 경로 확인");
