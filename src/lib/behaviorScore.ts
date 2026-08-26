"use client";

/**
 * 행동으로 취향을 배운다.
 *
 * 설문은 씨앗일 뿐이다. 사람이 실제로 무엇을 고르고 무엇을 먹으러 갔는지가
 * 더 정확하고, 시간이 갈수록 좋아진다. 경쟁 앱들이 리뷰로 하는 일을 우리는
 * "이 모임이 실제로 무엇을 먹었나" 로 한다 — 우리만 가진 신호다.
 *
 * 점수는 `user_food_scores` 에 쌓이고 홈 추천이 이미 그것을 쓴다.
 *
 * 🔴 남의 점수는 못 건드린다(RPC 안에서 auth.uid() 로 막아 뒀다). 그래서 각자
 *    자기 화면에서 자기 것만 올린다. 게스트는 계정이 없어 그냥 넘어간다.
 * 🔴 실패는 조용히 넘긴다. 취향 점수 때문에 화면이 멈추면 안 된다.
 */

import { getSupabase } from "./supabase";

/** 어떤 행동에 얼마를 줄지 한곳에 모아 둔다(흩어지면 균형을 못 잡는다) */
export const BEHAVIOR_WEIGHT = {
  /** 이 메뉴로 식당을 찾아봤다 — 관심 */
  searched: 1,
  /** 먹자팟에 들어갔다 — 실제로 먹으러 갈 생각 */
  joinedPat: 2,
  /** 먹고 나서 "또 갈래?" 에 그렇다고 했다 — 가장 센 신호 */
  wouldRepeat: 3,
} as const;

export async function bumpFoodScore(foodName: string, delta: number): Promise<void> {
  const name = (foodName || "").trim();
  if (!name || !delta) return;
  try {
    const { data: { session } } = await getSupabase().auth.getSession();
    if (!session?.user) return; // 게스트는 쌓을 곳이 없다
    // 2인자 형태는 함수 안에서 auth.uid() 를 쓴다 — 자기 것만 올라간다
    await getSupabase().rpc("increment_food_score", { p_food_name: name, p_delta: delta });
  } catch { /* 취향 점수는 실패해도 흐름을 막지 않는다 */ }
}

/** 여러 개를 한 번에 (같은 행동으로 여러 메뉴를 고른 경우) */
export async function bumpFoodScores(foodNames: string[], delta: number): Promise<void> {
  const uniq = [...new Set(foodNames.map(n => (n || "").trim()).filter(Boolean))];
  await Promise.all(uniq.map(n => bumpFoodScore(n, delta)));
}
