/**
 * 식당 한 곳에 대한 사람별 좋아요/싫어요.
 *
 * 🔴 **계정**에 남긴다(모임이 아니라). 모임마다 닉네임이 다르고 모임을 옮길 수도
 * 있는데, "내가 그 가게를 어떻게 봤나" 는 나를 따라와야 한다.
 *
 * 표는 user_place_prefs (supabase/migrations/20260831000001_user_place_prefs.sql).
 * 표가 아직 없는 환경에서는 기기에만 남긴다 — 화면이 죽는 것보다 낫다.
 */
import { getSupabase } from "@/lib/supabase";
import { normalizeStoreName } from "@/lib/dedupePlaces";

export type Pref = 1 | -1;
export type PlacePrefRow = { user_id: string; place_key: string; pref: Pref };

/** 표기가 갈린 같은 집을 하나로 묶는 키 */
export function placeKey(name: string): string {
  return normalizeStoreName(name || "");
}

const LOCAL_KEY = "meogja_place_prefs";

function readLocal(): Record<string, Pref> {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"); } catch { return {}; }
}
function writeLocal(map: Record<string, Pref>) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(map)); } catch { /* 저장 못 하면 넘긴다 */ }
}

/** 표가 없는 환경인가 — 한 번 확인하면 기억한다(매번 실패 요청을 보내지 않는다) */
let tableMissing = false;
function isMissingTable(msg?: string): boolean {
  return !!msg && (msg.includes("user_place_prefs") || msg.includes("schema cache"));
}

/**
 * 이 가게들에 대한 표를 가져온다.
 * @param userIds 세어 볼 사람들(모임 멤버의 계정 id). 비면 내 표만 본다.
 */
export async function fetchPlacePrefs(
  keys: string[],
  userIds: string[],
): Promise<PlacePrefRow[]> {
  const uniq = [...new Set(keys.filter(Boolean))];
  if (uniq.length === 0 || tableMissing) return [];
  let q = getSupabase().from("user_place_prefs").select("user_id,place_key,pref").in("place_key", uniq);
  if (userIds.length > 0) q = q.in("user_id", userIds);
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error.message)) tableMissing = true;
    return [];
  }
  return (data || []) as PlacePrefRow[];
}

/** 내가 이 가게들에 남긴 표 (표가 없으면 기기에 남긴 것) */
export function myPrefsFromRows(rows: PlacePrefRow[], myUserId: string | null): Record<string, Pref> {
  const out: Record<string, Pref> = {};
  if (myUserId) rows.filter(r => r.user_id === myUserId).forEach(r => { out[r.place_key] = r.pref; });
  if (tableMissing || !myUserId) {
    const local = readLocal();
    Object.entries(local).forEach(([k, v]) => { if (out[k] === undefined) out[k] = v; });
  }
  return out;
}

/** 가게별 좋아요/싫어요 수 */
export function countsFromRows(rows: PlacePrefRow[]): Record<string, { up: number; down: number }> {
  const out: Record<string, { up: number; down: number }> = {};
  rows.forEach(r => {
    if (!out[r.place_key]) out[r.place_key] = { up: 0, down: 0 };
    if (r.pref === 1) out[r.place_key].up++; else out[r.place_key].down++;
  });
  return out;
}

/**
 * 표를 남긴다. 같은 것을 다시 누르면 취소한다(한 가게에 하나만 남는다).
 * @returns 누른 뒤의 내 표. null 이면 취소된 것.
 */
export async function togglePlacePref(
  args: { userId: string | null; name: string; address?: string | null; pref: Pref; current?: Pref | null },
): Promise<Pref | null> {
  const key = placeKey(args.name);
  const next: Pref | null = args.current === args.pref ? null : args.pref;

  // 기기 저장은 항상 맞춰 둔다(로그인 전이나 표가 없는 환경의 유일한 기록이다)
  const local = readLocal();
  if (next === null) delete local[key]; else local[key] = next;
  writeLocal(local);

  if (!args.userId || tableMissing) return next;

  if (next === null) {
    const { error } = await getSupabase().from("user_place_prefs")
      .delete().eq("user_id", args.userId).eq("place_key", key);
    if (error && isMissingTable(error.message)) tableMissing = true;
    return null;
  }

  const { error } = await getSupabase().from("user_place_prefs").upsert({
    user_id: args.userId,
    place_key: key,
    place_name: args.name,
    place_address: args.address || null,
    pref: next,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,place_key" });
  if (error && isMissingTable(error.message)) tableMissing = true;
  return next;
}
