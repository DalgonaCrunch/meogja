/**
 * 같은 가게가 여러 번 나오는 것을 걸러낸다.
 *
 * 왜 생기나 (실물에서 같은 가게가 3개까지 보였다):
 *  1. `/search` 는 **고른 메뉴마다 따로 검색해 합친다.** 한 가게가 "우동" 에도
 *     "분식" 에도 걸리면 두 번 들어온다. 예전 판별 기준은 `이름|주소` 완전일치라,
 *     같은 집인데 주소 표기가 도로명/지번으로 갈리면 다른 가게로 봤다.
 *  2. 검색 제공자(카카오·네이버·구글)의 등록 자체가 갈려 있는 경우가 있다.
 *     같은 집이 "○○식당", "○○식당 본점", "○○식당 1호점" 으로 따로 올라와 있다.
 *     ⚠️ 여러 제공자를 섞어서 그런 것은 아니다 — 한 번 검색은 한 제공자만 쓴다.
 *
 * 그래서 **이름을 다듬고 + 좌표가 가까운지** 를 함께 본다. 이름만 보면 진짜 다른
 * 지점(강남점/역삼점)을 지워 버리고, 좌표만 보면 한 건물의 다른 가게가 지워진다.
 */

/** 지점·띄어쓰기·괄호를 떼어 비교용 이름을 만든다 */
export function normalizeStoreName(raw: string): string {
  return (raw || "")
    .replace(/<[^>]*>/g, "")           // 검색 결과의 <b> 태그
    .replace(/\([^)]*\)/g, "")          // 괄호 설명
    .replace(/\s+/g, "")
    .replace(/(본점|본店|직영점|분점|지점|\d+호점)$/u, "")
    .toLowerCase();
}

/** 두 좌표가 몇 m 떨어졌나 (없으면 null) */
function metersBetween(
  a: { mapx?: string; mapy?: string },
  b: { mapx?: string; mapy?: string },
): number | null {
  const ax = parseFloat(a.mapx ?? ""), ay = parseFloat(a.mapy ?? "");
  const bx = parseFloat(b.mapx ?? ""), by = parseFloat(b.mapy ?? "");
  if (![ax, ay, bx, by].every(Number.isFinite)) return null;
  const R = 6371e3;
  const dLat = (by - ay) * Math.PI / 180;
  const dLng = (bx - ax) * Math.PI / 180;
  const la1 = ay * Math.PI / 180, la2 = by * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 같은 가게로 볼 거리 — 한 건물 안쪽 정도만 */
const SAME_PLACE_M = 80;

export type DedupeItem = { title: string; address?: string; mapx?: string; mapy?: string };

/**
 * 앞에 있는 것을 남기고 뒤의 중복을 버린다(먼저 온 것이 보통 더 가깝거나 정확도가 높다).
 *
 * 같은 가게로 보는 조건:
 *  - 다듬은 이름이 같고, **좌표가 80m 안** 이거나 (좌표가 없으면) 주소 앞부분이 같다
 */
export function dedupePlaces<T extends DedupeItem>(items: T[]): T[] {
  const kept: { norm: string; item: T }[] = [];
  const out: T[] = [];

  for (const it of items) {
    const norm = normalizeStoreName(it.title);
    if (!norm) { out.push(it); continue; }

    const dup = kept.some(k => {
      if (k.norm !== norm) return false;
      const d = metersBetween(k.item, it);
      if (d !== null) return d <= SAME_PLACE_M;
      // 좌표를 모르면 주소 앞부분(시·구·동 정도)으로 견준다
      const a = (k.item.address || "").replace(/\s+/g, "").slice(0, 10);
      const b = (it.address || "").replace(/\s+/g, "").slice(0, 10);
      return !!a && a === b;
    });

    if (dup) continue;
    kept.push({ norm, item: it });
    out.push(it);
  }
  return out;
}
