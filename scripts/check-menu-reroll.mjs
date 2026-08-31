/**
 * 메뉴 "다시 추천" 확인 (로컬 전용).
 *
 * 🔴 사고: 씨앗이 `모임id-날짜` 로 고정돼 있어서 "다시 추천" 을 눌러도 하루 종일
 * 같은 목록이 나왔다. 눌러도 안 바뀌면 버튼이 죽은 것으로 읽힌다.
 *
 * 이 검사가 보는 것:
 *  1) 첫 추천은 같은 씨앗이면 같아야 한다 (새로고침해도 안 바뀌는 신뢰)
 *  2) 다시 추천은 목록이 달라져야 한다 (순서만이 아니라 나오는 메뉴도)
 *  3) 다시 추천도 취향을 지켜야 한다 (좋아하는 메뉴가 절반 이상)
 *  4) 같은 메뉴가 목록에 두 번 나오지 않아야 한다 (초밥 = 일식/해산물 중복)
 *
 *   node scripts/check-menu-reroll.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const OUT = "/tmp/meogja-rerollcheck";
fs.rmSync(OUT, { recursive: true, force: true });
spawnSync("npx", [
  "tsc", "src/lib/recommend.ts", "src/lib/ingredients.ts",
  "--outDir", OUT, "--module", "es2022", "--target", "es2022",
  "--moduleResolution", "bundler", "--skipLibCheck",
], { encoding: "utf8" });
if (!fs.existsSync(path.join(OUT, "recommend.js"))) { console.error("tsc 실패"); process.exit(1); }
/* tsc 가 확장자 없는 상대 import 를 남기므로 붙여 준다 */
for (const f of ["recommend.js", "ingredients.js"]) {
  const fp = path.join(OUT, f);
  fs.writeFileSync(fp, fs.readFileSync(fp, "utf8").replace(/from ["'](\.\/[^"']+?)(?<!\.js)["']/g, 'from "$1.js"'));
}
const m = await import(pathToFileURL(path.join(OUT, "recommend.js")).href);

const LIKES = ["김치찌개","닭갈비","갈비","짜장면","탕수육","초밥","라멘","햄버거","떡볶이","삼겹살","보쌈","감자탕","짬뽕","제육볶음","마라탕"];
const prefs = [
  ...LIKES.map(n => ({ id: n, member_id: "m1", food_name: n, preference_type: "like", score: 2, created_at: "" })),
  { id: "d1", member_id: "m2", food_name: "양꼬치", preference_type: "dislike", score: -9, created_at: "" },
];
const ids = ["m1", "m2", "m3"];
const run = (seed, jitter) => m.getRecommendationsDetailed(prefs, ids, 15, seed, undefined, jitter).items.map(i => i.menu);

let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${ok ? "" : " — " + detail}`);
  if (!ok) fail++;
};

const first = run("g-2026-08-31", 1.2);
const firstAgain = run("g-2026-08-31", 1.2);
const roll1 = run("g-2026-08-31-r1", 4);
const roll2 = run("g-2026-08-31-r2", 4);

console.log("첫 추천");
check("같은 씨앗이면 같은 목록", JSON.stringify(first) === JSON.stringify(firstAgain));
check("중복 메뉴 없음", new Set(first).size === first.length, first.join(","));

console.log("다시 추천");
check("첫 추천과 다르다", JSON.stringify(first) !== JSON.stringify(roll1));
check("다시 눌러도 또 다르다", JSON.stringify(roll1) !== JSON.stringify(roll2));
const changed = roll1.filter(x => !first.includes(x)).length;
check(`나오는 메뉴가 바뀐다 (새 메뉴 ${changed}개)`, changed >= 2, "순서만 바뀌면 같은 목록으로 읽힌다");
check("중복 메뉴 없음", new Set(roll1).size === roll1.length, roll1.join(","));
const likedRatio = roll1.filter(x => LIKES.includes(x)).length / roll1.length;
check(`취향을 지킨다 (좋아하는 메뉴 ${Math.round(likedRatio * 100)}%)`, likedRatio >= 0.4,
  "무작위가 되면 추천이 아니다");

if (fail) { console.error(`\n❌ ${fail}개 실패`); process.exit(1); }
console.log("\n✅ 다시 추천 확인 통과");
