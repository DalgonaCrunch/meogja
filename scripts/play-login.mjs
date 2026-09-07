/**
 * Play Console 로그인 창을 띄운다. **로그인은 사람이 직접 한다.**
 *
 *   node scripts/play-login.mjs
 *
 * 창이 하나 열리고, 사용자가 거기서 구글 로그인을 한다. 로그인이 끝나면
 * 이 스크립트가 알아서 감지하고 세션을 프로필 디렉터리에 남긴 뒤 닫는다.
 * 그 뒤 scripts/play-*.mjs 들이 같은 프로필을 재사용해 로그인 없이 들어간다.
 *
 * 설계 이유:
 *  · 비밀번호·2단계 인증 코드는 스크립트가 보지도, 저장하지도 않는다.
 *    사용자가 창에 직접 넣고, 남는 것은 쿠키뿐이다.
 *  · 번들 Chromium 이 아니라 **설치된 실제 Chrome**(channel: "chrome")을 쓴다.
 *    구글은 자동화용 Chromium 로그인을 "안전하지 않은 브라우저"로 막는 일이 많다.
 *  · 사용자 본인의 크롬 프로필(~/.config/google-chrome)은 **건드리지 않는다.**
 *    전용 디렉터리를 따로 만든다. 사용자가 열어 둔 창과 섞이면 안 된다.
 *  · 창을 화면 밖으로 보내지 않는다(확인 스크립트들과 반대다). 사람이 봐야 한다.
 */
import { chromium } from "playwright";
import { homedir } from "node:os";

const PROFILE = process.env.PLAY_PROFILE || `${homedir()}/.play-console-profile`;
const WAIT_MIN = Number(process.env.WAIT_MIN || 20);

console.log(`프로필: ${PROFILE}`);
console.log("창이 열립니다. 그 창에서 구글 로그인을 해 주세요. (여기서 기다립니다)\n");

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: "chrome",
  headless: false,
  viewport: null,
  args: ["--window-size=1280,920", "--window-position=80,40", "--no-first-run", "--no-default-browser-check"],
});

const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto("https://play.google.com/console/developers", { waitUntil: "domcontentloaded" }).catch(() => {});

const deadline = Date.now() + WAIT_MIN * 60_000;
let loggedIn = false;

while (Date.now() < deadline) {
  const url = page.url();
  // /console/about/ 로 되돌려지면 아직 로그인 전이다. 개발자 계정 화면이면 통과.
  if (/play\.google\.com\/console\//.test(url) && !url.includes("/console/about")) {
    loggedIn = true;
    break;
  }
  await page.waitForTimeout(2000);
  // 로그인 후 자동으로 넘어오지 않는 경우가 있어 주기적으로 다시 찔러 본다
  if (url.includes("/console/about")) {
    await page.goto("https://play.google.com/console/developers", { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(3000);
  }
}

if (!loggedIn) {
  console.error(`\n✗ ${WAIT_MIN}분 안에 로그인이 확인되지 않았습니다. 창은 닫습니다.`);
  console.error("  다시 실행하면 프로필이 남아 있어 이어서 진행됩니다.");
  await ctx.close();
  process.exit(1);
}

console.log("✓ 로그인 확인");
console.log("  URL:", page.url());
console.log("  제목:", await page.title().catch(() => "?"));

// 개발자 계정이 여러 개일 수 있어 화면에 보이는 이름을 남겨 둔다
const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 400).replace(/\n+/g, " | ");
console.log("  화면:", text);

await ctx.close();
console.log("\n세션을 프로필에 남기고 닫았습니다. 다음 스크립트는 로그인 없이 들어갑니다.");
