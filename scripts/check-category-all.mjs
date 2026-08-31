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

console.log("펼치기 규칙");
check("보통 메뉴는 그대로", m.expandMenuQueries(["삼겹살", "초밥"]).join() === "삼겹살,초밥");
check("전체 + 메뉴 섞임", m.expandMenuQueries([m.categoryAllToken("치킨"), "초밥"]).join() === "치킨,초밥");
check("중복 제거", m.expandMenuQueries([m.categoryAllToken("고기"), "고기"]).filter(t => t === "고기").length === 1);
check("상한 8개", m.expandMenuQueries(m.MENU_CATEGORIES.map(c => m.categoryAllToken(c.label))).length === 8);
check("표시 이름은 전체를 뗀다", m.menuDisplayName("고기 전체") === "고기" && m.menuDisplayName("초밥") === "초밥");

if (fail) { console.error(`\n❌ ${fail}개 실패`); process.exit(1); }
console.log("\n✅ 카테고리 전체 확인 통과");
