/**
 * 홈 랜덤 추천(식사/디저트 토글) 확인 스크립트 (로컬·실서비스 공용).
 *
 * owner 지적으로 두 번 고친 자리다:
 *  1) 한 끼 랜덤에 디저트·음료가 섞여 나왔다(시간대·날씨 목록에 들어 있었다)
 *  2) "디저트로 뽑기" 가 한 번만 적용돼서 다시 뽑으면 식사로 돌아갔다 → **모드 토글**로 바꿈
 *
 *   node scripts/check-home-roulette.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/tmp/meogja-home";
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
page.on("pageerror", e => errs.push(e.message.slice(0, 160)));

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
// 첫 방문 안내(투어·팝업)를 걷어낸다
for (const t of ["건너뛰기", "나중에"]) {
  await page.locator(`text=${t}`).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
}

const mealTitle = await page.locator("text=오늘 뭐 먹지?").count();
if (!mealTitle) problems.push("식사 모드 제목이 없다");
if (!(await page.getByRole("button", { name: /🍚 식사/ }).count())) problems.push("식사 토글이 없다");
if (!(await page.getByRole("button", { name: /🍰 디저트/ }).count())) problems.push("디저트 토글이 없다");

// 디저트로 바꾸면 제목·버튼 문구가 함께 바뀐다
await page.getByRole("button", { name: /🍰 디저트/ }).first().click({ force: true });
await page.waitForTimeout(700);
if (!(await page.locator("text=디저트 뭐 먹지?").count())) problems.push("디저트 모드 제목이 안 바뀐다");
if (!(await page.locator("text=디저트 뽑기").count())) problems.push("디저트 모드에서 버튼 문구가 안 바뀐다");
await page.screenshot({ path: `${OUT}-dessert.png` });

/* 디저트 모드로 여러 번 돌려도 계속 디저트가 나와야 한다.
   (예전에는 다시 뽑기가 식사 풀로 돌아갔다) */
const MEAL_ONLY = ["삼겹살", "김치찌개", "제육볶음", "치킨", "짜장면", "국밥", "냉면", "파스타"];
const DESSERT_HINT = ["케이크", "빙수", "마카롱", "아이스크림", "와플", "크로플", "타르트", "붕어빵",
  "호떡", "도넛", "쿠키", "브라우니", "푸딩", "티라미수", "젤라또", "약과", "크레이프", "츄러스",
  "아메리카노", "라떼", "버블티", "주스", "에이드", "스무디", "빵", "초콜릿", "카스텔라", "팥빙수", "우유", "핫초코"];
const picks = [];
for (let i = 0; i < 4; i++) {
  await page.getByRole("button", { name: /디저트 다시 뽑기|디저트 뽑기/ }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1900);
  const t = await page.locator('[data-testid="roulette-result"]').first().textContent().catch(() => null);
  if (t) picks.push(t.replace("!", "").trim());
}
const mealLeak = picks.filter(p => MEAL_ONLY.includes(p));
if (mealLeak.length) problems.push(`디저트 모드인데 한 끼 메뉴가 나왔다: ${mealLeak.join(", ")}`);
if (picks.length === 0) problems.push("결과를 한 번도 못 읽었다(선택자 확인 필요)");
/* 뽑힌 것이 정말 디저트 계열인지도 본다 — 위 목록에 없는 한 끼가 나오면 그냥 통과해 버린다 */
const uniq = new Set(picks);
if (picks.length >= 3 && uniq.size === 1) {
  problems.push(`다시 뽑아도 결과가 그대로다(${[...uniq][0]}) — 버튼을 못 눌렀거나 다시 뽑기가 동작하지 않는다`);
}
const notDessert = picks.filter(p => !DESSERT_HINT.some(d => p.includes(d)));
if (notDessert.length === picks.length && picks.length > 0) {
  problems.push(`디저트로 보이는 결과가 하나도 없다: ${picks.join(", ")}`);
}

console.log(JSON.stringify({ picks, errs, problems }, null, 1));
console.log(problems.length ? "\n❌ 문제 " + problems.length + "건" : "\n✅ 홈 랜덤 확인 통과");
await browser.close();
process.exit(problems.length ? 1 : 0);
