/**
 * 개인 차단 — "나는 저 사람 글을 안 보겠다".
 *
 * 모임장의 강퇴(`group_bans`)와 다르다. 그건 모임 단위이고 모임장만 쓴다.
 * 구글 플레이 UGC 정책이 요구하는 것은 **사용자 본인이 다른 사용자를 차단**할 수 있는 길이다.
 *
 * ⚠️ `user_blocks` 테이블이 아직 없는 환경(마이그레이션 전)에서도 앱이 죽지 않아야 한다.
 * 그래서 조회는 실패하면 빈 집합을 돌려주고, 쓰기는 실패 사유를 문자열로 돌려준다.
 */
import { getSupabase } from "@/lib/supabase";

/** 테이블이 아직 없을 때 나오는 PostgREST 코드 */
function isMissingTable(err: { code?: string; message?: string } | null) {
  if (!err) return false;
  return err.code === "42P01" || /relation .*user_blocks.* does not exist/i.test(err.message || "");
}

/** 내가 차단한 사용자 id 집합. 실패하면 빈 집합 — 차단이 안 걸릴 뿐 화면은 산다. */
export async function fetchMyBlocks(myUserId: string | null): Promise<Set<string>> {
  if (!myUserId) return new Set();
  const { data, error } = await getSupabase()
    .from("user_blocks").select("blocked_id").eq("blocker_id", myUserId);
  if (error) {
    if (!isMissingTable(error)) console.warn("[blocks] 조회 실패:", error.message);
    return new Set();
  }
  return new Set((data || []).map((r: { blocked_id: string }) => r.blocked_id));
}

/** 차단. 성공하면 null, 실패하면 사용자에게 보여줄 문구. */
export async function blockUser(myUserId: string, targetUserId: string): Promise<string | null> {
  if (myUserId === targetUserId) return "자기 자신은 차단할 수 없습니다.";
  const { error } = await getSupabase()
    .from("user_blocks").upsert({ blocker_id: myUserId, blocked_id: targetUserId }, { onConflict: "blocker_id,blocked_id" });
  if (!error) return null;
  if (isMissingTable(error)) return "차단 기능이 아직 준비 중입니다. 잠시 후 다시 시도해 주세요.";
  return "차단하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

/** 차단 해제. 성공하면 null, 실패하면 문구. */
export async function unblockUser(myUserId: string, targetUserId: string): Promise<string | null> {
  const { error } = await getSupabase()
    .from("user_blocks").delete().eq("blocker_id", myUserId).eq("blocked_id", targetUserId);
  if (!error) return null;
  if (isMissingTable(error)) return "차단 기능이 아직 준비 중입니다.";
  return "차단을 해제하지 못했습니다.";
}

/** 내가 차단한 사람들의 id + 표시 이름. 프로필의 차단 목록 화면용. */
export async function fetchMyBlockList(myUserId: string | null): Promise<{ id: string; name: string }[]> {
  if (!myUserId) return [];
  const { data, error } = await getSupabase()
    .from("user_blocks").select("blocked_id, created_at")
    .eq("blocker_id", myUserId).order("created_at", { ascending: false });
  if (error || !data || data.length === 0) return [];

  const ids = data.map((r: { blocked_id: string }) => r.blocked_id);
  const { data: profiles } = await getSupabase()
    .from("user_profiles").select("id, display_name, nickname").in("id", ids);
  const nameOf = new Map<string, string>();
  for (const p of (profiles || []) as { id: string; display_name: string | null; nickname: string | null }[]) {
    nameOf.set(p.id, p.nickname || p.display_name || "알 수 없음");
  }
  return ids.map((id) => ({ id, name: nameOf.get(id) || "알 수 없음" }));
}
