"use client";

import { useEffect, useState } from "react";
import { getSupabase, Session, SessionPick, Favorite, Review, Member } from "@/lib/supabase";

const MEMBER_COLORS = ["#F4631E","#3D7A5A","#6B5CE7","#E7975C","#2E86AB","#C94040","#7B8C42","#A35CB0"];
const STARS = [1, 2, 3, 4, 5];

type Props = { groupId: string; members: Member[]; mapProvider: "naver" | "kakao"; };

export default function HistoryTab({ groupId, members, mapProvider }: Props) {
  const [sessions, setSessions] = useState<(Session & { picks: SessionPick[] })[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeSection, setActiveSection] = useState<"history" | "favorites" | "reviews">("history");
  const [reviewTarget, setReviewTarget] = useState<{ name: string; address: string; link: string; category: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewMemberId, setReviewMemberId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAll();
  }, [groupId]);

  async function loadAll() {
    const [sessRes, favRes, revRes] = await Promise.all([
      getSupabase().from("sessions").select("*, picks:session_picks(*)").eq("group_id", groupId).order("created_at", { ascending: false }).limit(20),
      getSupabase().from("favorites").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
      getSupabase().from("reviews").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
    ]);
    if (sessRes.data) setSessions(sessRes.data as (Session & { picks: SessionPick[] })[]);
    if (favRes.data) setFavorites(favRes.data);
    if (revRes.data) setReviews(revRes.data);
  }

  async function removeFavorite(id: string) {
    await getSupabase().from("favorites").delete().eq("id", id);
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }

  async function submitReview() {
    if (!reviewTarget) return;
    setSubmitting(true);
    await getSupabase().from("reviews").insert({
      group_id: groupId,
      member_id: reviewMemberId || null,
      restaurant_name: reviewTarget.name,
      rating: reviewRating,
      comment: reviewComment,
    });
    setReviewTarget(null);
    setReviewComment("");
    setReviewRating(5);
    setReviewMemberId("");
    setSubmitting(false);
    loadAll();
  }

  function mapLink(r: { restaurant_name?: string; title?: string; restaurant_address?: string; address?: string }) {
    const name = r.restaurant_name || r.title || "";
    const addr = r.restaurant_address || r.address || "";
    return mapProvider === "naver"
      ? `https://map.naver.com/v5/search/${encodeURIComponent(name + " " + addr)}`
      : `https://map.kakao.com/link/search/${encodeURIComponent(name)}`;
  }

  const avgRating = (name: string) => {
    const rs = reviews.filter((r) => r.restaurant_name === name);
    if (!rs.length) return null;
    return (rs.reduce((s, r) => s + r.rating, 0) / rs.length).toFixed(1);
  };

  const sectionBtn = (s: typeof activeSection, label: string) => (
    <button onClick={() => setActiveSection(s)} style={{
      padding: "7px 18px", borderRadius: 100, border: "none", fontSize: 13, fontWeight: 600,
      background: activeSection === s ? "var(--text)" : "transparent",
      color: activeSection === s ? "#fff" : "var(--text-muted)",
      cursor: "pointer", transition: "all 0.15s",
    }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 섹션 탭 */}
      <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 100, padding: 3, gap: 3, width: "fit-content" }}>
        {sectionBtn("history", `📋 히스토리 ${sessions.length > 0 ? `(${sessions.length})` : ""}`)}
        {sectionBtn("favorites", `⭐ 즐겨찾기 ${favorites.length > 0 ? `(${favorites.length})` : ""}`)}
        {sectionBtn("reviews", `💬 리뷰 ${reviews.length > 0 ? `(${reviews.length})` : ""}`)}
      </div>

      {/* 히스토리 */}
      {activeSection === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessions.length === 0 && (
            <p style={{ fontSize: 14, color: "var(--text-muted)", padding: "20px 0" }}>아직 추천 기록이 없습니다</p>
          )}
          {sessions.map((s, i) => (
            <div key={s.id} style={{ background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{new Date(s.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>참가: {(s.participant_names || []).join(", ")}</p>
                </div>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{s.picks?.length || 0}곳</span>
              </div>
              {(s.picks || []).map((p, j) => {
                const avg = avgRating(p.restaurant_name);
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderBottom: j < (s.picks?.length || 0) - 1 ? "1px solid var(--border)" : "none" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <a href={p.restaurant_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", textDecoration: "none" }}>{p.restaurant_name}</a>
                        {avg && <span style={{ fontSize: 11, color: "#C77800" }}>★ {avg}</span>}
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{p.restaurant_address}</p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setReviewTarget({ name: p.restaurant_name, address: p.restaurant_address, link: p.restaurant_link, category: p.restaurant_category })} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>리뷰</button>
                      <a href={mapLink(p)} target="_blank" rel="noopener noreferrer" style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)", textDecoration: "none" }}>🗺️</a>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* 즐겨찾기 */}
      {activeSection === "favorites" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {favorites.length === 0 && (
            <p style={{ fontSize: 14, color: "var(--text-muted)", padding: "20px 0" }}>즐겨찾기가 없습니다. 추천 결과에서 ★를 눌러 추가하세요.</p>
          )}
          {favorites.map((f) => {
            const avg = avgRating(f.restaurant_name);
            return (
              <div key={f.id} style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", boxShadow: "var(--shadow)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{f.restaurant_name}</span>
                    {avg && <span style={{ fontSize: 12, color: "#C77800" }}>★ {avg}</span>}
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{f.restaurant_category} · {f.restaurant_address}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setReviewTarget({ name: f.restaurant_name, address: f.restaurant_address, link: f.restaurant_link, category: f.restaurant_category })} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>리뷰</button>
                  <a href={mapLink({ restaurant_name: f.restaurant_name, restaurant_address: f.restaurant_address })} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)", textDecoration: "none" }}>🗺️</a>
                  <button onClick={() => removeFavorite(f.id)} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, background: "transparent", border: "1px solid var(--border)", color: "var(--red)", cursor: "pointer" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 리뷰 */}
      {activeSection === "reviews" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reviews.length === 0 && (
            <p style={{ fontSize: 14, color: "var(--text-muted)", padding: "20px 0" }}>아직 리뷰가 없습니다</p>
          )}
          {reviews.map((r) => {
            const member = members.find((m) => m.id === r.member_id);
            const memberIdx = members.findIndex((m) => m.id === r.member_id);
            const color = memberIdx >= 0 ? MEMBER_COLORS[memberIdx % MEMBER_COLORS.length] : "var(--text-muted)";
            return (
              <div key={r.id} style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", boxShadow: "var(--shadow)", padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{r.restaurant_name}</span>
                    <span style={{ color: "#F5A623", fontSize: 14 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  </div>
                  {member && (
                    <span style={{ fontSize: 11, color, fontWeight: 600 }}>{member.name}</span>
                  )}
                </div>
                {r.comment && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{r.comment}</p>}
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{new Date(r.visited_at).toLocaleDateString("ko-KR")}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* 리뷰 작성 모달 */}
      {reviewTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setReviewTarget(null); }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, boxShadow: "var(--shadow-lg)" }}>
            <p style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{reviewTarget.name}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>{reviewTarget.address}</p>

            {/* 별점 */}
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>별점</p>
            <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
              {STARS.map((s) => (
                <button key={s} onClick={() => setReviewRating(s)} style={{ fontSize: 28, background: "none", border: "none", cursor: "pointer", color: s <= reviewRating ? "#F5A623" : "var(--border)", transition: "color 0.1s" }}>
                  ★
                </button>
              ))}
            </div>

            {/* 작성자 */}
            {members.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>작성자</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {members.map((m, i) => (
                    <button key={m.id} onClick={() => setReviewMemberId(reviewMemberId === m.id ? "" : m.id)} style={{
                      padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                      border: reviewMemberId === m.id ? `2px solid ${MEMBER_COLORS[i % MEMBER_COLORS.length]}` : "1.5px solid var(--border)",
                      background: reviewMemberId === m.id ? MEMBER_COLORS[i % MEMBER_COLORS.length] + "18" : "transparent",
                      color: reviewMemberId === m.id ? MEMBER_COLORS[i % MEMBER_COLORS.length] : "var(--text)",
                      cursor: "pointer",
                    }}>{m.name}</button>
                  ))}
                </div>
              </div>
            )}

            {/* 코멘트 */}
            <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="한 줄 감상 (선택)" rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 13, resize: "none", outline: "none", marginBottom: 16 }} />

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setReviewTarget(null)} style={{ flex: 1, padding: 11, borderRadius: 100, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>취소</button>
              <button onClick={submitReview} disabled={submitting} style={{ flex: 2, padding: 11, borderRadius: 100, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>등록</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
