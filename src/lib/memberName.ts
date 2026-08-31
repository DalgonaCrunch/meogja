/**
 * 모임 안에서 사람을 부르는 이름.
 *
 * 🔴 채팅·투표·리뷰가 각자 user_profiles.display_name(계정 이름)을 읽어 쓰고 있었다.
 * 소셜 로그인으로 만들어진 계정 이름은 본인이 고치기 어렵고, 무엇보다 모임에서는
 * 그 모임에서 쓰는 이름으로 불려야 한다. 여기 한 군데로 모은다.
 */
import { Member } from "@/lib/supabase";

/** 이 모임에서 이 사람의 이름. 모임 멤버로 없으면 저장돼 있던 이름을 쓴다. */
export function groupMemberName(
  members: Member[],
  userId: string | null | undefined,
  fallback?: string | null,
): string {
  if (userId) {
    const m = members.find((mm) => mm.user_id === userId);
    if (m?.name) return m.name;
  }
  return fallback || "멤버";
}
