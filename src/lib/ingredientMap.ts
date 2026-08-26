"use client";

/**
 * 메뉴 ↔ 재료 표를 DB(`menu_ingredients`) 에서 받아 코드의 씨앗 표 위에 더한다.
 *
 * 코드 표만 쓰면 새 메뉴(사용자가 만든 커스텀 메뉴, 검색 API 가 주는 카테고리)에
 * 손을 쓸 수 없다. DB 로 옮기면 배포 없이 늘릴 수 있고, 사용자 제보도 쌓인다.
 *
 * 🔴 DB 를 못 읽어도 앱은 그대로 동작해야 한다 — 실패하면 코드 표만 쓴다.
 *    못 먹는 음식을 거르는 일이라, 조용히 아무것도 안 걸러지는 상태가 최악이다.
 */

import { getSupabase } from "./supabase";
import { INGREDIENT_HARD, INGREDIENT_SOFT, type IngredientMap } from "./ingredients";

const STATIC_MAP: IngredientMap = { hard: INGREDIENT_HARD, soft: INGREDIENT_SOFT };

let cache: IngredientMap | null = null;
let inflight: Promise<IngredientMap> | null = null;

function merge(rows: { menu_name: string; ingredient: string; severity: string }[]): IngredientMap {
  const hard: Record<string, string[]> = {};
  const soft: Record<string, string[]> = {};
  // 코드 표를 먼저 깔고
  for (const [ing, menus] of Object.entries(INGREDIENT_HARD)) hard[ing] = [...menus];
  for (const [ing, menus] of Object.entries(INGREDIENT_SOFT)) soft[ing] = [...menus];
  // DB 에 있는 것을 더한다(같은 것은 중복 제거)
  for (const r of rows) {
    const target = r.severity === "soft" ? soft : hard;
    const list = target[r.ingredient] ?? (target[r.ingredient] = []);
    if (!list.includes(r.menu_name)) list.push(r.menu_name);
  }
  return { hard, soft };
}

/** 한 번 받아 두고 계속 쓴다(같은 화면에서 여러 번 부른다) */
export function loadIngredientMap(): Promise<IngredientMap> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await getSupabase()
        .from("menu_ingredients")
        .select("menu_name,ingredient,severity")
        .eq("confirmed", true);
      // 테이블이 아직 없거나 못 읽으면 코드 표로 간다 — 앱을 멈추지 않는다
      cache = error || !data ? STATIC_MAP : merge(data);
    } catch {
      cache = STATIC_MAP;
    }
    inflight = null;
    return cache;
  })();
  return inflight;
}

/** 사용자 제보 — 3명이 같은 말을 하면 추천에 쓰인다(장난 방지) */
export async function reportMenuIngredient(menu: string, ingredient: string): Promise<boolean> {
  const { error } = await getSupabase().rpc("report_menu_ingredient", {
    p_menu: menu, p_ingredient: ingredient,
  });
  if (!error) cache = null; // 다음에 다시 받아 온다
  return !error;
}
