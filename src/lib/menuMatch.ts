/**
 * 사용자가 쓴 메뉴 이름을 우리 사전의 표준 이름으로 맞춘다.
 *
 * 왜 필요한가: 먹자팟은 메뉴를 **자유롭게** 적을 수 있다. 그런데 그 값이 세 곳에서
 * 쓰인다 — 아이콘 찾기, 취향 점수 적립("또 갈래?"), "이 메뉴 팟 N개" 집계.
 * 그래서 "삼겹살 / 삼겹 / 삼겹살구이" 가 서로 다른 메뉴가 되고, 오타가 취향 점수에
 * 그대로 쌓인다. 아이콘도 못 찾는다.
 *
 * 방침: 자유 입력은 그대로 받는다(막으면 답답하다). 대신
 *  - 적는 동안 후보를 보여주고(고르면 표준 이름)
 *  - 저장할 때 가까운 표준 이름을 찾아 그것을 쓰고, 사용자가 쓴 원문은 제목에 남긴다
 *  - 표준 이름을 못 찾으면 취향 점수는 쌓지 않는다(사전에 없는 말로 점수를 만들지 않는다)
 */

import { ALL_MENUS, ROULETTE_POOL } from "./menus";
import { MENU_DATA } from "./recommend";

/** 우리가 아는 모든 메뉴 이름 (긴 이름이 먼저 걸리도록 정렬해 둔다) */
export const KNOWN_MENUS: string[] = Array.from(new Set([
  ...ALL_MENUS,
  ...ROULETTE_POOL,
  ...MENU_DATA.flatMap(l => l.medium.flatMap(m => m.items)),
])).sort((a, b) => b.length - a.length);

const squash = (s: string) => (s || "").replace(/\s+/g, "").toLowerCase();

/** 입력하는 동안 보여줄 후보 */
export function suggestMenus(input: string, limit = 6): string[] {
  const q = squash(input);
  if (q.length < 1) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const m of KNOWN_MENUS) {
    const t = squash(m);
    if (t === q) continue;               // 이미 정확히 같은 것은 후보로 둘 필요가 없다
    if (t.startsWith(q)) starts.push(m);
    else if (t.includes(q)) contains.push(m);
    if (starts.length >= limit) break;
  }
  // 시작이 같은 것이 더 그럴듯하다. 짧은 이름을 앞에 둔다(구체적인 것보다 대표적인 것)
  const byLen = (a: string, b: string) => a.length - b.length;
  return [...starts.sort(byLen), ...contains.sort(byLen)].slice(0, limit);
}

/**
 * 표준 이름으로 맞춘다. 못 맞추면 null.
 *
 * 규칙 (넓게 잡으면 엉뚱한 것에 붙는다 — 좁게 잡고 못 맞추면 포기한다):
 *  1. 공백·대소문자만 다른 경우 → 그 이름
 *  2. 입력이 우리 이름을 **포함**하는 경우("매운 삼겹살" → 삼겹살) → 가장 긴 것
 *  3. 입력이 우리 이름의 **앞부분**인 경우, 두 글자 이상이고 후보가 하나일 때만
 */
export function canonicalizeMenu(input: string): string | null {
  const q = squash(input);
  if (!q) return null;

  for (const m of KNOWN_MENUS) if (squash(m) === q) return m;

  const inside = KNOWN_MENUS.filter(m => squash(m).length >= 2 && q.includes(squash(m)));
  if (inside.length > 0) return inside[0]; // KNOWN_MENUS 는 긴 이름부터라 첫 번째가 가장 구체적

  if (q.length >= 2) {
    const prefix = KNOWN_MENUS.filter(m => squash(m).startsWith(q));
    if (prefix.length === 1) return prefix[0];
  }
  return null;
}

/** 저장할 값: 표준 이름이 있으면 그것, 없으면 사용자가 쓴 것을 다듬어서 */
export function menuForStorage(input: string): { menu: string; canonical: boolean } {
  const canon = canonicalizeMenu(input);
  return canon ? { menu: canon, canonical: true } : { menu: input.trim(), canonical: false };
}
