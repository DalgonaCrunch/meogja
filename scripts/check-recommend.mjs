/**
 * 메뉴 추천 로직 점검 (로컬 전용, 배포에 포함되지 않는다).
 *
 * lib/recommend.ts 는 순수 함수라 브라우저 없이 확인할 수 있다.
 * 가중치를 손볼 때마다 이 스크립트를 돌려 "예전에 되던 것" 이 깨지지 않았는지 본다.
 *
 *   node scripts/check-recommend.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

/* TS 를 그대로 실행할 수 없으니 tsc 로 임시 폴더에 옮겨 담아 불러온다.
   (정규식으로 타입 표기를 걷어내는 방식은 문법이 조금만 복잡해지면 깨진다) */
const OUT = "/tmp/meogja-recheck";
fs.rmSync(OUT, { recursive: true, force: true });
const r = spawnSync("npx", [
  "tsc", "src/lib/recommend.ts", "src/lib/ingredients.ts",
  "--outDir", OUT, "--module", "es2022", "--target", "es2022",
  "--moduleResolution", "bundler", "--skipLibCheck",
], { encoding: "utf8" });
if (!fs.existsSync(path.join(OUT, "recommend.js"))) {
  console.error("tsc 로 옮겨 담기 실패:\n" + (r.stdout || "") + (r.stderr || ""));
  process.exit(1);
}
// tsc 는 확장자 없는 import 를 남긴다 → node 가 못 찾는다. 여기서 붙여 준다.
for (const f of fs.readdirSync(OUT)) {
  const fp = path.join(OUT, f);
  fs.writeFileSync(fp, fs.readFileSync(fp, "utf8").replace(/from "\.\/([\w-]+)"/g, 'from "./$1.js"'));
}
const { getRecommendationsDetailed } = await import(pathToFileURL(path.join(OUT, "recommend.js")).href);
const { expandDislikes } = await import(pathToFileURL(path.join(OUT, "ingredients.js")).href);

const problems = [];
const ok = (cond, label) => { if (!cond) problems.push(label); };

const pref = (member, food, score) => ({
  id: `${member}-${food}`, member_id: member, food_name: food,
  preference_type: score > 0 ? "like" : "dislike", score, created_at: "",
});
const menus = (r) => r.items.map(i => i.menu);

// ── 1. 재료로 표시한 못 먹는 음식이 실제로 빠지는가 (예전 버그)
{
  const r = getRecommendationsDetailed([pref("a", "마라", -9)], ["a"], 300, "s");
  ok(!menus(r).includes("마라탕"), "마라 못먹음인데 마라탕이 남았다");
  ok(!menus(r).includes("마라샹궈"), "마라 못먹음인데 마라샹궈가 남았다");
  ok(!menus(r).includes("훠궈"), "마라 못먹음인데 훠궈가 남았다");
}
{
  const r = getRecommendationsDetailed([pref("a", "새우", -9)], ["a"], 300, "s");
  ok(!menus(r).includes("깐소새우"), "새우 못먹음인데 깐소새우가 남았다");
  ok(!menus(r).includes("팟타이"), "새우 못먹음인데 팟타이가 남았다(숨은 재료)");
  ok(menus(r).includes("김치찌개"), "새우 때문에 관계없는 김치찌개까지 빠졌다");
}

// ── 2. 흔한 재료는 과하게 빼지 않는다 (예전엔 파 → 파스타까지 사라졌다)
{
  const r = getRecommendationsDetailed([pref("a", "파", -9)], ["a"], 300, "s");
  const m = menus(r);
  ok(m.includes("파스타"), "파 못먹음이 파스타를 없앴다(과잉 제외)");
  ok(m.includes("마파두부"), "파 못먹음이 마파두부를 없앴다(과잉 제외)");
  ok(m.includes("짜파게티"), "파 못먹음이 짜파게티를 없앴다(과잉 제외)");
  const idxPajeon = m.indexOf("파전");
  ok(idxPajeon === -1 || idxPajeon > 30, "파 못먹음인데 파전이 앞쪽에 남았다(뒤로 밀려야 한다)");
}

// ── 3. 메뉴 이름을 직접 못 먹는다고 하면 그것만 빠진다
{
  const r = getRecommendationsDetailed([pref("a", "김치찌개", -9)], ["a"], 300, "s");
  ok(!menus(r).includes("김치찌개"), "직접 고른 김치찌개가 안 빠졌다");
  ok(menus(r).includes("된장찌개"), "김치찌개 하나로 된장찌개까지 빠졌다");
}

// ── 4. 구체적인 선호가 뭉뚱그린 선호보다 앞선다
{
  const r = getRecommendationsDetailed(
    [pref("a", "김치찌개", 3), pref("a", "일식", 2)], ["a"], 5, "s");
  ok(r.items[0].menu === "김치찌개", `메뉴 지정이 1등이어야 한다 (실제: ${r.items[0].menu})`);
}

// ── 5. 전원이 좋아하는 것이 먼저
{
  const prefs = [
    pref("a", "초밥", 2), pref("b", "초밥", 2),      // 둘 다
    pref("a", "떡볶이", 3), pref("a", "분식", 3),      // 한 명이 강하게
  ];
  const r = getRecommendationsDetailed(prefs, ["a", "b"], 5, "s");
  ok(r.items[0].menu === "초밥", `전원 선호가 1등이어야 한다 (실제: ${r.items[0].menu})`);
  ok(r.items[0].likedByAll === true, "likedByAll 이 true 여야 한다");
}

// ── 6. 씨앗이 같으면 순서가 같고, 다르면 달라진다 (새로고침마다 흔들리면 안 된다)
{
  const prefs = [pref("a", "한식", 2)];
  const one = menus(getRecommendationsDetailed(prefs, ["a"], 10, "seed-A"));
  const two = menus(getRecommendationsDetailed(prefs, ["a"], 10, "seed-A"));
  const other = menus(getRecommendationsDetailed(prefs, ["a"], 10, "seed-B"));
  ok(JSON.stringify(one) === JSON.stringify(two), "같은 씨앗인데 순서가 달라졌다");
  ok(JSON.stringify(one) !== JSON.stringify(other), "다른 씨앗인데 순서가 똑같다(흔들림이 없다)");
}

// ── 7. 다 빼도 빈 화면이 되지 않는다
{
  const everything = ["식사", "술안주", "디저트", "카페/음료"].map(c => pref("a", c, -9));
  const r = getRecommendationsDetailed(everything, ["a"], 5, "s");
  ok(r.items.length > 0, "모두 제외했을 때 결과가 비었다(빈 화면)");
  ok(r.relaxed === true, "되살렸는데 relaxed 플래그가 안 켜졌다");
}

// ── 8. 옛 행(score 없음)도 동작한다
{
  const legacy = [
    { id: "1", member_id: "a", food_name: "마라", preference_type: "dislike", created_at: "" },
    { id: "2", member_id: "a", food_name: "초밥", preference_type: "like", created_at: "" },
  ];
  const r = getRecommendationsDetailed(legacy, ["a"], 300, "s");
  ok(!menus(r).includes("마라탕"), "score 없는 옛 dislike 가 제외로 안 쓰였다");
  ok(r.items[0].menu === "초밥", `score 없는 옛 like 가 점수로 안 쓰였다 (실제: ${r.items[0].menu})`);
}

// ── 9. expandDislikes 자체
{
  const { hard, soft } = expandDislikes(["마라", "파", "김치찌개"]);
  ok(hard.has("마라탕"), "expandDislikes: 마라 → 마라탕 없음");
  ok(hard.has("김치찌개"), "expandDislikes: 메뉴 이름이 hard 에 없음");
  ok(!hard.has("파스타"), "expandDislikes: 파가 파스타를 hard 로 넣었다");
  ok(soft.has("파전"), "expandDislikes: 파 → 파전이 soft 에 없음");
}

console.log(problems.length ? "❌ 문제\n" + problems.map(p => "  - " + p).join("\n") : "✅ 추천 로직 확인 통과");
fs.rmSync(OUT, { recursive: true, force: true });
process.exit(problems.length ? 1 : 0);
