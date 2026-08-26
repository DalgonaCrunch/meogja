/**
 * 메뉴 목록 위생 점검 (로컬 전용).
 *
 * 실물에서 나온 지적들:
 *  - 실제로 없는 이름이 섞여 있었다(`청양떡볶이`, `치즈치킨`, `냉국수`, `매운찜닭`)
 *  - 브랜드명이 메뉴처럼 들어 있었다(`뿌링클`, `교촌치킨`, `맥도날드`)
 *  - "오늘 뭐 먹지" 랜덤이 디저트·음료·사이드를 한 끼로 내놓았다
 * 다시 새어 들어오지 않게 고정한다.
 *
 *   node scripts/check-menus.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const OUT = "/tmp/meogja-menucheck";
fs.rmSync(OUT, { recursive: true, force: true });
const r = spawnSync("npx", [
  "tsc", "src/lib/menus.ts", "src/lib/recommend.ts", "src/lib/foodRecommend.ts",
  "--outDir", OUT, "--module", "es2022", "--target", "es2022",
  "--moduleResolution", "bundler", "--skipLibCheck",
], { encoding: "utf8" });
if (!fs.existsSync(path.join(OUT, "menus.js"))) {
  console.error("tsc 실패:\n" + (r.stdout || "") + (r.stderr || ""));
  process.exit(1);
}
for (const f of fs.readdirSync(OUT)) {
  const fp = path.join(OUT, f);
  fs.writeFileSync(fp, fs.readFileSync(fp, "utf8").replace(/from "\.\/([\w-]+)"/g, 'from "./$1.js"'));
}
const menus = await import(pathToFileURL(path.join(OUT, "menus.js")).href);
const rec = await import(pathToFileURL(path.join(OUT, "recommend.js")).href);
const fr = await import(pathToFileURL(path.join(OUT, "foodRecommend.js")).href);

const problems = [];
const ok = (c, l) => { if (!c) problems.push(l); };

/** 실제로 파는 이름이 아닌 것들 — 다시 들어오면 잡는다 */
const BANNED = [
  "청양떡볶이", "치즈치킨", "냉국수", "매운찜닭", "매운낙지볶음", "매운돼지갈비", "매운갈비찜",
  "매운족발", "불짬뽕", "엽기떡볶이", "불닭",            // 조합으로 만든 이름 / 브랜드
  "뿌링클", "황금올리브", "교촌치킨",                     // 치킨 브랜드
  "맥도날드", "롯데리아", "버거킹", "서브웨이",             // 가게 이름
];

const allNames = new Set([
  ...menus.ALL_MENUS, ...menus.ROULETTE_POOL, ...menus.MEAL_POOL, ...menus.CAFE_DESSERT_POOL,
  ...rec.MENU_DATA.flatMap(l => l.medium.flatMap(m => m.items)),
  ...Object.values(fr.TIME_FOODS).flatMap(v => v.foods),
  ...Object.values(fr.WEATHER_FOODS).flatMap(v => v.foods),
]);

for (const bad of BANNED) {
  ok(!allNames.has(bad), `없는/브랜드 이름이 메뉴 목록에 있다: ${bad}`);
}

// "오늘 뭐 먹지" 는 한 끼여야 한다
const dessertInMeal = menus.MEAL_POOL.filter(n => menus.CAFE_DESSERT_POOL.includes(n));
ok(dessertInMeal.length === 0, `식사 풀에 디저트가 섞였다: ${dessertInMeal.join(", ")}`);

const sideLike = ["감자튀김", "팝콘", "군고구마", "나초", "치즈볼", "어니언링"];
const sideInMeal = menus.MEAL_POOL.filter(n => sideLike.includes(n));
ok(sideInMeal.length === 0, `식사 풀에 사이드가 섞였다: ${sideInMeal.join(", ")}`);

// isMealFood 가 실제로 걸러내는지
const shouldBeBlocked = ["버블티", "마카롱", "아메리카노", "빙수", "탕후루", "감자튀김", "팝콘", "크로플"];
const leaked = shouldBeBlocked.filter(n => menus.isMealFood(n));
ok(leaked.length === 0, `한 끼가 아닌데 isMealFood 가 통과시켰다: ${leaked.join(", ")}`);

const shouldPass = ["김치찌개", "삼겹살", "초밥", "파스타", "마라탕", "냉면", "돈카츠"];
const wronglyBlocked = shouldPass.filter(n => !menus.isMealFood(n));
ok(wronglyBlocked.length === 0, `한 끼인데 isMealFood 가 막았다: ${wronglyBlocked.join(", ")}`);

// 카테고리 이름이 메뉴처럼 섞여 있으면 랜덤이 "한식!" 을 내놓는다
const categoryWords = ["한식", "중식", "일식", "양식", "분식", "디저트", "카페", "고기", "해산물", "국수", "덮밥"];
const catInMeal = menus.MEAL_POOL.filter(n => categoryWords.includes(n));
ok(catInMeal.length === 0, `식사 풀에 카테고리 이름이 있다: ${catInMeal.join(", ")}`);

console.log(problems.length
  ? "❌ 문제\n" + problems.map(p => "  - " + p).join("\n")
  : `✅ 메뉴 목록 확인 통과 (식사 ${menus.MEAL_POOL.length}개 / 디저트 ${menus.CAFE_DESSERT_POOL.length}개 / 전체 ${allNames.size}개)`);
fs.rmSync(OUT, { recursive: true, force: true });
process.exit(problems.length ? 1 : 0);
