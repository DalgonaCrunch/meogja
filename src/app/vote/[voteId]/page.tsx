"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

type VoteRestaurant = { title: string; address: string; category: string; };
type VoteData = { id: string; title: string; restaurants: VoteRestaurant[]; created_by: string; created_at: string; };
type VoteResponse = { id: string; voter_name: string; chosen_restaurant: string; };

export default function VotePage() {
  const { voteId } = useParams<{ voteId: string }>();
  const [vote, setVote] = useState<VoteData | null>(null);
  const [responses, setResponses] = useState<VoteResponse[]>([]);
  const [voterName, setVoterName] = useState("");
  const [myVote, setMyVote] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  // 브라우저 세션별 고유 ID — 동명 사용자 덮어쓰기 방지
  const [voterSessionId] = useState(() => {
    if (typeof window === "undefined") return "";
    const key = `meogja_voter_${voteId}`;
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    sessionStorage.setItem(key, newId);
    return newId;
  });

  useEffect(() => {
    loadVote();
    getCurrentUser().then((user) => {
      if (user.type === "auth") setVoterName(user.user.display_name || "");
      else if (user.type === "guest") setVoterName(user.user.name);
    });
  }, [voteId]);

  async function loadVote() {
    const [{ data: voteData }, { data: responseData }] = await Promise.all([
      getSupabase().from("group_votes").select("*").eq("id", voteId).single(),
      getSupabase().from("vote_responses").select("*").eq("vote_id", voteId),
    ]);
    if (voteData) setVote(voteData);
    if (responseData) setResponses(responseData);
    setLoading(false);
  }

  async function submitVote() {
    if (!myVote || !voterName.trim()) return;
    // voter_name + session_id 조합으로 중복 방지
    const uniqueName = `${voterName.trim()}__${voterSessionId.slice(0,8)}`;
    await getSupabase().from("vote_responses").upsert({
      vote_id: voteId,
      voter_name: uniqueName,
      chosen_restaurant: myVote,
    }, { onConflict: "vote_id,voter_name" });
    setSubmitted(true);
    loadVote();
  }

  const tally = responses.reduce((acc, r) => {
    acc[r.chosen_restaurant] = (acc[r.chosen_restaurant] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  // voter_name에서 session suffix 제거 (표시용)
  const displayName = (name: string) => name.replace(/__[a-z0-9]{8}$/, "");

  const maxVotes = Math.max(...Object.values(tally), 0);

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>로딩 중…</div>;
  if (!vote) return <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>투표를 찾을 수 없습니다</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 500, margin: "0 auto" }}>
      <div className="fade-up">
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, marginBottom: 6 }}>🗳️ {vote.title}</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{vote.created_by}님이 시작한 투표 · {responses.length}명 참여</p>
      </div>

      {!submitted ? (
        <div className="fade-up fade-up-1" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 이름 입력 */}
          {!voterName && (
            <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 20, border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>이름을 입력하세요</p>
              <input value={voterName} onChange={(e) => setVoterName(e.target.value)} placeholder="내 이름"
                style={{ width: "100%", padding: "10px 16px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 14, outline: "none" }}
                onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
            </div>
          )}

          {/* 후보 선택 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {vote.restaurants.map((r, i) => (
              <button key={i} onClick={() => setMyVote(r.title)} style={{
                padding: "16px 18px", borderRadius: 16, textAlign: "left", cursor: "pointer",
                border: myVote === r.title ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                background: myVote === r.title ? "var(--accent-soft)" : "var(--bg-card)",
                boxShadow: "var(--shadow-card)", transition: "all 0.15s",
              }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: myVote === r.title ? "var(--accent)" : "var(--text)" }}>{r.title}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{r.category} · {r.address}</p>
                {tally[r.title] > 0 && (
                  <p style={{ fontSize: 11, color: "var(--accent)", marginTop: 4, fontWeight: 600 }}>현재 {tally[r.title]}표</p>
                )}
              </button>
            ))}
          </div>

          <button onClick={submitVote} disabled={!myVote || !voterName.trim()} style={{
            padding: "14px", borderRadius: 100, border: "none",
            background: (!myVote || !voterName.trim()) ? "var(--border)" : "var(--accent)",
            color: (!myVote || !voterName.trim()) ? "var(--text-muted)" : "#fff",
            fontFamily: "var(--font-display)", fontSize: 16, cursor: (!myVote || !voterName.trim()) ? "default" : "pointer",
          }}>
            투표하기 →
          </button>
        </div>
      ) : (
        <div className="bounce-in">
          <div style={{ padding: "24px", borderRadius: 20, background: "var(--accent-soft)", border: "2px solid var(--accent)", marginBottom: 20, textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--accent)" }}>🎉 투표 완료!</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 6 }}>{myVote}에 투표했습니다</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {vote.restaurants.map((r, i) => {
              const count = tally[r.title] || 0;
              const pct = responses.length > 0 ? Math.round((count / responses.length) * 100) : 0;
              const isWinner = count === maxVotes && count > 0;
              return (
                <div key={i} style={{ padding: "14px 18px", borderRadius: 14, background: "var(--bg-card)", border: `1.5px solid ${isWinner ? "var(--accent)" : "var(--border)"}`, boxShadow: "var(--shadow-card)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: isWinner ? "var(--accent)" : "var(--text)" }}>{isWinner ? "🏆 " : ""}{r.title}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isWinner ? "var(--accent)" : "var(--text-muted)" }}>{count}표 ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 100, background: "var(--border)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 100, background: isWinner ? "var(--accent)" : "var(--text-muted)", width: `${pct}%`, transition: "width 0.8s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
