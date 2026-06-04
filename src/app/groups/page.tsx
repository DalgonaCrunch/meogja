"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, Group } from "@/lib/supabase";
import { getCurrentUser, CurrentUser } from "@/lib/auth";

const GROUP_EMOJIS = ['🍱','🍜','🍗','🍕','🍣','🥘','🌮','🍻','🥗','🍰'];

function GroupItem({ group, myMemberName, onClick }: { group: Group; myMemberName?: string; onClick: () => void }) {
  const emoji = GROUP_EMOJIS[group.name.charCodeAt(0) % GROUP_EMOJIS.length];
  const hue = 20 + (group.name.charCodeAt(0) % 6) * 18;
  return (
    <button onClick={onClick} className="tap" style={{ width:"100%", textAlign:"left", display:"flex", gap:12, alignItems:"center", padding:"12px 14px", background:"var(--surface)", border:"var(--card-border)", borderRadius:16, boxShadow:"var(--card-shadow)", cursor:"pointer" }}>
      <div style={{ width:60, height:60, borderRadius:14, flex:"none", display:"grid", placeItems:"center", fontSize:30, background:`linear-gradient(140deg, hsl(${hue} 82% 66%), hsl(${(hue+30)%360} 84% 54%))`, boxShadow:"0 3px 10px rgba(0,0,0,.1)" }}>
        <span style={{ filter:"drop-shadow(0 2px 5px rgba(0,0,0,.25))" }}>{emoji}</span>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <span style={{ fontFamily:"var(--font-display)", fontSize:16, color:"var(--text)", display:"block", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{group.name}</span>
        {group.description && <p style={{ fontSize:12, color:"var(--text-2)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{group.description}</p>}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3, flexWrap:"wrap" }}>
          {myMemberName && <span style={{ fontSize:11, padding:"1px 7px", borderRadius:"var(--r-pill)", fontWeight:700, color:"var(--primary)", background:"var(--primary-light)" }}>나: {myMemberName}</span>}
          {group.is_private && <span style={{ fontSize:11, padding:"1px 6px", borderRadius:"var(--r-pill)", color:"var(--text-2)", background:"var(--bg-2)" }}>🔒</span>}
          {group.require_auth && <span style={{ fontSize:11, padding:"1px 6px", borderRadius:"var(--r-pill)", color:"var(--primary)", background:"var(--primary-light)" }}>🔑</span>}
        </div>
      </div>
      <span style={{ color:"var(--text-3)", fontSize:18, flexShrink:0 }}>›</span>
    </button>
  );
}

export default function GroupsPage() {
  const router = useRouter();
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [myMemberships, setMyMemberships] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<CurrentUser>({ type: "none" });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const user = await getCurrentUser();
    setCurrentUser(user);

    const [allRes, pubRes] = await Promise.all([
      getSupabase().from("groups").select("id,name,description,is_private,require_auth,owner_id,owner_guest_name,created_at").order("created_at", { ascending: false }),
      getSupabase().from("groups").select("id,name,description,is_private,require_auth,owner_id,owner_guest_name,created_at").eq("is_private", false).eq("require_auth", false).order("created_at", { ascending: false }),
    ]);

    let memberMap: Record<string, string> = {};
    if (user.type === "auth") {
      const { data } = await getSupabase().from("members").select("group_id, name").eq("user_id", user.user.id);
      if (data) data.forEach((m) => { memberMap[m.group_id] = m.name; });
    } else if (user.type === "guest") {
      const { data } = await getSupabase().from("members").select("group_id, name").eq("guest_name", user.user.name);
      if (data) data.forEach((m) => { memberMap[m.group_id] = m.name; });
    }
    setMyMemberships(memberMap);

    const all = allRes.data || [];
    const isOwner = (g: Group) => {
      if (user.type === "auth") return g.owner_id === user.user.id;
      if (user.type === "guest") return g.owner_guest_name === user.user.name;
      return false;
    };
    const joined = all.filter((g) => memberMap[g.id] !== undefined || isOwner(g));
    const joinedIds = new Set(joined.map((g) => g.id));
    const pub = (pubRes.data || []).filter((g) => !joinedIds.has(g.id)).sort(() => Math.random() - 0.5).slice(0, 10);

    setMyGroups(joined);
    setPublicGroups(pub);
    setLoading(false);
  }

  function navigate(group: Group) {
    if (group.is_private) {
      const pw = prompt(`"${group.name}" 비밀번호 입력:`);
      if (!pw) return;
      fetch("/api/groups/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: group.id, password: pw }) })
        .then(r => r.json()).then(({ valid }) => {
          if (valid) router.push(`/groups/${group.id}`);
          else alert("비밀번호가 틀렸습니다");
        });
    } else {
      router.push(`/groups/${group.id}`);
    }
  }

  const filtered = search
    ? publicGroups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()) || g.description?.toLowerCase().includes(search.toLowerCase()))
    : publicGroups;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      {/* 헤더 */}
      <div style={{ padding:"16px 16px 0" }}>
        <h1 style={{ fontFamily:"var(--font-display)", fontSize:24, marginBottom:12 }}>모임</h1>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 모임 검색"
          style={{ width:"100%", padding:"11px 16px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--surface)", fontSize:14, color:"var(--text)", outline:"none" }}
          onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
      </div>

      {loading && <p style={{ textAlign:"center", padding:40, color:"var(--text-2)", fontSize:14 }}>불러오는 중…</p>}

      {!loading && (
        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:20 }}>
          {/* 내 모임 */}
          {currentUser.type !== "none" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontFamily:"var(--font-display)", fontSize:17 }}>내 모임</span>
                <button className="tap" onClick={() => router.push("/")} style={{ fontSize:12, color:"var(--primary)", fontWeight:700, background:"none", border:"none", cursor:"pointer" }}>+ 새 모임</button>
              </div>
              {myGroups.length === 0 ? (
                <p style={{ fontSize:14, color:"var(--text-2)", padding:"12px 0" }}>가입한 모임이 없습니다</p>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {myGroups.map((g) => <GroupItem key={g.id} group={g} myMemberName={myMemberships[g.id]} onClick={() => navigate(g)} />)}
                </div>
              )}
            </div>
          )}

          {/* 공개 모임 추천 */}
          {filtered.length > 0 && (
            <div>
              <span style={{ fontFamily:"var(--font-display)", fontSize:17, display:"block", marginBottom:10 }}>
                {search ? `"${search}" 검색 결과` : "📍 이런 모임은 어때요?"}
              </span>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {filtered.map((g) => <GroupItem key={g.id} group={g} onClick={() => navigate(g)} />)}
              </div>
            </div>
          )}

          {search && filtered.length === 0 && (
            <p style={{ textAlign:"center", color:"var(--text-2)", fontSize:14, padding:"20px 0" }}>검색 결과가 없습니다</p>
          )}
        </div>
      )}
    </div>
  );
}
