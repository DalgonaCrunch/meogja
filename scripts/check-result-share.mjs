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
else {
  const body = await og.body();
  fs.writeFileSync(`${OUT}-og.png`, body);
  /* 그림이 들어간 카드는 20KB 아래로 내려가지 않는다. 예전처럼 이모지 한 글자만
     그리면 파일이 확 작아진다 — 그림이 빠진 것을 크기로 잡는다. */
  if (body.length < 40_000) problems.push(`미리보기 이미지가 너무 단순하다(${body.length}바이트) — 음식 그림이 빠진 듯`);
}

// 메타 태그가 이미지를 가리키는지
const ogMeta = await page.locator('meta[property="og:image"]').getAttribute("content").catch(() => null);
if (!ogMeta || !ogMeta.includes("type=result")) problems.push(`og:image 메타가 결과 이미지를 안 가리킨다: ${ogMeta}`);

/* 가게 공유도 같은 화면을 쓴다 — 메뉴를 정한 다음에는 "어디서" 가 남는다 */
const placeUrl = `${BASE}/result?p=${encodeURIComponent("역전우동 강남")}`
  + `&c=${encodeURIComponent("음식점 > 일식 > 우동")}&a=${encodeURIComponent("서울 강남구 테헤란로 1")}`
  + `&g=${encodeURIComponent("점심팟")}`;
await page.goto(placeUrl, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}-place.png`, fullPage: true });
const placeTitle = await page.title();
if (!placeTitle.includes("역전우동")) problems.push(`가게 공유 제목에 가게 이름이 없다: "${placeTitle}"`);
if (!(await page.locator("text=지도에서 보기").count())) problems.push("가게 공유에 '지도에서 보기' 가 없다");
const placeOg = await page.locator('meta[property="og:image"]').getAttribute("content").catch(() => null);
if (!placeOg || !placeOg.includes("type=place")) problems.push(`가게 og:image 가 place 형식이 아니다: ${placeOg}`);
const placeImg = await page.request.get(`${BASE}/api/og?type=place&title=${encodeURIComponent("역전우동")}&cat=${encodeURIComponent("우동")}`);
if (placeImg.status() !== 200) problems.push(`가게 OG 이미지 status ${placeImg.status()}`);
else {
  const body = await placeImg.body();
  fs.writeFileSync(`${OUT}-place-og.png`, body);
  if (body.length < 40_000) problems.push(`가게 OG 이미지가 너무 단순하다(${body.length}바이트)`);
}

console.log(JSON.stringify({ title, ogMeta, placeTitle, errs, problems }, null, 1));
console.log(problems.length ? "\n❌ 문제 " + problems.length + "건" : "\n✅ 결과 카드 확인 통과");
await browser.close();
process.exit(problems.length ? 1 : 0);
