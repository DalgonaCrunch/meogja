"use client";

/**
 * "우리가 고른 메뉴" 결과 카드 공유.
 *
 * 왜 필요한가: 우리는 맛집을 찾아주는 서비스가 아니라 **정해주는** 서비스다.
 * 정해진 결과가 밖으로 나가지 않으면 아무도 우리를 모른다 — 결과 공유가
 * 사실상 유일한 성장 수단이다(COMPETITORS.md 참고).
 *
 * 링크는 서버에 아무것도 저장하지 않는다. 필요한 것(메뉴·모임 이름·고른 사람)을
 * 주소에 담는다 — 표를 만들 필요도, 지워야 할 데이터도 없다.
 */

const BASE = typeof window !== "undefined" ? window.location.origin : "https://meogja.vercel.app";

export type ShareResult = {
  /** 정해진 메뉴들 (첫 번째가 대표) */
  menus: string[];
  /** 모임 이름 (없으면 혼자 정한 것) */
  groupName?: string;
  /** 고른 사람들 이름 — "누가 골랐나" 를 보여주는 것이 공유 동기를 만든다 */
  who?: string[];
};

export function buildResultUrl({ menus, groupName, who }: ShareResult): string {
  const p = new URLSearchParams();
  p.set("m", menus.filter(Boolean).slice(0, 4).join(","));
  if (groupName) p.set("g", groupName);
  if (who?.length) p.set("who", who.filter(Boolean).slice(0, 8).join(","));
  return `${BASE}/result?${p.toString()}`;
}

/** 공유 시트를 띄우고, 안 되면 링크를 복사한다 */
export async function shareResult(r: ShareResult): Promise<"shared" | "copied" | "failed"> {
  const url = buildResultUrl(r);
  const menu = r.menus[0] ?? "오늘 메뉴";
  const title = r.groupName ? `${r.groupName} 오늘 메뉴는 ${menu}!` : `오늘 메뉴는 ${menu}!`;
  const text = r.who?.length
    ? `${title}\n${r.who.join(", ")} 취향으로 정했어요 🍽️`
    : `${title}\n먹자냥이 정해줬어요 🍽️`;
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return "shared";
    }
  } catch {
    // 사용자가 취소한 경우도 여기로 온다 — 복사로 떨어지지 않게 바로 끝낸다
    return "failed";
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
