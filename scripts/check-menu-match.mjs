/**
 * 먹자팟 메뉴 이름 맞추기 점검 (로컬 전용).
 *
 * 먹자팟은 메뉴를 자유롭게 적을 수 있다. 그 값이 아이콘·취향 점수·"이 메뉴 팟 N개"
 * 집계에 쓰이므로 "삼겹 / 삼겹살 / 매운 삼겹살" 이 흩어지면 안 된다.
 * 반대로 넓게 맞추면 엉뚱한 메뉴에 붙는다 — 두 쪽을 다 본다.
 *
 *   node scripts/check-menu-match.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const OUT = "/tmp/meogja-menumatch";
fs.rmSync(OUT, { recursive: true, force: true });
const r = spawnSync("npx", ["tsc", "src/lib/menuMatch.ts", "--outDir", OUT,
  "--module", "es2022", "--target", "es2022", "--moduleResolution", "bundler", "--skipLibCheck"],
  { encoding: "utf8" });
if (!fs.existsSync(path.join(OUT, "menuMatch.js"))) {
  console.error("tsc 실패:\n" + (r.stdout || "") + (r.stderr || ""));
  process.exit(1);
}
for (const f of fs.readdirSync(OUT)) {
  const fp = path.join(OUT, f);
  fs.writeFileSync(fp, fs.readFileSync(fp, "utf8").replace(/from "\.\/([\w-]+)"/g, 'from "./$1.js"'));
}
const { canonicalizeMenu, suggestMenus, menuForStorage } = await import(pathToFileURL(path.join(OUT, "menuMatch.js")).href);

const problems = [];
const ok = (c, l) => { if (!c) problems.push(l) };

// 흩어지면 안 되는 것들
ok(canonicalizeMenu("삼겹살") === "삼겹살", "정확히 같은 이름을 못 맞췄다");
ok(canonicalizeMenu(" 삼겹살 ") === "삼겹살", "공백만 다른 이름을 못 맞췄다");
ok(canonicalizeMenu("매운 삼겹살") === "삼겹살", `수식어가 붙은 이름을 못 맞췄다(${canonicalizeMenu("매운 삼겹살")})`);
ok(canonicalizeMenu("김치찌개 먹자") === "김치찌개", "문장 속 메뉴를 못 맞췄다");

// 없는 이름은 억지로 맞추지 않는다
ok(canonicalizeMenu("사장님추천특선") === null, `없는 이름을 억지로 맞췄다(${canonicalizeMenu("사장님추천특선")})`);
ok(canonicalizeMenu("ㅇㅇ") === null, "뜻 없는 입력을 맞췄다");

// 저장값
const a = menuForStorage("매운 삼겹살");
ok(a.menu === "삼겹살" && a.canonical === true, "저장값이 표준 이름이 아니다");
const b = menuForStorage("사장님추천특선");
ok(b.menu === "사장님추천특선" && b.canonical === false, "사전에 없는 이름은 원문 그대로 저장해야 한다");

// 후보 제시
const s1 = suggestMenus("삼겹");
ok(s1.includes("삼겹살"), `후보에 삼겹살이 없다(${s1.join(",")})`);
const s2 = suggestMenus("파스");
ok(s2.includes("파스타"), `후보에 파스타가 없다(${s2.join(",")})`);
ok(suggestMenus("").length === 0, "빈 입력에 후보를 냈다");

console.log(problems.length ? "❌ 문제\n" + problems.map(p => "  - " + p).join("\n") : "✅ 메뉴 이름 맞추기 확인 통과");
fs.rmSync(OUT, { recursive: true, force: true });
process.exit(problems.length ? 1 : 0);
