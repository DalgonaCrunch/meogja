/**
 * 모임 인원별 검색어 점검 (로컬 전용).
 *
 * 11명 모임에서 "맛집 추천"이 결과 0건이던 사고를 다시 내지 않기 위한 검사다.
 * 원인은 검색어에 붙던 "단체석 대관" 이었다 — 네이버 지역검색이 이 두 단어가
 * 함께 들어가면 0건을 돌려준다(실측: 단체석 → 5건, 단체석 대관 → 0건).
 *
 *   node scripts/check-group-query.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const OUT = "/tmp/meogja-querycheck";
fs.rmSync(OUT, { recursive: true, force: true });
spawnSync("npx", [
  "tsc", "src/lib/searchQuery.ts",
  "--outDir", OUT, "--module", "es2022", "--target", "es2022",
  "--moduleResolution", "bundler", "--skipLibCheck",
], { encoding: "utf8" });
if (!fs.existsSync(path.join(OUT, "searchQuery.js"))) {
  console.error("tsc 로 옮겨 담기 실패");
  process.exit(1);
}
const { getSizeModifier, buildSearchQuery } = await import(pathToFileURL(path.join(OUT, "searchQuery.js")).href);

/* 네이버 지역검색이 0건을 주는 것으로 확인된 조합. 검색어에 절대 들어가면 안 된다. */
const BANNED = ["대관"];

let fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log(`  ✓ ${name}`); }
  else { console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`); fail++; }
}

console.log("인원별 검색어");
for (const n of [1, 3, 5, 6, 10, 11, 20]) {
  const mod = getSizeModifier(n);
  const q = buildSearchQuery([mod, "회식"], "한식");
  const banned = BANNED.find((b) => q.includes(b));
  check(`${n}명 → "${q}"`, !banned, banned ? `금지어 "${banned}" 가 들어갔다` : "");
}

console.log("규칙");
check("6명 미만은 수식어 없음", getSizeModifier(5) === "");
check("6명 이상은 단체석", getSizeModifier(6) === "단체석" && getSizeModifier(30) === "단체석");
check("수식어가 없으면 검색어 그대로", buildSearchQuery(["", ""], "한식") === "한식");

if (fail) { console.error(`\n❌ ${fail}개 실패`); process.exit(1); }
console.log("\n✅ 검색어 확인 통과");
