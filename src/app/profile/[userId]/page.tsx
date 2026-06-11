"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { BADGES, BADGE_MAP, RARITY_COLOR, Badge } from "@/lib/badges";

type UserProfile = {
  id: string;
  display_name: string | null;
  nickname: string | null;
  profile_image: string | null;
  age: string | null;
  mbti: string | null;
  active_badge_id: string | null;
};

type EarnedBadge = { badge_id: string; earned_at: string };
type FoodScore = { food_name: string; score: number };

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [foodScores, setFoodScores] = useState<FoodScore[]>([]);
  const [isMe, setIsMe] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: prof }, { data: badges }, { data: scores }, currentUser] = await Promise.all([
        getSupabase().from("user_profiles").select("id,display_name,nickname,profile_image,age,mbti,active_badge_id").eq("id", userId).single(),
        getSupabase().from("user_badges").select("badge_id,earned_at").eq("user_id", userId).order("earned_at"),
        getSupabase().from("user_food_scores").select("food_name,score").eq("user_id", userId).order("score", { ascending: false }).limit(5),
        getCurrentUser(),
      ]);
      setProfile(prof);
      setEarnedBadges(badges || []);
      setFoodScores(scores || []);
      if (currentUser.type === "auth" && currentUser.user.id === userId) setIsMe(true);
      setLoading(false);
    }
    load();
  }, [userId]);

  const displayName = profile?.nickname || profile?.display_name || "사용자";
  const activeBadge = profile?.active_badge_id ? BADGE_MAP[profile.active_badge_id] : null;
  const earnedSet = new Set(earnedBadges.map(b => b.badge_id));

  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}>
        <span style={{ fontSize:32 }}>🍽️</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ textAlign:"center", padding:"60px 20px" }}>
        <p style={{ fontSize:40, marginBottom:12 }}>👤</p>
        <p style={{ fontFamily:"var(--font-display)", fontSize:18 }}>존재하지 않는 사용자예요</p>
        <button onClick={() => router.back()} style={{ marginTop:20, padding:"10px 24px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontSize:14, cursor:"pointer" }}>
          뒤로가기
        </button>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24, paddingBottom:40 }}>
      {/* 헤더 */}
      <div className="fade-up" style={{ display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ width:72, height:72, borderRadius:"50%", overflow:"hidden", border:"2px solid var(--border)", background:"var(--bg-2)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {profile.profile_image
            ? <img src={profile.profile_image} alt="profile" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            : <span style={{ fontSize:32 }}>👤</span>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <h1 style={{ fontFamily:"var(--font-display)", fontSize:22, margin:0 }}>{displayName}</h1>
            {activeBadge && (
              <span style={{ fontSize:13, fontWeight:700, color:RARITY_COLOR[activeBadge.rarity], background:"var(--bg-2)", border:"1.5px solid var(--border)", borderRadius:"var(--r-pill)", padding:"2px 10px", display:"flex", alignItems:"center", gap:4 }}>
                {activeBadge.emoji} {activeBadge.name}
              </span>
            )}
          </div>
          <div style={{ display:"flex", gap:8, marginTop:4, flexWrap:"wrap" }}>
            {profile.age && <span style={{ fontSize:12, color:"var(--text-2)" }}>{profile.age}</span>}
            {profile.mbti && <span style={{ fontSize:12, color:"var(--primary)", fontWeight:600 }}>{profile.mbti}</span>}
          </div>
        </div>
        {isMe && (
          <button onClick={() => router.push("/profile")} style={{ padding:"7px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:12, cursor:"pointer", flexShrink:0 }}>
            내 설정
          </button>
        )}
      </div>

      {/* 획득 뱃지 */}
      <div className="fade-up">
        <p style={{ fontFamily:"var(--font-display)", fontSize:17, marginBottom:14 }}>🏅 획득한 뱃지 ({earnedSet.size}/{BADGES.length})</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10 }}>
          {BADGES.map(badge => {
            const has = earnedSet.has(badge.id);
            return (
              <div key={badge.id} style={{
                display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                padding:"14px 8px", borderRadius:16,
                background: has ? "var(--surface)" : "var(--bg-2)",
                border: has ? `1.5px solid ${RARITY_COLOR[badge.rarity]}` : "1.5px solid var(--border)",
                opacity: has ? 1 : 0.4,
                transition:"all .2s",
              }}>
                <span style={{ fontSize:28, filter: has ? "none" : "grayscale(1)" }}>{badge.emoji}</span>
                <span style={{ fontSize:11, fontWeight:700, color: has ? "var(--text)" : "var(--text-3)", textAlign:"center", lineHeight:1.3 }}>{badge.name}</span>
                <span style={{ fontSize:10, color:"var(--text-3)", textAlign:"center", lineHeight:1.3 }}>{badge.desc}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 취향 랭킹 */}
      {foodScores.length > 0 && (
        <div className="fade-up" style={{ background:"var(--surface)", borderRadius:20, padding:"18px 16px", border:"var(--card-border)" }}>
          <p style={{ fontFamily:"var(--font-display)", fontSize:17, marginBottom:12 }}>🍱 좋아하는 음식 TOP 5</p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {foodScores.map((item, i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
              const maxScore = foodScores[0]?.score || 1;
              const barPct = Math.max(4, Math.round(item.score / maxScore * 100));
              return (
                <div key={item.food_name} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ width:24, textAlign:"center", fontSize: medal ? 16 : 12, color:"var(--text-3)", fontWeight:700, flexShrink:0 }}>
                    {medal || `${i+1}`}
                  </span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ fontSize:13, fontWeight:600 }}>{item.food_name}</span>
                      <span style={{ fontSize:11, color:"var(--text-3)" }}>{item.score}점</span>
                    </div>
                    <div style={{ height:6, borderRadius:99, background:"var(--bg-2)" }}>
                      <div style={{ width:`${barPct}%`, height:"100%", borderRadius:99, background:"var(--primary)" }} />
                    </div>
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
