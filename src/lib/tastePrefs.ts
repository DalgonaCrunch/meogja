"use client";

/**
 * 선호도 저장 — 스와이프 한 장마다 바로 쓴다(중간에 나가도 남는다).
 *
 * 🔴 `score`·`kind` 컬럼은 마이그레이션 20260826000001 로 생긴다. 아직 안 돌린
 *    환경에서도 앱이 굴러가야 하므로, 컬럼이 없다는 오류가 오면 옛 형태로 한 번
 *    더 시도한다(점수는 못 남기지만 좋아함/못먹음은 남는다).
 */

import { getSupabase } from "./supabase";

export type TasteVerdict = "best" | "like" | "meh" | "never";

/** 화면의 4갈래 → 저장할 값. `meh`(상관없어)는 저장하지 않는다. */
export function verdictToRow(v: TasteVerdict): { type: "like" | "dislike"; score: number } | null {
  switch (v) {
    case "best": return { type: "like", score: 3 };
    case "like": return { type: "like", score: 2 };
    case "never": return { type: "dislike", score: -9 };
    case "meh": return null;
  }
}

export type PrefKind = "ingredient" | "menu" | "category";

/**
 * 한 건 저장. 같은 음식에 반대 표시가 남아 있으면 지운다
 * (UNIQUE(user_id, food_name, preference_type) 라서 좋아함과 못먹음이 동시에 남을 수 있다).
 */
export async function savePreference(
  userId: string,
  foodName: string,
  verdict: TasteVerdict,
  kind: PrefKind,
): Promise<boolean> {
  const row = verdictToRow(verdict);
  const sb = getSupabase();

  if (!row) {
    // '상관없어' — 예전에 남긴 표시가 있으면 지운다(마음이 바뀐 것으로 본다)
    await sb.from("user_food_preferences").delete().eq("user_id", userId).eq("food_name", foodName);
    return true;
  }

  const opposite = row.type === "like" ? "dislike" : "like";
  await sb.from("user_food_preferences")
    .delete().eq("user_id", userId).eq("food_name", foodName).eq("preference_type", opposite);

  const full = { user_id: userId, food_name: foodName, preference_type: row.type, score: row.score, kind };
  const { error } = await sb.from("user_food_preferences")
    .upsert(full, { onConflict: "user_id,food_name,preference_type" });
  if (!error) return true;

  // score/kind 컬럼이 아직 없는 환경 → 옛 형태로 다시
  const legacy = { user_id: userId, food_name: foodName, preference_type: row.type };
  const { error: err2 } = await sb.from("user_food_preferences")
    .upsert(legacy, { onConflict: "user_id,food_name,preference_type" });
  return !err2;
}

const DONE_KEY = "meogja_taste_done";

/** 튜토리얼을 한 번 끝냈다고 표시 (아무것도 안 고르고 지나간 사람도 다시 안 붙잡는다) */
export function markTasteDone() {
  try { localStorage.setItem(DONE_KEY, "1"); } catch { /* 사파리 사생활 모드 등 */ }
}

export function isTasteDone(): boolean {
  try { return localStorage.getItem(DONE_KEY) === "1"; } catch { return false; }
}

/** 이 사람이 선호도를 한 번이라도 등록했는가 (튜토리얼을 띄울지 판단) */
export async function hasAnyPreference(userId: string): Promise<boolean> {
  const { count } = await getSupabase()
    .from("user_food_preferences")
    .select("food_name", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}
