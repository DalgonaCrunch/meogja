/**
 * 결과 카드 공유 화면 확인 (로컬 전용).
 *
 * 이 화면은 **받은 사람이 눌러보게 만드는 것**이 목적이다. 그래서 큰 그림,
 * 누가 골랐는지, 그리고 "우리도 정해보기" 가 반드시 보여야 한다.
 * 미리보기 이미지(OG)도 실제로 그려지는지 함께 본다 — 안 그려지면 링크가 밋밋해져
 * 공유의 의미가 없다.
 *
 *   node scripts/check-result-share.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/tmp/meogja-result";
const problems = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ko-KR",
  serviceWorkers: "block",
});
await ctx.route("**dummy-local.supabase.co/**", r =>
  r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message.slice(0, 200)));

const url = `${BASE}/result?m=${encodeURIComponent("김치찌개,삼겹살")}`
  + `&g=${encodeURIComponent("점심팟")}&who=${encodeURIComponent("철수,영희,민수")}`;
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}-card.png`, fullPage: true });

const title = await page.title();
if (!title.includes("김치찌개")) problems.push(`제목에 메뉴가 없다: "${title}"`);
if (!title.includes("점심팟")) problems.push(`제목에 모임 이름이 없다: "${title}"`);
if (!(await page.locator("text=김치찌개").count())) problems.push("메뉴 이름이 화면에 없다");
if ((await page.locator("text=/^👍/").count()) !== 3) problems.push("고른 사람 칩이 3개가 아니다");
if (!(await page.locator("text=이 메뉴로 주변 찾기").count())) problems.push("주변 찾기 버튼이 없다");
if (!(await page.locator("text=우리도 정해보기").count())) problems.push("'우리도 정해보기' 가 없다 — 받은 사람이 들어올 길");

// 미리보기 이미지
const og = await page.request.get(`${BASE}/api/og?type=result&title=${encodeURIComponent("김치찌개")}&sub=${encodeURIComponent("철수, 영희")}`);
if (og.status() !== 200) problems.push(`OG 이미지 status ${og.status()}`);
const ct = og.headers()["content-type"] || "";
if (!ct.includes("image")) problems.push(`OG 응답이 이미지가 아니다: ${ct}`);
else fs.writeFileSync(`${OUT}-og.png`, await og.body());

// 메타 태그가 이미지를 가리키는지
const ogMeta = await page.locator('meta[property="og:image"]').getAttribute("content").catch(() => null);
if (!ogMeta || !ogMeta.includes("type=result")) problems.push(`og:image 메타가 결과 이미지를 안 가리킨다: ${ogMeta}`);

console.log(JSON.stringify({ title, ogMeta, errs, problems }, null, 1));
console.log(problems.length ? "\n❌ 문제 " + problems.length + "건" : "\n✅ 결과 카드 확인 통과");
await browser.close();
process.exit(problems.length ? 1 : 0);
