"use client";

/**
 * 곧 시작하는 먹자팟 알려주기.
 *
 * 캐치테이블의 대표 불만이 예약금과 노쇼다. 우리는 돈을 받지 않으니 그 문제를
 * 돈이 아니라 **때맞춰 알려주는 것**으로 푼다.
 *
 * 🔴 서버 크론을 쓰지 않는다. Vercel Hobby 플랜의 크론은 하루 한 번이라
 *    "한 시간 뒤 약속" 을 제때 알릴 수 없다. 그래서 **앱을 열 때** 확인해
 *    띠를 띄운다. 알림을 못 받는 사람에게도 보인다는 장점이 있다.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

type Soon = {
  patId: string; groupId: string; title: string; menu: string; at: string;
  /** 몇 분 남았나 — 찾은 시점에 계산해 둔다(렌더 중에 시간을 읽으면 값이 흔들린다) */
  minsLeft: number;
};

/** 몇 시간 안쪽이면 "곧" 으로 볼지 */
const SOON_HOURS = 4;
const DISMISS_KEY = "meogja_pat_reminder_dismissed";

function readDismissed(): string[] {
  try { return JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "[]"); } catch { return []; }
}

export default function PatReminder() {
  const router = useRouter();
  const [soon, setSoon] = useState<Soon | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await getCurrentUser();
      if (!alive || u.type === "none") return;

      // 내가 속한 멤버 행 찾기 (로그인·게스트 둘 다)
      let q = getSupabase().from("members").select("id").eq("status", "approved");
      if (u.type === "auth") q = q.eq("user_id", u.user.id);
      else q = q.eq("guest_name", u.user.name);
      const { data: mem } = await q;
      const myIds = (mem || []).map(m => m.id);
      if (!alive || myIds.length === 0) return;

      // 내가 들어간 팟
      const { data: joins } = await getSupabase()
        .from("meal_pat_joins").select("pat_id").in("member_id", myIds);
      const patIds = [...new Set((joins || []).map(j => j.pat_id))];
      if (!alive || patIds.length === 0) return;

      const now = Date.now();
      const until = new Date(now + SOON_HOURS * 3600_000).toISOString();
      const { data: pats } = await getSupabase()
        .from("meal_pats")
        .select("id,group_id,title,menu,scheduled_at,status")
        .in("id", patIds)
        .eq("status", "open")
        .not("scheduled_at", "is", null)
        .lte("scheduled_at", until)
        .order("scheduled_at", { ascending: true });

      if (!alive) return;
      const dismissed = readDismissed();
      const next = (pats || []).find(p =>
        p.scheduled_at && new Date(p.scheduled_at).getTime() > now - 30 * 60_000 // 30분 전까진 유효
        && !dismissed.includes(p.id));
      if (next) {
        setSoon({
          patId: next.id, groupId: next.group_id,
          title: next.title, menu: next.menu, at: next.scheduled_at!,
          minsLeft: Math.round((new Date(next.scheduled_at!).getTime() - now) / 60_000),
        });
      }
    })().catch(() => {/* 알림 띠는 실패해도 조용히 넘긴다 */});
    return () => { alive = false; };
  }, []);

  if (!soon) return null;

  const when = new Date(soon.at);
  const mins = soon.minsLeft;
  const label = mins <= 0 ? "지금" : mins < 60 ? `${mins}분 뒤` : `${Math.round(mins / 60)}시간 뒤`;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...readDismissed(), soon!.patId]));
    } catch { /* ignore */ }
    setSoon(null);
  }

  return (
    <div style={{ padding: "12px 16px 0" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px", borderRadius: 16,
        background: "var(--primary-light, #FFF0EC)", border: "1.5px solid var(--primary)",
      }}>
        <span style={{ fontSize: 22 }}>⏰</span>
        <button className="tap" onClick={() => router.push(`/groups/${soon.groupId}?tab=pat&pat=${soon.patId}`)}
          style={{ flex: 1, minWidth: 0, background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0 }}>
          <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 14.5, color: "var(--primary)" }}>
            {label} · {soon.menu} 먹자팟
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {soon.title} · {when.getHours()}시 {String(when.getMinutes()).padStart(2, "0")}분
          </span>
        </button>
        <button onClick={dismiss} aria-label="닫기"
          style={{ background: "none", border: "none", fontSize: 16, color: "var(--text-3)", cursor: "pointer" }}>✕</button>
      </div>
    </div>
  );
}
