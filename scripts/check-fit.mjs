/**
 * "우리 모임 취향 적합도" 계산 점검 (로컬 전용).
 *
 * 인기(리뷰·블로그·SNS)는 광고가 개입하는 축이라 순위의 기준으로 쓰지 않기로 했다.
 * 대신 이 지표를 쓰는데, 잘못 계산하면 오히려 신뢰를 깎는다 — 특히
 *  - 맞는 사람이 없을 때 0% 를 보여주면 가게를 깎아내리는 말이 된다(그래서 null)
 *  - 한 글자만 겹쳐도 맞다고 하면 아무 가게나 100% 가 된다
 *
 *   node scripts/check-fit.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const OUT = "/tmp/meogja-fit";
fs.rmSync(OUT, { recursive: true, force: true });
const r = spawnSync("npx", ["tsc", "src/lib/fitScore.ts", "--outDir", OUT,
  "--module", "es2022", "--target", "es2022", "--skipLibCheck"], { encoding: "utf8" });
if (!fs.existsSync(path.join(OUT, "fitScore.js"))) {
  console.error("tsc 실패:\n" + (r.stdout || "") + (r.stderr || "")); process.exit(1);
}
const { computeFit } = await import(pathToFileURL(path.join(OUT, "fitScore.js")).href);

const problems = [];
const ok = (c, l) => { if (!c) problems.push(l) };
const like = (m, f) => ({ member_id: m, food_name: f, preference_type: "like", score: 2 });

const udon = { title: "역전우동 강남", category: "음식점 > 일식 > 우동" };
const kimchi = { title: "김치찌개집", category: "음식점 > 한식 > 찌개" };

// 셋 중 둘이 좋아하면 67%
{
  const fit = computeFit(udon, [like("a", "우동"), like("b", "일식"), like("c", "치킨")], ["a", "b", "c"]);
  ok(fit.pct === 67, `67% 여야 한다(실제 ${fit.pct})`);
  ok(fit.likedBy.length === 2, "맞는 사람이 2명이어야 한다");
}
// 아무도 안 맞으면 숫자를 내놓지 않는다
{
  const fit = computeFit(kimchi, [like("a", "우동"), like("b", "피자")], ["a", "b"]);
  ok(fit.pct === null, `맞는 사람이 없으면 null 이어야 한다(실제 ${fit.pct})`);
}
// 가게 이름에 메뉴가 들어간 경우도 잡는다
{
  const fit = computeFit(udon, [like("a", "역전우동")], ["a"]);
  ok(fit.pct === 100, `가게 이름 일치를 못 잡았다(${fit.pct})`);
}
// 한 글자로는 맞다고 하지 않는다
{
  const fit = computeFit(udon, [like("a", "일")], ["a"]);
  ok(fit.pct === null, "한 글자를 맞다고 했다");
}
// 참여자가 없으면 계산하지 않는다
ok(computeFit(udon, [like("a", "우동")], []).pct === null, "참여자 0명인데 숫자를 냈다");
// 못 먹는 표시는 적합도에 더하지 않는다
{
  const prefs = [{ member_id: "a", food_name: "우동", preference_type: "dislike", score: -9 }];
  ok(computeFit(udon, prefs, ["a"]).pct === null, "못 먹는 표시를 좋아함으로 셌다");
}

console.log(problems.length ? "❌ 문제\n" + problems.map(p => "  - " + p).join("\n") : "✅ 적합도 계산 확인 통과");
fs.rmSync(OUT, { recursive: true, force: true });
process.exit(problems.length ? 1 : 0);
