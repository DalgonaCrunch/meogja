/**
 * 아이콘 매핑 구멍 점검 (로컬 전용, 배포에 포함되지 않는다)
 *
 * 1) 식당 카테고리: 카카오 FD6 는 "음식점 > 술집 > 호프,요리주점" 처럼 잎을 준다.
 * 2) **메뉴 이름**: 룰렛·랭킹·추천 카드에 오르는 모든 이름.
 *    owner 지적("메인에 스시 이미지 왜 안 나오지?")이 여기서 났다 —
 *    "스시·회" 는 지도에 있었지만 맨 이름 "스시" 가 없었고, 부분 매칭은
 *    name.includes(key) 라 이름이 키보다 짧으면 걸리지 않는다.
 *    카테고리 잎만 보던 이 스크립트의 사각지대였으므로 메뉴 이름까지 본다.
 * 파일이 실제로 존재하는지도 같이 본다(예전에 없는 영문 경로를 가리켜 404 가 났다).
 *
 *   node scripts/check-food-icons.mjs
 */
import fs from "node:fs";
import ts from "typescript";
import Module from "node:module";
// TS 파일을 컴파일러로 그대로 불러온다. 정규식으로 타입을 지우면 파일이 조금만
// 바뀌어도 깨져서, 검사가 실패한 것인지 스크립트가 깨진 것인지 알 수 없다.
function loadTs(path) {
  const src = fs.readFileSync(path, "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const m = new Module(path);
  m._compile(js, path);
  return m.exports;
}
const { getFoodIconUrl } = loadTs("src/lib/foodIcons.ts");

const FOOD_KEYS = ["한식","중식","일식","양식","카페","치킨","피자","분식","술집","패스트푸드","베이커리"];
const leaves = [
  "술집", "호프,요리주점", "패스트푸드", "햄버거", "카페", "커피전문점", "제과,베이커리",
  "육류,고기", "돼지고기구이", "곱창,막창,양", "해물,생선", "일본식주점", "실내포장마차",
  "치킨", "피자", "분식", "한식", "중식", "일식", "양식", "칼국수", "국수", "샤브샤브",
  "아시아음식", "베트남음식", "멕시칸,브라질", "도시락", "죽", "간식", "아이스크림",
];
const missing = [];
for (const n of [...FOOD_KEYS, ...leaves]) {
  const url = getFoodIconUrl(n);
  if (!url) { missing.push(n); continue; }
  const f = "public" + url;
  if (!fs.existsSync(f)) missing.push(`${n} → ${url} (파일 없음)`);
}
console.log(missing.length ? "❌ 못 찾음:\n" + missing.map(m => "  - " + m).join("\n") : "✅ 전부 아이콘 매칭됨");
// 기존 매핑이 깨지지 않았는지 표본 확인
const spot = { "삼겹살":"삼겹살", "김치찌개":"김치찌개", "초밥":"초밥", "파스타":"파스타", "아메리카노":"아메리카노", "떡볶이":"떡볶이", "짜장면":"짜장면", "스시":"초밥" };
const broke = Object.entries(spot).filter(([k,v]) => getFoodIconUrl(k) !== `/food-icons/${v}.png`);
console.log(broke.length ? "❌ 기존 매핑 변화: " + JSON.stringify(broke) : "✅ 기존 매핑 그대로");

// ── 메뉴 이름 전수 검사 ────────────────────────────────
// 화면에 오를 수 있는 이름은 데이터 구조에서 직접 모은다.
// 파일에서 한글 문자열을 긁으면 성향 문구("신뢰할 수 있는 클래식파")까지 섞여 헛돈다.
const menus = loadTs("src/lib/menus.ts");
const rec = loadTs("src/lib/foodRecommend.ts");

const names = new Set();
const add = (arr) => arr.forEach((n) => typeof n === "string" && names.add(n));
add(menus.ROULETTE_POOL); add(menus.MEAL_POOL); add(menus.CAFE_DESSERT_POOL);
menus.MENU_CATEGORIES.forEach((c) => names.add(c.label));
Object.values(rec.TIME_FOODS).forEach((v) => add(v.foods));
Object.values(rec.WEATHER_FOODS).forEach((v) => add(v.foods));
add(rec.MZ_TRENDY_FOODS);
for (const age of ["10대", "20대", "30대", "40대", "50대", "60대 이상"]) {
  const g = rec.getAgeGroupFoods(age);
  if (g) add(g.foods);
}
// 가격대·성향 등 다른 목록도 foods 를 들고 있으면 함께 본다
for (const v of Object.values(rec)) {
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) add(v);
  else if (v && typeof v === "object" && !Array.isArray(v)) {
    Object.values(v).forEach((o) => { if (o && Array.isArray(o.foods)) add(o.foods); });
  }
}

const menuMissing = [];
for (const n of names) {
  if (!n || /^[A-Z]{4}$/.test(n)) continue; // MBTI 코드는 음식이 아니다
  const url = getFoodIconUrl(n);
  if (!url) { menuMissing.push(n); continue; }
  if (!fs.existsSync("public" + url)) menuMissing.push(`${n} → ${url} (파일 없음)`);
}
console.log(menuMissing.length
  ? `❌ 아이콘 없는 메뉴 이름 ${menuMissing.length}개:\n  ` + menuMissing.sort().join(", ")
  : `✅ 화면에 오르는 메뉴 이름 ${names.size}개 전부 아이콘 있음`);

process.exit(missing.length || broke.length || menuMissing.length ? 1 : 0);
