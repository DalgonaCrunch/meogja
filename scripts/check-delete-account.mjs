/**
 * /delete-account (계정 삭제 요청 공개 페이지) 확인 스크립트.
 *
 * 구글 플레이 요건 셋을 화면에서 실제로 확인한다.
 *  1) 앱 또는 개발자 이름이 적혀 있는가
 *  2) 삭제 요청 절차가 눈에 띄는가 (앱 내 경로 + 이메일 경로)
 *  3) 삭제되는 데이터 / 보관되는 데이터와 보관 기간이 적혀 있는가
 * 그리고 로그인 없이 열리는가(리다이렉트 없음)를 본다.
 *
 *   node scripts/check-delete-account.mjs
 */
import { launchBrowser, finish } from "./_browser.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/tmp/meogja-delete-account";

const problems = [];
const { browser, close } = await launchBrowser();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ko-KR",
  serviceWorkers: "block",
});
const page = await ctx.newPage();

const res = await page.goto(`${BASE}/delete-account`, { waitUntil: "networkidle" });

if (!res || res.status() !== 200) problems.push(`응답이 200 이 아니다: ${res?.status()}`);

// networkidle 은 하이드레이션 완료를 뜻하지 않는다. 스플래시가 걷힐 때까지 기다린 뒤 본다.
await page
  .waitForFunction(() => !document.querySelector(".meogja-splash"), null, { timeout: 5000 })
  .catch(() => problems.push("스플래시가 5초 안에 안 걷힌다 — 문서 페이지에서는 아예 안 떠야 한다"));
if (!page.url().includes("/delete-account")) {
  problems.push(`로그인 없이 열리지 않는다 — ${page.url()} 로 튕겼다`);
}

const text = await page.locator("body").innerText();

const need = [
  ["개발자/앱 이름", /오늘 뭐 먹지\?|meogja/],
  ["개발자명", /DalgonaCrunch/],
  ["앱 내 절차", /회원 탈퇴/],
  ["이메일 경로", /@/],
  ["삭제되는 데이터", /삭제되는 데이터/],
  ["보관 기간", /보관.*기간|1년/],
  ["개인정보처리방침 링크", /개인정보처리방침/],
];
for (const [name, re] of need) {
  if (!re.test(text)) problems.push(`${name} 문구가 안 보인다 (${re})`);
}

const mailto = await page.locator('a[href^="mailto:"]').count();
if (mailto === 0) problems.push("mailto: 링크가 없다 — 로그인 못 하는 사용자의 요청 경로가 막힌다");

// 가로 스크롤이 생기면 스토어 심사자가 모바일에서 보기 나쁘다
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth
);
if (overflow > 1) problems.push(`가로 스크롤이 ${overflow}px 생긴다`);

await page.screenshot({ path: `${OUT}.png`, fullPage: true });
console.log(`스크린샷: ${OUT}.png`);
console.log(`mailto 링크: ${mailto}개`);

await finish(close, problems, "✅ /delete-account — 구글 요건 3종 + 공개 접근 확인");
