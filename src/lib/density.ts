/**
 * "이 골목에 몇 곳" — 검색 결과 좌표만으로 세는 밀집도.
 *
 * 왜 쓸모가 있나: 여럿이 갈 때는 첫 집이 만석이거나 문을 닫았을 수 있다. 그때
 * 옆집으로 옮길 수 있는 자리인지가 실제로 중요하다. 그리고 이 값은 **추가 API 도
 * 사용자 데이터도 필요 없고, 남이 돈으로 조작할 수도 없다**(우리가 이미 받은
 * 검색 결과의 좌표만 쓴다).
 */

export type DensityItem = { title: string; mapx?: string; mapy?: string };

function meters(
  a: { x: number; y: number }, b: { x: number; y: number },
): number {
  const R = 6371e3;
  const dLat = (b.y - a.y) * Math.PI / 180;
  const dLng = (b.x - a.x) * Math.PI / 180;
  const la1 = a.y * Math.PI / 180, la2 = b.y * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 가게 이름 → 그 가게 주변(반경 `radiusM`)에 있는 **다른** 가게 수.
 *
 * 주의: 검색 결과 안에서만 센다. "이 동네 전체 음식점 수" 가 아니라
 * "지금 후보 중 이 근처에 몇 곳" 이다 — 문구도 그렇게 써야 거짓말이 안 된다.
 */
export function densityMap(items: DensityItem[], radiusM = 80): Record<string, number> {
  const pts = items.flatMap((it) => {
    const x = parseFloat(it.mapx ?? "");
    const y = parseFloat(it.mapy ?? "");
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    return [{ title: it.title, x, y }];
  });

  const out: Record<string, number> = {};
  for (const a of pts) {
    let n = 0;
    for (const b of pts) {
      if (a === b) continue;
      if (meters(a, b) <= radiusM) n++;
    }
    if (n > 0) out[a.title] = n;
  }
  return out;
}
