// 통합 메뉴 데이터 — 모든 컴포넌트가 이 파일에서 가져다 씁니다

export type MenuCategory = {
  emoji: string;
  label: string;
  menus: string[];
};

export const MENU_CATEGORIES: MenuCategory[] = [
  { emoji:"🍖", label:"고기", menus:["삼겹살","소갈비","불고기","목살","항정살","갈매기살","오겹살","양꼬치","소곱창","껍데기","소고기구이","차돌박이","갈비","갈비찜","제육볶음","수육","보쌈","족발"] },
  { emoji:"🍜", label:"국물", menus:["김치찌개","된장찌개","순두부찌개","부대찌개","설렁탕","갈비탕","순대국밥","해장국","육개장","추어탕","콩나물국밥","선지국밥","뼈다귀해장국","감자탕","칼국수","짬뽕","갈낙전골","곰탕","삼계탕","떡국"] },
  { emoji:"🍣", label:"일식", menus:["초밥","라멘","돈카츠","우동","소바","카라아게","텐동","규동","오마카세","이자카야","사시미","야키토리","치즈돈까스","나베","스키야키","생선구이","회","회덮밥","마끼","장어덮밥","돈가스","오므라이스","카레라이스","하이라이스"] },
  { emoji:"🍕", label:"양식", menus:["파스타","피자","스테이크","리조또","브런치","버거","샌드위치","스프","양갈비","크림파스타","토마토파스타","뇨끼","샐러드","스파게티","오믈렛","오일파스타","그라탕","슈니첼","로스트치킨","마늘빵","브리또","타코","시저샐러드","카프레제"] },
  { emoji:"🍗", label:"치킨", menus:["후라이드치킨","양념치킨","간장치킨","파닭","마늘치킨","치즈치킨","순살치킨","핫윙","반반치킨","뿌링클","황금올리브","교촌치킨","닭발","닭강정","치즈닭갈비","감자튀김","어니언링","콘치즈","치즈스틱","웨지감자","나초","핫도그","팝콘","군고구마"] },
  { emoji:"☕", label:"카페", menus:["아메리카노","카페라떼","케이크","크로플","에그타르트","베이글","와플","스콘","티라미수","마카롱","크로아상","스무디","에이드","빙수","버블티","주스","우유","핫초코"] },
  { emoji:"🌶️", label:"매운맛", menus:["김치찌개","순두부찌개","부대찌개","제육볶음","닭갈비","짬뽕","떡볶이","마라탕","마라샹궈","낙지볶음","쭈꾸미볶음","엽기떡볶이","매운갈비찜","불닭","매운족발","불짬뽕","청양떡볶이","매운찜닭","매운낙지볶음","매운돼지갈비","로제떡볶이","치즈떡볶이"] },
  { emoji:"🍰", label:"디저트", menus:["아이스크림","붕어빵","호떡","마카롱","타르트","팥빙수","츄러스","도넛","케이크","크레이프","소프트아이스크림","약과","카스텔라","초콜릿","젤라또","쿠키","브라우니","초코케이크","치즈케이크","푸딩"] },
  { emoji:"🍱", label:"한식", menus:["김치찌개","된장찌개","순두부찌개","부대찌개","설렁탕","갈비탕","해장국","삼계탕","제육볶음","불고기","삼겹살","갈비","보쌈","족발","닭갈비","비빔밥","돌솥비빔밥","덮밥","김밥","잡채","냉면","잔치국수","물냉면","비빔냉면","쫄면","국수","라면","볶음밥","김치볶음밥","막국수","비빔국수","파전","전복죽","주먹밥","만두","떡볶이"] },
  { emoji:"🥟", label:"중식", menus:["짜장면","짬뽕","탕수육","깐풍기","유산슬","마파두부","훠궈","마라샹궈","딤섬","양꼬치","간풍기","팔보채","해파리냉채","중화비빔밥","공심채볶음","간짜장","깐풍새우","라조기","북경오리","사오마이","춘권"] },
  { emoji:"🦞", label:"해산물", menus:["회","회덮밥","초밥사시미","새우튀김","굴요리","홍합요리","간장게장","꽃게찜","해물찜","샤브샤브","낙지볶음","쭈꾸미볶음","갈낙전골","해물파전","매운탕"] },
];

// 모든 메뉴를 플랫하게 (중복 제거)
export const ALL_MENUS: string[] = Array.from(new Set(MENU_CATEGORIES.flatMap(c => c.menus)));

// 룰렛/월드컵에 쓸 추가 메뉴 (카테고리 없는 개별 메뉴)
const EXTRA_MENUS = [
  "오마카세","간장게장","꽃게찜","해물찜","샤브샤브","전골","순대","떡갈비",
  "갈낙전골","해장국","설렁탕","규동","텐동","닭갈비","매운찜닭","간장찜닭",
  "치즈닭갈비","에그타르트","크로플","팥빙수",
];

export const ROULETTE_POOL: string[] = Array.from(new Set([...ALL_MENUS, ...EXTRA_MENUS]));

const CAFE_DESSERT_LABELS = new Set(["카페", "디저트"]);

/** 카페/디저트 제외한 식사 메뉴 풀 */
export const MEAL_POOL: string[] = Array.from(new Set(
  MENU_CATEGORIES.filter(c => !CAFE_DESSERT_LABELS.has(c.label)).flatMap(c => c.menus)
    .concat(EXTRA_MENUS.filter(m => !["에그타르트","크로플","팥빙수"].includes(m)))
));

/** 카페/디저트 풀 */
export const CAFE_DESSERT_POOL: string[] = Array.from(new Set(
  MENU_CATEGORIES.filter(c => CAFE_DESSERT_LABELS.has(c.label)).flatMap(c => c.menus)
    .concat(["에그타르트","크로플","팥빙수"])
));

function pool(...labels: string[]): string[] {
  return Array.from(new Set(MENU_CATEGORIES.filter(c => labels.includes(c.label)).flatMap(c => c.menus)));
}

/** 월드컵/룰렛 카테고리 선택 목록 */
export const WORLDCUP_CATEGORIES = [
  { emoji: "🍽️", label: "전체 식사",   pool: MEAL_POOL },
  { emoji: "🍖", label: "고기/구이",   pool: pool("고기") },
  { emoji: "🍗", label: "치킨/야식",   pool: pool("치킨") },
  { emoji: "🍜", label: "한식/국물",   pool: pool("한식", "국물") },
  { emoji: "🍣", label: "일식/해산물", pool: pool("일식", "해산물") },
  { emoji: "🌶️", label: "매운맛",     pool: pool("매운맛") },
  { emoji: "🥟", label: "중식",        pool: pool("중식") },
  { emoji: "🍕", label: "양식",        pool: pool("양식") },
  { emoji: "☕", label: "카페/디저트", pool: CAFE_DESSERT_POOL },
] as const;

// 랜덤 N개 샘플 (기본: MEAL_POOL 사용)
export function sampleMenus(n: number, customPool?: string[]): string[] {
  const pool = [...(customPool ?? MEAL_POOL)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
