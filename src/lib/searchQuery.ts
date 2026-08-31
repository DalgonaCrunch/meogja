/**
 * 식당 검색어를 만드는 규칙.
 *
 * 화면 코드 안에 있던 것을 떼어 냈다 — 검색어 한 단어 때문에 결과가 통째로
 * 0건이 되는 사고가 났는데(아래), 화면 안에 있으면 확인 스크립트로 잡을 수 없다.
 */

/** 인원 수식어. 6명 이상이면 단체석을 우선한다.
 *
 *  🔴 예전에는 11명 이상에 "단체석 대관" 을 붙였다. 네이버 지역검색은 이 두 단어가
 *  같이 들어가면 결과를 0건으로 돌려준다. 실제로 확인한 값:
 *    "강남역 한식 맛집" → 5건
 *    "강남역 단체석 한식 맛집" → 5건
 *    "강남역 단체석 대관 한식 맛집" → 0건
 *  인원이 많을수록 결과가 사라지는, 의도와 정반대의 동작이었다. */
export function getSizeModifier(count: number): string {
  if (count >= 6) return "단체석";
  return "";
}

export function getSizeLabel(count: number): string {
  if (count >= 6) return "단체석 식당 우선";
  return "";
}

/** 수식어들 + 검색어 → 실제로 API 에 보낼 문자열 */
export function buildSearchQuery(modifiers: string[], query: string): string {
  const mod = modifiers.filter(Boolean).join(" ");
  return mod ? `${mod} ${query}` : query;
}
