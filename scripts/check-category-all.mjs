/**
 * 카테고리 "전체" 선택이 실제로 검색되는 말로 펼쳐지는지 확인 (로컬 전용).
 *
 * 카테고리 이름을 그대로 검색어로 쓰면 안 되는 것이 있다. 실측(카카오, 강남역 1km):
 *   고기 5곳 · 일식 5곳 · 한식 5곳 · 카페 5곳
 *   국물 1곳 · 사이드 1곳 · 매운맛 0곳   ← 가게 이름에 그런 말을 안 쓴다
 * 이 검사는 그런 카테고리가 대체 검색어를 갖고 있는지, 펼친 결과가 검색 API 상한
 * (8개)을 넘지 않는지 본다.
 *
 *   node scripts/check-category-all.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const OUT = "/tmp/meogja-catcheck";
fs.rmSync(OUT, { recursive: true, force: true });
spawnSync("npx", [
  "tsc", "src/lib/menus.ts",
  "--outDir", OUT, "--module", "es2022", "--target", "es2022",
  "--moduleResolution", "bundler", "--skipLibCheck",
], { encoding: "utf8" });
if (!fs.existsSync(path.join(OUT, "menus.js"))) { console.error("tsc 실패"); process.exit(1); }
const m = await import(pathToFileURL(path.join(OUT, "menus.js")).href);

/* 카테고리 이름을 그대로 쓰면 결과가 거의 없던 것들 — 반드시 다른 말로 바꿔야 한다 */
const BAD_AS_QUERY = ["국물", "사이드", "매운맛"];

let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${ok ? "" : " — " + detail}`);
  if (!ok) fail++;
};

console.log("모든 카테고리에 전체 검색어가 있나");
for (const c of m.MENU_CATEGORIES) {
  const terms = m.expandMenuQueries([m.categoryAllToken(c.label)]);
  check(`${c.label} → ${terms.join(", ")}`, terms.length > 0, "펼친 검색어가 없다");
  if (BAD_AS_QUERY.includes(c.label)) {
    check(`${c.label} 은 이름 그대로 쓰지 않는다`, !terms.includes(c.label),
      `"${c.label}" 을 그대로 검색하면 결과가 거의 없다`);
  }
}

/* 모임 화면의 메뉴 분류(lib/recommend.ts 의 MENU_DATA 이름들)도 같은 표를 쓴다.
   실측에서 0~1곳이던 이름은 반드시 다른 말로 바뀌어야 한다. */
console.log("모임 메뉴 분류");
const GROUP_NAMES = ["식사","술안주","디저트","카페/음료","한식","중식","일식","양식","동남아식","분식",
  "패스트푸드","인도/중동식","치킨/닭","고기류","해산물","안주류","빵/케이크","아이스크림/빙수",
  "한식디저트","과일/건강","커피","논커피","카페음식"];
const GROUP_BAD = ["고기류", "안주류", "한식디저트", "카페음식", "논커피", "과일/건강", "인도/중동식", "동남아식"];
for (const name of GROUP_NAMES) {
  const terms = m.expandMenuQueries([m.categoryAllToken(name)]);
  check(`${name} → ${terms.join(", ")}`, terms.length > 0 && !(terms.length === 1 && terms[0] === name && GROUP_BAD.includes(name)),
    `"${name}" 을 그대로 검색하면 결과가 거의 없다 — 대체 검색어가 필요하다`);
}

console.log("펼치기 규칙");
check("보통 메뉴는 그대로", m.expandMenuQueries(["삼겹살", "초밥"]).join() === "삼겹살,초밥");
check("전체 + 메뉴 섞임", m.expandMenuQueries([m.categoryAllToken("치킨"), "초밥"]).join() === "치킨,초밥");
check("중복 제거", m.expandMenuQueries([m.categoryAllToken("고기"), "고기"]).filter(t => t === "고기").length === 1);
check("상한 8개", m.expandMenuQueries(m.MENU_CATEGORIES.map(c => m.categoryAllToken(c.label))).length === 8);
check("표시 이름은 전체를 뗀다", m.menuDisplayName("고기 전체") === "고기" && m.menuDisplayName("초밥") === "초밥");

if (fail) { console.error(`\n❌ ${fail}개 실패`); process.exit(1); }
console.log("\n✅ 카테고리 전체 확인 통과");
