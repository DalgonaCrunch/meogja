/**
 * 식당 카테고리·거리·지도링크 공용 헬퍼.
 *
 * /nearby 와 /search 가 같은 모양의 카드를 그리는데 예전에는 각자 자기 복사본을
 * 들고 있었다. 그래서 아이콘 경로 버그(없는 영문 파일명)를 한쪽만 고치는 일이
 * 벌어졌다 — 한 군데로 모은다.
 */
import { getFoodIconUrl } from "@/lib/foodIcons";

/** 분류 키 목록. 아이콘 파일 경로는 여기 두지 않는다(실제 파일은 한글 이름이고
 *  매핑은 lib/foodIcons.ts 가 갖고 있다). */
export const FOOD_KEYS = ["한식", "중식", "일식", "양식", "카페", "치킨", "피자", "분식", "술집", "패스트푸드", "베이커리"];

export const FOOD_EMOJIS: Record<string, string> = {
  한식: "🍚", 중식: "🥢", 일식: "🍱", 양식: "🍝", 카페: "☕", 치킨: "🍗",
  피자: "🍕", 분식: "🍜", 술집: "🍺", 패스트푸드: "🍔", 베이커리: "🥐",
};

/** "음식점 > 일식 > 우동" → "일식" (못 찾으면 한식) */
export function categoryKey(cat: string): string {
  for (const k of FOOD_KEYS) {
    if (cat.includes(k)) return k;
  }
  return "한식";
}

/** 카테고리로 고른 로컬 아이콘 경로. 없으면 null */
export function localFoodIcon(category: string): string | null {
  const leaf = category.split(" > ").pop() || category;
  return getFoodIconUrl(leaf) || getFoodIconUrl(categoryKey(category));
}

/** "음식점 > 일식 > 우동" → "우동" */
export function catShort(cat: string): string {
  return cat.split(" > ").pop() || cat;
}

/** 미터 → 사람이 읽는 거리 */
export function fmtDist(d: number | null | undefined): string {
  if (d === null || d === undefined) return "";
  return d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
}

export function kakaoUrl(p: { title: string; link?: string }): string {
  if (p.link?.includes("place.map.kakao") || p.link?.includes("map.kakao.com/link")) return p.link;
  return `https://map.kakao.com/link/search/${encodeURIComponent(p.title)}`;
}

export function naverUrl(p: { title: string }): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(p.title)}`;
}

export function googleUrl(p: { title: string; address?: string }): string {
  const q = encodeURIComponent(p.title + (p.address ? " " + p.address : ""));
  return `https://www.google.com/maps/search/?q=${q}&hl=ko`;
}

/**
 * 검색 결과의 좌표를 지도가 쓰는 십진 도(度) 문자열로 맞춘다.
 *
 * 🔴 제공자마다 형식이 다르다:
 *   - 카카오(`/api/search-kakao`, `/api/nearby`), 구글: 십진 도 문자열 ("127.0276")
 *   - **네이버(`/api/search`)는 1e7 배 정수 문자열** ("1270276000") 을 그대로 내려준다
 *     (그 라우트는 거리 계산에만 나눠 쓰고 응답은 원본을 넘긴다)
 * 나누지 않고 지도에 넘기면 마커가 지구 밖으로 날아간다.
 * 경도 |180|·위도 |90| 를 넘는 값은 1e7 스케일로 보고 되돌린다.
 */
export function normalizeCoord(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  let n = typeof raw === "number" ? raw : parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) > 1000) n = n / 1e7;      // 네이버 1e7 스케일
  if (Math.abs(n) > 200) return null;        // 그래도 이상하면 버린다
  return n;
}

/** 태그 섞인 검색 결과 제목 정제 (네이버는 <b> 를 넣어 준다) */
export function cleanTitle(t: string | undefined | null): string {
  return (t || "").replace(/<[^>]*>/g, "");
}
