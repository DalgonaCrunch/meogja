/**
 * 식당 카테고리 → 아이콘 매핑 구멍 점검 (로컬 전용, 배포에 포함되지 않는다)
 *
 * 카카오 FD6 는 "음식점 > 술집 > 호프,요리주점" 처럼 잎 카테고리를 준다.
 * 그림을 못 찾으면 카드가 마스코트로 떨어진다 — 그 구멍을 미리 잡는다.
 * 파일이 실제로 존재하는지도 같이 본다(예전에 없는 영문 경로를 가리켜 404 가 났다).
 *
 *   node scripts/check-food-icons.mjs
 */
import fs from "node:fs";
const src = fs.readFileSync("src/lib/foodIcons.ts", "utf8");
// TS → JS 로 대충 바꿔 평가 (테스트용)
const js = src
  .replace('const FOOD_ICON_MAP: Record<string, string> =', 'const FOOD_ICON_MAP =')
  .replace('export function getFoodIconUrl(name: string): string | null {', 'function getFoodIconUrl(name) {')
  .replace(/export /g, '');
const mod = new Function(js + "; return { getFoodIconUrl, FOOD_ICON_MAP };")();
const { getFoodIconUrl } = mod;

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
const spot = { "삼겹살":"삼겹살", "김치찌개":"김치찌개", "초밥":"초밥", "파스타":"파스타", "아메리카노":"아메리카노", "떡볶이":"떡볶이", "짜장면":"짜장면" };
const broke = Object.entries(spot).filter(([k,v]) => getFoodIconUrl(k) !== `/food-icons/${v}.png`);
console.log(broke.length ? "❌ 기존 매핑 변화: " + JSON.stringify(broke) : "✅ 기존 매핑 그대로");
process.exit(missing.length || broke.length ? 1 : 0);
