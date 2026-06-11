"use client";

import { useEffect, useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, signOut, CurrentUser } from "@/lib/auth";
import { getSupabase, Group } from "@/lib/supabase";
import { getAllLargeCategories, getMediumCategories, getMenuItems, getCategorySubItems } from "@/lib/recommend";
import { THEMES, ThemeId, applyTheme, getSavedTheme } from "@/lib/theme";
import { toast, showAlert, showConfirm } from "@/lib/dialog";
import { ALL_AVATARS, DEFAULT_AVATARS } from "@/lib/mascot";
import ImageCropModal from "@/app/ImageCropModal";
import { usePushSubscription } from "@/lib/usePushSubscription";
import { BADGES, BADGE_MAP, RARITY_COLOR } from "@/lib/badges";

const selectStyle: React.CSSProperties = {
  flex:1, padding:"6px 10px", borderRadius:"var(--r-sm)", border:"1.5px solid var(--primary)",
  background:"var(--bg)", fontSize:13, outline:"none", color:"var(--text)", cursor:"pointer",
};

function ProfileFieldRow({ fieldKey, label, value, editable, isLast, onSave, options, fieldType }: {
  fieldKey: string; label: string; value: string; editable: boolean; isLast: boolean;
  onSave: (key: string, val: string) => Promise<void>;
  options?: string[];
  fieldType?: "select" | "birthday";
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value);
  const [bdMonth, setBdMonth] = useState(() => value?.split("-")[0] || "");
  const [bdDay, setBdDay] = useState(() => value?.split("-")[1] || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    let val = editVal.trim();
    if (fieldType === "birthday") {
      if (!bdMonth || !bdDay) return;
      val = `${bdMonth}-${bdDay}`;
    }
    if (!val) return;
    setSaving(true);
    await onSave(fieldKey, val);
    setSaving(false);
    setEditing(false);
  }

  const displayValue = (() => {
    if (!value) return "미설정";
    if (fieldType === "birthday") {
      const [m, d] = value.split("-");
      return m && d ? `${parseInt(m)}월 ${parseInt(d)}일` : value;
    }
    return value;
  })();

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

  return (
    <div style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom: isLast ? "none" : "1px solid var(--border)", gap:8 }}>
      <span style={{ fontSize:12, color:"var(--text-2)", width:90, flexShrink:0, fontWeight:600 }}>{label}</span>
      {editing ? (
        <div style={{ display:"flex", gap:6, flex:1, alignItems:"center" }}>
          {fieldType === "select" && options ? (
            <select autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} style={selectStyle}>
              <option value="">선택</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : fieldType === "birthday" ? (
            <div style={{ display:"flex", gap:4, flex:1 }}>
              <select value={bdMonth} onChange={(e) => setBdMonth(e.target.value)} style={{ ...selectStyle, flex:1 }}>
                <option value="">월</option>
                {months.map(m => <option key={m} value={m}>{parseInt(m)}월</option>)}
              </select>
              <select value={bdDay} onChange={(e) => setBdDay(e.target.value)} style={{ ...selectStyle, flex:1 }}>
                <option value="">일</option>
                {days.map(d => <option key={d} value={d}>{parseInt(d)}일</option>)}
              </select>
            </div>
          ) : (
            <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              style={{ flex:1, padding:"6px 10px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--primary)", background:"var(--bg)", fontSize:13, outline:"none" }} />
          )}
          <button className="tap" onClick={handleSave} disabled={saving} style={{ padding:"5px 12px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {saving ? "…" : "저장"}
          </button>
          <button onClick={() => { setEditing(false); setEditVal(value); setBdMonth(value?.split("-")[0] || ""); setBdDay(value?.split("-")[1] || ""); }} style={{ background:"none", border:"none", color:"var(--text-2)", fontSize:16, cursor:"pointer" }}>✕</button>
        </div>
      ) : (
        <>
          <span style={{ fontSize:14, color: value ? "var(--text)" : "var(--text-3)", flex:1 }}>{displayValue}</span>
          {editable && (
            <button className="tap" onClick={() => { setEditVal(value); setEditing(true); }} style={{ background:"none", border:"none", color:"var(--text-3)", fontSize:14, cursor:"pointer", padding:"2px 6px" }}>✏️</button>
          )}
        </>
      )}
    </div>
  );
}

const FEEDBACK_CATS = [
  { id: "bug", label: "🐛 버그 신고" },
  { id: "feature", label: "✨ 기능 제안" },
  { id: "general", label: "💬 일반 문의" },
  { id: "other", label: "📝 기타" },
];

export default function ProfilePage() {
  const router = useRouter();
  const backGuardHandlerRef = useRef<(() => void) | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser>({ type: "none" });
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [isSimpleAccount, setIsSimpleAccount] = useState(false);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [migrateProvider, setMigrateProvider] = useState<string | null>(null);
  const [migrateReason, setMigrateReason] = useState<"conflict" | "switch">("switch");
  const [simpleCreatedAt, setSimpleCreatedAt] = useState<string>("");
  const [socialConflictInfo, setSocialConflictInfo] = useState<{
    display_name: string; profile_image?: string; created_at?: string; group_count: number;
  } | null>(null);
  const [conflictInfoLoading, setConflictInfoLoading] = useState(false);

  useEffect(() => {
    window.history.pushState({ backGuard: true }, '');
    const onPop = () => { router.replace('/'); };
    backGuardHandlerRef.current = onPop;
    window.addEventListener('popstate', onPop);
    init();
    // 게스트 → 로그인 전환 시 데이터 연동
    const guestToLink = sessionStorage.getItem("meogja_link_guest");
    if (guestToLink) {
      sessionStorage.removeItem("meogja_link_guest");
      getCurrentUser().then(async (u) => {
        if (u.type === "auth") {
          // 해당 guest_name의 멤버 기록을 새 계정으로 연결
          await getSupabase().from("members").update({ user_id: u.user.id }).eq("guest_name", guestToLink).is("user_id", null);
          // 게스트로 만든 모임 owner_id 연결
          await getSupabase().from("groups").update({ owner_id: u.user.id }).eq("owner_guest_name", guestToLink).is("owner_id", null);
        }
      });
    }
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  async function init() {
    const user = await getCurrentUser();
    setCurrentUser(user);
    if (user.type === "none") { router.replace("/login"); return; }
    // 아바타 설정 로드
    const { data: cfgData } = await getSupabase().from("avatar_config").select("id,purpose,object_position,cropped_url");
    if (cfgData) {
      const map: Record<string, {purpose:string;object_position:string;cropped_url?:string}> = {};
      cfgData.forEach((r: {id:string;purpose:string;object_position:string;cropped_url?:string}) => { map[r.id] = r; });
      setAvatarCfgs(map);
    }

    if (user.type === "auth") {
      // 간편가입 계정 여부 (pseudo email @meogja.app)
      const { data: { user: rawUser } } = await getSupabase().auth.getUser();
      setIsSimpleAccount(!!rawUser?.email?.endsWith("@meogja.app") || !!rawUser?.user_metadata?.simple_account);
      setSimpleCreatedAt(rawUser?.created_at || "");
      // 연결된 소셜 계정 로드
      const { data: identityData } = await getSupabase().auth.getUserIdentities();
      const providers = (identityData?.identities || []).map((i: { provider: string }) => i.provider);
      // admin.createUser로 만든 소셜 계정은 identity가 없으므로 user_metadata.provider로 보완
      const metaProvider = rawUser?.user_metadata?.provider;
      if (metaProvider && metaProvider !== "email" && !providers.includes(metaProvider)) {
        providers.push(metaProvider);
      }
      setLinkedProviders(providers);

      // 내가 만든 모임
      const { data: owned } = await getSupabase().from("groups").select("*").eq("owner_id", user.user.id).order("created_at", { ascending: false });
      if (owned) setMyGroups(owned);

      // 내가 참여한 모임 (멤버십)
      const { data: memberships } = await getSupabase()
        .from("group_memberships").select("group_id").eq("user_id", user.user.id);
      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map((m) => m.group_id);
        const { data: joined } = await getSupabase().from("groups").select("*").in("id", groupIds).order("created_at", { ascending: false });
        if (joined) setJoinedGroups(joined.filter((g) => g.owner_id !== user.user.id));
      }

      // 뱃지 체크 (백그라운드)
      const { data: { session } } = await getSupabase().auth.getSession();
      if (session?.access_token) {
        fetch("/api/badges/check", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } })
          .then(r => r.json())
          .then(data => {
            setEarnedBadges(data.allBadges || []);
            if (data.newBadges?.length > 0) setNewBadges(data.newBadges);
          })
          .catch(() => {});
      }
    }
    setLoading(false);
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  async function handleLinkSocial(provider: "google" | "kakao" | "naver") {
    if (currentUser.type !== "auth") return;

    // 소셜 연동 시작 전 back guard 해제 (OAuth redirect/history 조작이 홈으로 튕기는 현상 방지)
    if (backGuardHandlerRef.current) {
      window.removeEventListener('popstate', backGuardHandlerRef.current);
      backGuardHandlerRef.current = null;
    }

    // Naver: Supabase 네이티브 미지원 → 확인 후 migrate flow 사용
    if (provider === "naver") {
      const ok = await showConfirm(
        "네이버 계정으로 연동하면 현재 계정 데이터가 네이버 계정으로 이전됩니다.\n연동 후에는 네이버로만 로그인 가능해요. (간편계정 아이디/비밀번호 사용 불가)\n\n이미 다른 meogja 계정에 연결된 네이버면 연동이 차단돼요.",
        { title: "네이버 계정 연동", confirmLabel: "연동하기" }
      );
      if (!ok) return;
      localStorage.setItem("meogja_migrate_from", currentUser.user.id);
      localStorage.setItem("meogja_migrate_keep_source", "true");
      // signOut 불필요: Naver callback의 magic link가 세션을 교체함
      // signOut 후 conflict 감지되면 로그아웃 상태로 /profile로 돌아오는 버그 방지
      window.location.href = `/api/auth/naver?next=/profile&mode=migrate`;
      return;
    }

    // Google: 확인 다이얼로그 후 linkIdentity
    const okGoogle = await showConfirm(
      "Google 계정으로 연동하면 현재 계정 데이터가 Google 계정으로 이전됩니다.\n연동 후에는 Google로만 로그인 가능해요. (간편계정 아이디/비밀번호 사용 불가)",
      { title: "Google 계정 연동", confirmLabel: "연동하기" }
    );
    if (!okGoogle) return;

    setLinkingProvider(provider);
    localStorage.setItem("meogja_link_from", currentUser.user.id);
    localStorage.setItem("meogja_link_provider", provider);
    const redirectTo = `${window.location.origin}/auth/callback?mode=link`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getSupabase().auth as any).linkIdentity({ provider, options: { redirectTo, queryParams: { prompt: "select_account" } } });
    if (error) {
      localStorage.removeItem("meogja_link_from");
      localStorage.removeItem("meogja_link_provider");
      if (error.message?.includes("already") || error.code === "identity_already_exists") {
        await showAlert("이 Google 계정은 이미 다른 meogja 계정에 연결되어 있어요.\n연결을 원하면 해당 계정으로 로그인 후 이용해주세요.", { icon: "⚠️", title: "이미 사용 중인 계정" });
      } else {
        toast("연결에 실패했어요: " + (error.message || "알 수 없는 오류"));
      }
    }
    setLinkingProvider(null);
  }

  async function handleMigrateToSocial(keepSourceProfile: boolean) {
    if (currentUser.type !== "auth" || !migrateProvider) return;
    localStorage.setItem("meogja_migrate_from", currentUser.user.id);
    localStorage.setItem("meogja_migrate_keep_source", keepSourceProfile ? "true" : "false");
    await signOut();
    const redirectTo = `${window.location.origin}/auth/callback?mode=migrate`;
    if (migrateProvider === "google") {
      await getSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    } else if (migrateProvider === "naver") {
      window.location.href = `/api/auth/naver?next=/profile&mode=migrate`;
    }
  }

  async function leaveGroup(groupId: string) {
    if (currentUser.type !== "auth") return;
    await getSupabase().from("group_memberships").delete().eq("group_id", groupId).eq("user_id", currentUser.user.id);
    setJoinedGroups((prev) => prev.filter((g) => g.id !== groupId));
  }

  const [refreshingSocial, setRefreshingSocial] = useState(false);

  async function refreshSocialProfile() {
    if (currentUser.type !== "auth") return;
    setRefreshingSocial(true);
    const { data: { user: rawUser } } = await getSupabase().auth.getUser();
    const meta = rawUser?.user_metadata || {};

    // identity_data도 병합 (provider별 추가 필드)
    const { data: identData } = await getSupabase().auth.getUserIdentities();
    const identMeta = identData?.identities?.[0]?.identity_data || {};

    const merged = { ...identMeta, ...meta }; // user_metadata 우선

    const avatarUrl: string | null =
      merged.avatar_url || merged.picture || merged.profile_image_url ||
      merged.thumbnail_image_url || merged.profile?.thumbnail_image_url || null;

    const fullName: string | null =
      merged.full_name || merged.name || merged.nickname ||
      merged.profile?.nickname || null;

    const rawEmail = rawUser?.email || merged.email || null;
    const realEmail = rawEmail && !rawEmail.endsWith("@meogja.app") ? rawEmail : null;
    const originalEmail = meta?.original_email && !String(meta.original_email).endsWith("@meogja.app") ? String(meta.original_email) : null;
    const email: string | null = realEmail || originalEmail || null;
    const mobile: string | null = merged.phone_number || merged.mobile || null;

    const update: Record<string, string> = {};
    if (avatarUrl) update.profile_image = avatarUrl;
    if (fullName) { update.display_name = fullName; update.name = fullName; }
    if (email) update.email = email;
    if (mobile) update.mobile = mobile;

    if (Object.keys(update).length > 0) {
      const { error } = await getSupabase().from("user_profiles").upsert(
        { id: currentUser.user.id, ...update }, { onConflict: "id" }
      );
      if (!error) {
        setMyProfile(prev => ({ ...prev, ...update }));
        window.dispatchEvent(new CustomEvent("meogja-auth-change"));
        toast("소셜 프로필 정보를 불러왔어요!");
      }
    } else {
      toast("불러올 소셜 정보가 없습니다");
    }
    setRefreshingSocial(false);
  }

  const displayName = currentUser.type === "auth" ? currentUser.user.display_name : currentUser.type === "guest" ? currentUser.user.name : "";
  const [myProfile, setMyProfile] = useState<Record<string,string>>({});
  const [earnedBadges, setEarnedBadges] = useState<{badge_id:string;earned_at:string}[]>([]);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [showBadgeSelect, setShowBadgeSelect] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState<Record<string, string>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [myReports, setMyReports] = useState<{id:string;target_type:string;target_name:string;reason:string;status:string;created_at:string}[]>([]);
  const [showReports, setShowReports] = useState(false);

  const [showAllAvatars, setShowAllAvatars] = useState(false);
  const [avatarCfgs, setAvatarCfgs] = useState<Record<string, {purpose:string;object_position:string;cropped_url?:string}>>({});
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  async function selectDefaultAvatar(url: string) {
    if (currentUser.type !== "auth") return;
    const { error } = await getSupabase().from("user_profiles").update({ profile_image: url }).eq("id", currentUser.user.id);
    if (!error) {
      setMyProfile((prev) => ({ ...prev, profile_image: url }));
      window.dispatchEvent(new CustomEvent("meogja-auth-change"));
    }
  }

  async function applyProfileImage(dataUrl: string) {
    if (currentUser.type !== "auth") return;
    const { error } = await getSupabase().from("user_profiles").upsert({ id: currentUser.user.id, profile_image: dataUrl });
    if (!error) {
      setMyProfile((prev) => ({ ...prev, profile_image: dataUrl }));
      window.dispatchEvent(new CustomEvent("meogja-auth-change"));
    }
    setCropSrc(null);
    setUploadingPhoto(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || currentUser.type !== "auth") return;
    if (file.size > 5 * 1024 * 1024) { await showAlert("5MB 이하 이미지만 가능합니다", { icon: "🖼️" }); return; }
    // 크롭 모달로 넘김
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    e.target.value = ""; // reset input
  }
  const [myPrefs, setMyPrefs] = useState<{id:string;food_name:string;preference_type:string}[]>([]);
  const [myFoodScores, setMyFoodScores] = useState<{food_name:string;score:number}[]>([]);
  const [prefInput, setPrefInput] = useState("");
  const [prefType, setPrefType] = useState<"like"|"dislike">("like");
  const [prefLarge, setPrefLarge] = useState("");
  const [prefMedium, setPrefMedium] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeId>("cozy");

  useEffect(() => { setCurrentTheme(getSavedTheme()); }, []);

  useEffect(() => {
    if (!showMigrateModal || migrateReason !== "conflict" || !migrateProvider) return;
    setSocialConflictInfo(null);
    setConflictInfoLoading(true);
    (async () => {
      const { data: { session } } = await getSupabase().auth.getSession();
      const token = session?.access_token;
      if (!token) { setConflictInfoLoading(false); return; }
      const res = await fetch(`/api/auth/find-social-account?provider=${migrateProvider}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.found) setSocialConflictInfo(data);
      setConflictInfoLoading(false);
    })();
  }, [showMigrateModal, migrateReason, migrateProvider]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    if (params.get("link_success") === "1") {
      toast("소셜 계정이 연결됐어요!");
      window.history.replaceState({}, "", "/profile");
    } else if (params.get("migrated") === "1") {
      toast("계정 이전 완료! 소셜 계정으로 로그인됩니다.");
      window.history.replaceState({}, "", "/profile");
    } else if (params.get("link_conflict") === "1") {
      window.history.replaceState({}, "", "/profile");
      toast("이 Google 계정은 이미 다른 meogja 계정에 연결되어 있어요.", "⚠️");
    } else if (params.get("naver_conflict") === "1") {
      window.history.replaceState({}, "", "/profile");
      showAlert(
        "이 네이버 계정은 이미 다른 meogja 계정에 연결되어 있어요.\n다른 네이버 계정으로 연동하려면 네이버에서 먼저 로그아웃 후 다시 시도해주세요.",
        { icon: "⚠️", title: "이미 사용 중인 계정" }
      );
    } else if (params.get("link_error")) {
      const errMsg = params.get("link_error") || "";
      window.history.replaceState({}, "", "/profile");
      const isCancelled = errMsg.toLowerCase().includes("access_denied");
      if (!isCancelled) {
        toast("Google 연동 실패: " + (errMsg || "다시 시도해주세요"), "⚠️");
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser.type === "auth") {
      // 프로필 정보 로드
      getSupabase().from("user_profiles").select("*").eq("id", currentUser.user.id).single().then(async ({ data }) => {
        if (data) {
          setMyProfile(data);
          // 이전에 저장된 가짜 이메일(naver_xxx@meogja.app) 자동 복구
          if (data.email?.endsWith("@meogja.app")) {
            const { data: { user: rawUser } } = await getSupabase().auth.getUser();
            const originalEmail = rawUser?.user_metadata?.original_email;
            if (originalEmail && !String(originalEmail).endsWith("@meogja.app")) {
              await getSupabase().from("user_profiles").update({ email: originalEmail }).eq("id", currentUser.user.id);
              setMyProfile(prev => ({ ...prev, email: originalEmail }));
            } else {
              await getSupabase().from("user_profiles").update({ email: null }).eq("id", currentUser.user.id);
              setMyProfile(prev => ({ ...prev, email: "" }));
            }
          }
        }
      });
      getSupabase().from("user_food_preferences").select("*").eq("user_id", currentUser.user.id).order("preference_type").then(({ data }) => {
        if (data) setMyPrefs(data);
      });
      getSupabase().from("user_food_scores").select("food_name,score").eq("user_id", currentUser.user.id).order("score", { ascending: false }).limit(15).then(({ data }) => {
        if (data) setMyFoodScores(data);
      });
      // 신고 내역
      getSupabase().from("reports").select("id,target_type,target_name,reason,status,created_at").eq("reporter_user_id", currentUser.user.id).order("created_at", { ascending: false }).then(({ data }) => {
        if (data) setMyReports(data);
      });
    }
  }, [currentUser]);

  async function addMyPref(foodName?: string) {
    const name = (foodName || prefInput).trim();
    if (!name || currentUser.type !== "auth") return;
    const existing = myPrefs.find((p) => p.food_name === name && p.preference_type === prefType);
    if (existing) {
      await removeMyPref(existing.id);
      return;
    }
    // 반대 타입 있으면 먼저 제거
    const opposite = myPrefs.find((p) => p.food_name === name && p.preference_type !== prefType);
    if (opposite) await removeMyPref(opposite.id);
    // 카테고리면 하위 항목 반대타입 제거
    const subItems = getCategorySubItems(name);
    if (subItems.length > 0) {
      const oppType = prefType === "like" ? "dislike" : "like";
      const toRemove = myPrefs.filter((p) => (p.food_name === name || subItems.includes(p.food_name)) && p.preference_type === oppType);
      for (const r of toRemove) await removeMyPref(r.id);
    }
    const { data } = await getSupabase().from("user_food_preferences").insert({ user_id: currentUser.user.id, food_name: name, preference_type: prefType }).select().single();
    if (data) setMyPrefs((prev) => prev.filter((p) => !(p.food_name === name && p.preference_type !== prefType) && !(subItems.includes(p.food_name) && p.preference_type !== prefType)).concat(data));
    if (!foodName) setPrefInput("");
  }

  async function removeMyPref(id: string) {
    await getSupabase().from("user_food_preferences").delete().eq("id", id);
    setMyPrefs((prev) => prev.filter((p) => p.id !== id));
  }

  const [fbCat, setFbCat] = useState("general");
  const [fbContent, setFbContent] = useState("");
  const [fbEmail, setFbEmail] = useState("");
  const [fbSent, setFbSent] = useState(false);

  const pushUserId = currentUser.type === "auth" ? currentUser.user.id : null;
  const { permission, subscribed, subscribe, unsubscribe } = usePushSubscription(pushUserId);
  const [notifSupported, setNotifSupported] = useState(false);
  useEffect(() => { setNotifSupported(typeof window !== "undefined" && "Notification" in window); }, []);
  const [fbSending, setFbSending] = useState(false);

  async function submitFeedback(e: FormEvent) {
    e.preventDefault();
    if (!fbContent.trim()) return;
    setFbSending(true);
    await getSupabase().from("feedbacks").insert({
      user_id: currentUser.type === "auth" ? currentUser.user.id : null,
      guest_name: currentUser.type === "guest" ? currentUser.user.name : null,
      email: fbEmail.trim() || (currentUser.type === "auth" ? currentUser.user.email : null),
      category: fbCat,
      content: fbContent.trim(),
    });
    setFbSent(true);
    setFbSending(false);
    setFbContent("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          title="프로필 사진 조정"
          onClose={() => { setCropSrc(null); setUploadingPhoto(false); }}
          onSave={(dataUrl) => applyProfileImage(dataUrl)}
        />
      )}
      {/* 프로필 헤더 */}
      <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, minWidth:0 }}>
          {/* 프로필 사진 (업로드 가능) */}
          {currentUser.type === "auth" && (
            <label className="tap" style={{ position:"relative", cursor:"pointer", flexShrink:0 }}>
              <div style={{ width:56, height:56, borderRadius:"50%", overflow:"hidden", border:"2px solid var(--border)", background:"var(--bg-2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {myProfile.profile_image
                  ? <img src={myProfile.profile_image} alt="profile" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <span style={{ fontSize:24, color:"var(--text-3)" }}>👤</span>}
              </div>
              <div style={{ position:"absolute", bottom:0, right:0, width:18, height:18, borderRadius:"50%", background:"var(--primary)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10 }}>
                {uploadingPhoto ? "…" : "📷"}
              </div>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display:"none" }} />
            </label>
          )}
          <div style={{ minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:2 }}>
              <h1 style={{ fontFamily:"var(--font-display)", fontSize:22, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {displayName || "사용자"}
              </h1>
              {myProfile.active_badge_id && BADGE_MAP[myProfile.active_badge_id] && (() => {
                const b = BADGE_MAP[myProfile.active_badge_id];
                return (
                  <span style={{ fontSize:12, fontWeight:700, color:RARITY_COLOR[b.rarity], background:"var(--bg-2)", border:"1.5px solid var(--border)", borderRadius:"var(--r-pill)", padding:"2px 8px", display:"flex", alignItems:"center", gap:3, whiteSpace:"nowrap" }}>
                    {b.emoji} {b.name}
                  </span>
                );
              })()}
            </div>
            <p style={{ fontSize:12, color:"var(--text-2)" }}>
              {currentUser.type === "auth"
                ? ((myProfile.email && !myProfile.email.endsWith("@meogja.app") ? myProfile.email : null) || (!currentUser.user.email?.endsWith("@meogja.app") ? currentUser.user.email : null) || "네이버 로그인")
                : "게스트 이용 중"}
            </p>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
          {currentUser.type === "auth" && (
            <button className="tap" onClick={() => router.push("/messages")} style={{ padding:"7px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:12, fontWeight:500, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
              💌 쪽지함
            </button>
          )}
          {notifSupported && permission !== "denied" && (
            <button className="tap" onClick={async () => {
              if (subscribed) { await unsubscribe(); toast("🔕 알림을 껐어요"); }
              else { const ok = await subscribe(); if (ok) toast("🔔 알림을 켰어요!"); else toast("알림 권한을 허용해주세요"); }
            }} style={{ padding:"7px 14px", borderRadius:"var(--r-pill)", border:`1.5px solid ${subscribed ? "var(--primary)" : "var(--border)"}`, background: subscribed ? "var(--primary-light)" : "transparent", color: subscribed ? "var(--primary)" : "var(--text-2)", fontSize:12, fontWeight:500, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
              {subscribed ? "🔔 알림 켜짐" : "🔕 알림 받기"}
            </button>
          )}
          <button onClick={handleSignOut} style={{ padding:"7px 16px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:12, fontWeight:500, cursor:"pointer", flexShrink:0 }}>
            {currentUser.type === "auth" ? "로그아웃" : "나가기"}
          </button>
        </div>
      </div>

      {/* 게스트 → 로그인 전환 안내 */}
      {currentUser.type === "guest" && (
        <div className="fade-up" style={{ padding: "18px 16px", borderRadius: 20, background: "var(--primary-light)", border: "1.5px solid var(--primary)" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--primary)", marginBottom: 8 }}>🔑 로그인하면 정보가 저장돼요</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
            {["❤️ 선호/비선호 음식 저장", "👥 참여 모임 유지", "📋 추천 히스토리", "👤 프로필 사진 설정"].map((t) => (
              <p key={t} style={{ fontSize: 13, color: "var(--text-2)" }}>{t}</p>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>현재 게스트({currentUser.user.name})로 이용 중 — 데이터가 저장되지 않습니다</p>
          <button className="tap tap-primary" onClick={() => {
            // 현재 게스트 이름을 세션에 저장하여 로그인 후 데이터 연동
            sessionStorage.setItem("meogja_link_guest", currentUser.user.name);
            router.replace("/login?next=/profile");
          }} style={{
            width: "100%", padding: "12px", borderRadius: "var(--r-pill)", border: "none",
            background: "var(--primary)", color: "#fff",
            fontFamily: "var(--font-display)", fontSize: 15, cursor: "pointer",
            boxShadow: "0 6px 16px rgba(255,122,69,.25)",
          }}>
            로그인하고 데이터 저장하기 →
          </button>
        </div>
      )}

      {/* 🏅 뱃지 */}
      {currentUser.type === "auth" && earnedBadges.length > 0 && (() => {
        const earnedSet = new Set(earnedBadges.map(b => b.badge_id));
        const activeBadge = myProfile.active_badge_id ? BADGE_MAP[myProfile.active_badge_id] : null;

        async function setActiveBadge(badgeId: string | null) {
          if (currentUser.type !== "auth") return;
          const newId = badgeId === myProfile.active_badge_id ? null : badgeId;
          const { error } = await getSupabase().from("user_profiles").update({ active_badge_id: newId }).eq("id", currentUser.user.id);
          if (!error) {
            setMyProfile(prev => ({ ...prev, active_badge_id: newId || "" }));
            toast(newId ? `${BADGE_MAP[newId]?.name} 뱃지를 대표로 설정했어요!` : "대표 뱃지를 해제했어요");
          }
          setShowBadgeSelect(false);
        }

        return (
          <div className="fade-up" style={{ background:"var(--surface)", borderRadius:16, padding:"16px", border:"var(--card-border)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <span style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>🏅 내 뱃지 ({earnedSet.size}/{BADGES.length})</span>
              <button onClick={() => setShowBadgeSelect(v => !v)} style={{ fontSize:12, color:"var(--primary)", background:"none", border:"none", cursor:"pointer" }}>
                {showBadgeSelect ? "접기 ↑" : "대표 뱃지 설정 ↓"}
              </button>
            </div>

            {/* 현재 대표 뱃지 */}
            {activeBadge && !showBadgeSelect && (
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:12, background:"var(--bg-2)", border:`1.5px solid ${RARITY_COLOR[activeBadge.rarity]}` }}>
                <span style={{ fontSize:22 }}>{activeBadge.emoji}</span>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:RARITY_COLOR[activeBadge.rarity] }}>{activeBadge.name}</p>
                  <p style={{ fontSize:11, color:"var(--text-3)" }}>{activeBadge.desc}</p>
                </div>
                <span style={{ marginLeft:"auto", fontSize:11, color:"var(--text-3)" }}>대표</span>
              </div>
            )}

            {/* 뱃지 선택 그리드 */}
            {showBadgeSelect && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8 }}>
                {BADGES.map(badge => {
                  const has = earnedSet.has(badge.id);
                  const isActive = myProfile.active_badge_id === badge.id;
                  return (
                    <button key={badge.id} onClick={() => has && setActiveBadge(badge.id)} disabled={!has} style={{
                      display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"10px 4px",
                      borderRadius:14, border: isActive ? `2px solid ${RARITY_COLOR[badge.rarity]}` : "1.5px solid var(--border)",
                      background: isActive ? "var(--primary-light)" : has ? "var(--surface)" : "var(--bg-2)",
                      opacity: has ? 1 : 0.35, cursor: has ? "pointer" : "default",
                    }}>
                      <span style={{ fontSize:24, filter: has ? "none" : "grayscale(1)" }}>{badge.emoji}</span>
                      <span style={{ fontSize:10, fontWeight:700, color: isActive ? RARITY_COLOR[badge.rarity] : "var(--text)", textAlign:"center", lineHeight:1.2 }}>{badge.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 신규 획득 알림 */}
            {newBadges.length > 0 && (
              <div style={{ marginTop:10, padding:"10px 14px", borderRadius:12, background:"var(--green-soft)", border:"1.5px solid var(--green)", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:20 }}>🎉</span>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, fontWeight:700, color:"var(--green)" }}>새 뱃지 획득!</p>
                  <p style={{ fontSize:12, color:"var(--text-2)" }}>{newBadges.map(id => BADGE_MAP[id]?.name).filter(Boolean).join(", ")}</p>
                </div>
                <button onClick={() => setNewBadges([])} style={{ background:"none", border:"none", color:"var(--text-3)", fontSize:16, cursor:"pointer" }}>✕</button>
              </div>
            )}
          </div>
        );
      })()}

      {/* 먹자냥 아바타 선택 */}
      {currentUser.type === "auth" && (() => {
        const visibleAvatars = ALL_AVATARS.filter((url, i) => {
          const id = `cat-${String(i+1).padStart(2,"0")}`;
          const cfg = avatarCfgs[id];
          // 설정 없으면 기본 표시, avatar 용도인 것만 선택 가능
          return !cfg || cfg.purpose === "avatar";
        });
        const displayAvatars = showAllAvatars ? visibleAvatars : visibleAvatars.slice(0, 5);
        return (
          <div className="fade-up" style={{ background:"var(--surface)", borderRadius:16, padding:"16px", border:"var(--card-border)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: showAllAvatars ? 12 : 8 }}>
              <span style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>먹자냥 아바타</span>
              <button onClick={() => setShowAllAvatars(v => !v)} style={{ fontSize:12, color:"var(--primary)", background:"none", border:"none", cursor:"pointer" }}>
                {showAllAvatars ? "접기 ↑" : `전체보기 (${visibleAvatars.length}개) ↓`}
              </button>
            </div>
            <div style={{ display:"flex", flexWrap: showAllAvatars ? "wrap" : "nowrap", gap:8, overflow: showAllAvatars ? "visible" : "hidden" }}>
              {displayAvatars.map((url) => {
                const idx = ALL_AVATARS.indexOf(url);
                const id = `cat-${String(idx+1).padStart(2,"0")}`;
                const cfg = avatarCfgs[id];
                return (
                  <button key={url} className="tap" onClick={() => selectDefaultAvatar(cfg?.cropped_url || url)} style={{
                    width:52, height:52, borderRadius:"50%", overflow:"hidden", padding:0, flexShrink:0,
                    border: (myProfile.profile_image === url || myProfile.profile_image === cfg?.cropped_url) ? "3px solid var(--primary)" : "2px solid transparent",
                    cursor:"pointer", background:"var(--bg-2)",
                    boxShadow: (myProfile.profile_image === url || myProfile.profile_image === cfg?.cropped_url) ? "0 0 0 2px var(--primary)" : "none",
                  }}>
                    <img src={cfg?.cropped_url || url} alt="avatar" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  </button>
                );
              })}
              {!showAllAvatars && visibleAvatars.length > 5 && (
                <button onClick={() => setShowAllAvatars(true)} style={{
                  width:52, height:52, borderRadius:"50%", flexShrink:0,
                  border:"1.5px dashed var(--border)", background:"var(--bg-2)",
                  color:"var(--text-3)", fontSize:11, fontWeight:700, cursor:"pointer",
                }}>+{visibleAvatars.length - 5}</button>
              )}
            </div>
          </div>
        );
      })()}

      {/* 👤 내 정보 — 일괄 수정 */}
      {currentUser.type === "auth" && (() => {
        const BIRTHYEAR_OPTIONS = Array.from({ length: 2010 - 1940 + 1 }, (_, i) => String(2010 - i));
        const GENDER_OPTIONS = ["남성","여성","기타","비공개"];
        const AGE_OPTIONS = ["10대","20대","30대","40대","50대","60대 이상"];
        const MBTI_OPTIONS = ["INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP","ISTJ","ISFJ","ESTJ","ESFJ","ISTP","ISFP","ESTP","ESFP"];
        const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
        const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

        function formatMobile(value: string) {
          const digits = value.replace(/\D/g, "").slice(0, 11);
          if (digits.length <= 3) return digits;
          if (digits.length <= 7) return `${digits.slice(0,3)}-${digits.slice(3)}`;
          return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
        }

        function enterEditMode() {
          setProfileEditForm({
            nickname: myProfile.nickname || "",
            name: myProfile.name || "",
            email: (myProfile.email?.endsWith("@meogja.app") ? "" : myProfile.email) || "",
            gender: myProfile.gender || "",
            birthday_month: myProfile.birthday?.split("-")[0] || "",
            birthday_day: myProfile.birthday?.split("-")[1] || "",
            birthyear: myProfile.birthyear || "",
            age: myProfile.age || "",
            mbti: myProfile.mbti || "",
            mobile: myProfile.mobile || "",
          });
          setProfileEditMode(true);
        }

        async function saveAllFields() {
          if (currentUser.type !== "auth") return;
          setProfileSaving(true);

          if (profileEditForm.nickname) {
            const trimmed = profileEditForm.nickname.trim();
            if (trimmed && trimmed !== (myProfile.nickname || "")) {
              const { data: dupe } = await getSupabase().from("user_profiles").select("id").eq("nickname", trimmed).neq("id", currentUser.user.id).single();
              if (dupe) {
                await showAlert(`"${trimmed}" 닉네임은 이미 사용 중입니다.`, { icon: "👤", title: "닉네임 중복" });
                setProfileSaving(false);
                return;
              }
            }
          }

          const update: Record<string, string> = {};
          for (const key of ["nickname","name","email","gender","birthyear","age","mbti"] as const) {
            const val = (profileEditForm[key] || "").trim();
            if (val !== (myProfile[key] || "")) update[key] = val;
          }
          const mobile = profileEditForm.mobile || "";
          if (mobile !== (myProfile.mobile || "")) update.mobile = mobile;
          const bm = profileEditForm.birthday_month, bd = profileEditForm.birthday_day;
          const birthday = bm && bd ? `${bm}-${bd}` : "";
          if (birthday !== (myProfile.birthday || "")) update.birthday = birthday;
          if (update.nickname !== undefined) update.display_name = update.nickname;
          if (update.birthyear) {
            const year = parseInt(update.birthyear);
            if (!isNaN(year)) {
              const ageNum = new Date().getFullYear() - year;
              const decade = Math.floor(ageNum / 10) * 10;
              update.age = decade >= 60 ? "60대 이상" : `${Math.max(10, Math.min(decade, 50))}대`;
              setProfileEditForm(prev => ({ ...prev, age: update.age }));
            }
          }

          if (Object.keys(update).length > 0) {
            const { error } = await getSupabase().from("user_profiles").upsert({ id: currentUser.user.id, ...update }, { onConflict: "id" });
            if (error) { await showAlert("저장에 실패했습니다.\n" + error.message, { icon: "⚠️" }); setProfileSaving(false); return; }
            setMyProfile(prev => ({ ...prev, ...update }));
            window.dispatchEvent(new CustomEvent("meogja-auth-change"));
            toast("저장됐어요!");
          }
          setProfileSaving(false);
          setProfileEditMode(false);
        }

        const birthdayDisplay = (() => {
          if (!myProfile.birthday) return "";
          const [m, d] = myProfile.birthday.split("-");
          return m && d ? `${parseInt(m)}월 ${parseInt(d)}일` : myProfile.birthday;
        })();

        const rowStyle: React.CSSProperties = { display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:"1px solid var(--border)", gap:8 };
        const labelStyle: React.CSSProperties = { fontSize:12, color:"var(--text-2)", width:82, flexShrink:0, fontWeight:600 };
        const inputStyle: React.CSSProperties = { flex:1, padding:"7px 10px", borderRadius:"var(--r-sm)", border:"1.5px solid var(--border)", background:"var(--bg)", fontSize:13, outline:"none", color:"var(--text)" };
        const selectStyle2: React.CSSProperties = { ...inputStyle, cursor:"pointer" };

        return (
          <div className="fade-up">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                {myProfile.profile_image && (
                  <img src={myProfile.profile_image} alt="프로필" style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover", border:"2px solid var(--border)" }} />
                )}
                <p style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>👤 내 정보</p>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                {linkedProviders.filter(p => p !== "email").length > 0 && !profileEditMode && (
                  <button className="tap" onClick={async () => {
                    const ok = await showConfirm("소셜 계정의 최신 정보로 초기화합니다.\n현재 닉네임·프로필 사진 등이 덮어써집니다.", { title:"정보 초기화", confirmLabel:"초기화", danger:true });
                    if (ok) refreshSocialProfile();
                  }} disabled={refreshingSocial} style={{ padding:"5px 12px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--surface)", color:"var(--text-2)", fontSize:11, fontWeight:600, cursor: refreshingSocial ? "default" : "pointer", opacity: refreshingSocial ? 0.6 : 1, display:"flex", alignItems:"center", gap:4 }}>
                    {refreshingSocial ? "불러오는 중…" : <><img src="/mascot/tabs/refresh.png" style={{width:14,height:14,objectFit:"contain",marginRight:3}}/>정보 초기화</>}
                  </button>
                )}
                {!profileEditMode && (
                  <button className="tap" onClick={enterEditMode} style={{ padding:"5px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--primary)", background:"transparent", color:"var(--primary)", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                    수정하기
                  </button>
                )}
              </div>
            </div>

            {!profileEditMode ? (
              <div style={{ background:"var(--surface)", borderRadius:16, border:"var(--card-border)", boxShadow:"var(--card-shadow)", overflow:"hidden" }}>
                {[
                  { label:"닉네임", value: myProfile.nickname },
                  { label:"이름", value: myProfile.name },
                  { label:"이메일", value: myProfile.email?.endsWith("@meogja.app") ? null : myProfile.email },
                  { label:"성별", value: myProfile.gender },
                  { label:"생일", value: birthdayDisplay },
                  { label:"출생연도", value: myProfile.birthyear },
                  { label:"연령대", value: myProfile.age },
                  { label:"MBTI", value: myProfile.mbti },
                  { label:"휴대전화", value: myProfile.mobile },
                ].map((f, i, arr) => (
                  <div key={f.label} style={{ ...rowStyle, borderBottom: i < arr.length-1 ? "1px solid var(--border)" : "none" }}>
                    <span style={labelStyle}>{f.label}</span>
                    <span style={{ fontSize:14, color: f.value ? "var(--text)" : "var(--text-3)", flex:1 }}>{f.value || "미설정"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background:"var(--surface)", borderRadius:16, border:"1.5px solid var(--primary)", boxShadow:"var(--card-shadow)", overflow:"hidden" }}>
                <div style={rowStyle}>
                  <span style={labelStyle}>닉네임</span>
                  <input value={profileEditForm.nickname || ""} onChange={e => setProfileEditForm(prev => ({ ...prev, nickname: e.target.value }))} placeholder="닉네임" style={inputStyle} />
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>이름</span>
                  <input value={profileEditForm.name || ""} onChange={e => setProfileEditForm(prev => ({ ...prev, name: e.target.value }))} placeholder="이름" style={inputStyle} />
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>이메일</span>
                  <input type="email" value={profileEditForm.email || ""} onChange={e => setProfileEditForm(prev => ({ ...prev, email: e.target.value }))} placeholder="이메일" style={inputStyle} />
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>성별</span>
                  <select value={profileEditForm.gender || ""} onChange={e => setProfileEditForm(prev => ({ ...prev, gender: e.target.value }))} style={selectStyle2}>
                    <option value="">선택</option>
                    {GENDER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>생일</span>
                  <div style={{ display:"flex", gap:6, flex:1 }}>
                    <select value={profileEditForm.birthday_month || ""} onChange={e => setProfileEditForm(prev => ({ ...prev, birthday_month: e.target.value }))} style={{ ...selectStyle2, flex:1 }}>
                      <option value="">월</option>
                      {months.map(m => <option key={m} value={m}>{parseInt(m)}월</option>)}
                    </select>
                    <select value={profileEditForm.birthday_day || ""} onChange={e => setProfileEditForm(prev => ({ ...prev, birthday_day: e.target.value }))} style={{ ...selectStyle2, flex:1 }}>
                      <option value="">일</option>
                      {days.map(d => <option key={d} value={d}>{parseInt(d)}일</option>)}
                    </select>
                  </div>
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>출생연도</span>
                  <select value={profileEditForm.birthyear || ""} onChange={e => setProfileEditForm(prev => ({ ...prev, birthyear: e.target.value }))} style={selectStyle2}>
                    <option value="">선택</option>
                    {BIRTHYEAR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>연령대</span>
                  <select value={profileEditForm.age || ""} onChange={e => setProfileEditForm(prev => ({ ...prev, age: e.target.value }))} style={selectStyle2}>
                    <option value="">선택</option>
                    {AGE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>MBTI</span>
                  <select value={profileEditForm.mbti || ""} onChange={e => setProfileEditForm(prev => ({ ...prev, mbti: e.target.value }))} style={selectStyle2}>
                    <option value="">선택</option>
                    {MBTI_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div style={{ ...rowStyle, borderBottom:"none" }}>
                  <span style={labelStyle}>휴대전화</span>
                  <input type="tel" value={profileEditForm.mobile || ""} onChange={e => setProfileEditForm(prev => ({ ...prev, mobile: formatMobile(e.target.value) }))} placeholder="010-0000-0000" maxLength={13} style={inputStyle} />
                </div>
                <div style={{ display:"flex", gap:8, padding:"12px 16px", borderTop:"1.5px solid var(--border)" }}>
                  <button className="tap" onClick={() => setProfileEditMode(false)} style={{ flex:1, padding:"11px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:13, cursor:"pointer" }}>
                    취소
                  </button>
                  <button className="tap" onClick={saveAllFields} disabled={profileSaving} style={{ flex:2, padding:"11px", borderRadius:"var(--r-pill)", border:"none", background: profileSaving ? "var(--border)" : "var(--primary)", color: profileSaving ? "var(--text-2)" : "#fff", fontFamily:"var(--font-display)", fontSize:14, fontWeight:700, cursor: profileSaving ? "default" : "pointer" }}>
                    {profileSaving ? "저장 중…" : "저장하기"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 🎨 색상 테마 */}
      <div className="fade-up">
        <p style={{ fontFamily: "var(--font-display)", fontSize: 17, marginBottom: 12 }}>🎨 색상 테마</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][]).map(([id, t]) => (
            <button key={id} className="tap" onClick={() => { applyTheme(id); setCurrentTheme(id); }} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: "var(--r-pill)",
              border: currentTheme === id ? `2px solid ${t.preview}` : "1.5px solid var(--border)",
              background: currentTheme === id ? t.vars["--bg-2"] : "var(--surface)",
              color: "var(--text)", fontSize: 13, fontWeight: currentTheme === id ? 700 : 400, cursor: "pointer",
              transition: "all .15s",
            }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: t.preview, flexShrink: 0 }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!loading && currentUser.type === "auth" && (
        <>
          {/* 내가 만든 모임 */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>내가 만든 모임</p>
            {myGroups.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>아직 만든 모임이 없습니다</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myGroups.map((g) => (
                  <button key={g.id} onClick={() => router.push(`/groups/${g.id}`)} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 18px", borderRadius: 14, background: "var(--bg-card)",
                    border: "1px solid var(--border)", boxShadow: "var(--shadow)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{g.is_private ? "🔒" : "🌐"}</span>
                      <div>
                        <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{g.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.require_auth ? "인증 전용" : "누구나 참여"}</p>
                      </div>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: 16 }}>→</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 참여 중인 모임 */}
          {joinedGroups.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>참여 중인 모임</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {joinedGroups.map((g) => (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
                    <button onClick={() => router.push(`/groups/${g.id}`)} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: 18 }}>{g.is_private ? "🔒" : "🌐"}</span>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{g.name}</p>
                    </button>
                    <button onClick={() => leaveGroup(g.id)} style={{ padding: "5px 12px", borderRadius: 100, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>
                      나가기
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 내 기본 선호도 — 로그인 사용자만 */}
      {currentUser.type === "auth" && (() => {
        const largeCats = getAllLargeCategories();
        const medCats = prefLarge ? getMediumCategories(prefLarge) : [];
        const menuItems = prefLarge && prefMedium ? getMenuItems(prefLarge, prefMedium) : [];
        return (
          <div className="fade-up">
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <img src="/mascot/tabs/settings.png" alt="" style={{ width:28, height:28, objectFit:"contain" }} />
              <p style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>내 기본 선호도</p>
            </div>
            <div style={{ background: "var(--surface)", borderRadius: 16, padding: "18px 16px", border: "var(--card-border)", boxShadow: "var(--card-shadow)", display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 13, color: "var(--text-2)" }}>모임 참여 시 불러올 수 있는 내 기본 선호도입니다.</p>
              {/* 좋아함/못먹음 토글 */}
              <div style={{ display: "flex", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r-pill)", padding: 3, gap: 3, width: "fit-content" }}>
                {(["like","dislike"] as const).map((t) => (
                  <button key={t} className="tap" onClick={() => setPrefType(t)} style={{ padding: "6px 18px", borderRadius: "var(--r-pill)", border: "none", fontSize: 13, fontWeight: 600, background: prefType === t ? (t === "like" ? "var(--green)" : "var(--red)") : "transparent", color: prefType === t ? "#fff" : "var(--text-2)", cursor: "pointer", transition: "all .15s" }}>{t === "like" ? "👍 좋아함" : "🚫 못먹음"}</button>
                ))}
              </div>
              {/* 못먹음: 재료/알레르기 프리셋 */}
              {prefType === "dislike" && (() => {
                const INGR_PRESETS = ["고수","땅콩","견과류","새우","조개","오징어","낙지","문어","굴","생선회","마라","청양고추","양파","버섯","파","마늘","곱창","순대","선지","내장"];
                return (
                  <div>
                    <p style={{ fontSize:11, fontWeight:700, color:"var(--text-2)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:7 }}>재료 / 알레르기</p>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {INGR_PRESETS.map(item => {
                        const active = myPrefs.some(p => p.food_name === item && p.preference_type === "dislike");
                        return (
                          <button key={item} className="tap" onClick={() => addMyPref(item)} style={{ padding:"4px 11px", borderRadius:"var(--r-pill)", fontSize:12, fontWeight: active ? 700 : 400, border: active ? "1.5px solid var(--red)" : "1.5px solid var(--border)", background: active ? "var(--red-soft)" : "transparent", color: active ? "var(--red)" : "var(--text-2)", cursor:"pointer" }}>
                            {active ? "✕ " : ""}{item}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* 대분류 */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>대분류</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {largeCats.map((c) => (
                    <button key={c} className="tap" onClick={() => { setPrefLarge(c === prefLarge ? "" : c); setPrefMedium(""); }} style={{ padding: "5px 13px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 500, border: prefLarge === c ? "2px solid var(--primary)" : "1.5px solid var(--border)", background: prefLarge === c ? "var(--primary-light)" : "transparent", color: prefLarge === c ? "var(--primary)" : "var(--text)", cursor: "pointer" }}>{c}</button>
                  ))}
                </div>
              </div>
              {/* 중분류 */}
              {prefLarge && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>중분류</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {medCats.map((c) => (
                      <button key={c} className="tap" onClick={() => setPrefMedium(c === prefMedium ? "" : c)} style={{ padding: "5px 13px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 500, border: prefMedium === c ? "2px solid var(--primary)" : "1.5px solid var(--border)", background: prefMedium === c ? "var(--primary-light)" : "transparent", color: prefMedium === c ? "var(--primary)" : "var(--text)", cursor: "pointer" }}>{c}</button>
                    ))}
                    <button className="tap" onClick={() => addMyPref(prefLarge)} style={{ padding: "5px 13px", borderRadius: "var(--r-pill)", fontSize: 12, border: "1.5px dashed var(--border)", background: "transparent", color: "var(--text-2)", cursor: "pointer" }}>+ {prefLarge} 전체</button>
                  </div>
                </div>
              )}
              {/* 소분류 */}
              {prefMedium && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>메뉴</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 130, overflowY: "auto" }}>
                    {menuItems.map((item) => {
                      const liked = myPrefs.find((p) => p.food_name === item && p.preference_type === "like");
                      const disliked = myPrefs.find((p) => p.food_name === item && p.preference_type === "dislike");
                      return (
                        <button key={item} className="tap" onClick={() => addMyPref(item)} style={{ padding: "4px 11px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 500, border: liked ? "1.5px solid var(--green)" : disliked ? "1.5px solid var(--red)" : "1.5px solid var(--border)", background: liked ? "var(--green-soft)" : disliked ? "var(--red-soft)" : "transparent", color: liked ? "var(--green)" : disliked ? "var(--red)" : "var(--text)", cursor: "pointer" }}>{item}</button>
                      );
                    })}
                    <button className="tap" onClick={() => addMyPref(prefMedium)} style={{ padding: "4px 11px", borderRadius: "var(--r-pill)", fontSize: 12, border: "1.5px dashed var(--border)", background: "transparent", color: "var(--text-2)", cursor: "pointer" }}>+ {prefMedium} 전체</button>
                  </div>
                </div>
              )}
              {/* 직접 입력 */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>직접 입력</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={prefInput} onChange={(e) => setPrefInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMyPref(); } }} placeholder="음식명 입력" style={{ flex: 1, padding: "9px 14px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 13, outline: "none" }} onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
                  <button className="tap" onClick={() => addMyPref()} style={{ padding: "9px 16px", borderRadius: "var(--r-pill)", border: "none", background: "var(--primary)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>등록</button>
                </div>
              </div>
              {/* 등록된 선호도 */}
              {myPrefs.filter((p) => p.preference_type === "dislike").length > 0 && (
                <div><p style={{ fontSize: 12, fontWeight: 700, color: "var(--red)", marginBottom: 6 }}>🚫 못먹는 음식</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {myPrefs.filter((p) => p.preference_type === "dislike").map((p) => (
                      <button key={p.id} onClick={() => removeMyPref(p.id)} style={{ padding: "3px 10px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 600, background: "var(--red-soft)", border: "1px solid var(--red)", color: "var(--red)", cursor: "pointer" }}>{p.food_name} ✕</button>
                    ))}
                  </div>
                </div>
              )}
              {myPrefs.filter((p) => p.preference_type === "like").length > 0 && (
                <div><p style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", marginBottom: 6 }}>❤️ 좋아하는 음식</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {myPrefs.filter((p) => p.preference_type === "like").map((p) => (
                      <button key={p.id} onClick={() => removeMyPref(p.id)} style={{ padding: "3px 10px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 600, background: "var(--green-soft)", border: "1px solid var(--green)", color: "var(--green)", cursor: "pointer" }}>{p.food_name} ✕</button>
                    ))}
                  </div>
                </div>
              )}
              {myPrefs.length === 0 && <p style={{ fontSize: 13, color: "var(--text-2)" }}>아직 저장된 선호도가 없습니다</p>}

              {/* 설정 완료 버튼 */}
              {myPrefs.length > 0 && (
                <button className="tap tap-primary" onClick={() => { setPrefSaved(true); setTimeout(() => setPrefSaved(false), 2500); }} style={{
                  width: "100%", padding: "13px", borderRadius: "var(--r-pill)", border: "none",
                  background: prefSaved ? "var(--green)" : "var(--primary)", color: "#fff",
                  fontFamily: "var(--font-display)", fontSize: 15, cursor: "pointer",
                  transition: "background .3s", boxShadow: prefSaved ? "0 6px 16px rgba(46,158,107,.3)" : "0 6px 16px rgba(255,122,69,.3)",
                }}>
                  {prefSaved ? "✓ 저장됐습니다!" : "설정 완료"}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* 내 취향 랭킹 (월드컵 누적) */}
      {currentUser.type === "auth" && myFoodScores.length > 0 && (
        <div className="fade-up" style={{ background:"var(--surface)", borderRadius:20, padding:"18px 16px", border:"var(--card-border)", boxShadow:"var(--card-shadow)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
            <p style={{ fontFamily:"var(--font-display)", fontSize:17 }}><img src="/mascot/tabs/ranking.png" style={{width:24, height:24, objectFit:"contain", marginRight:4}} />내 취향 랭킹</p>
          </div>
          <p style={{ fontSize:12, color:"var(--text-3)", marginBottom:14 }}>월드컵 선택 기반 · 많이 이길수록 높아져요</p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {myFoodScores.slice(0, 10).map((item, i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
              const maxScore = myFoodScores[0]?.score || 1;
              const barPct = Math.max(4, Math.round(item.score / maxScore * 100));
              const barColor = i === 0 ? "var(--primary)" : i === 1 ? "#FF9A6C" : i === 2 ? "#FFB899" : "var(--primary-light)";
              return (
                <div key={item.food_name} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ width:24, textAlign:"center", fontSize: medal ? 16 : 12, color:"var(--text-3)", fontWeight:700, flexShrink:0 }}>
                    {medal || `${i+1}`}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{item.food_name}</span>
                      <span style={{ fontSize:11, color:"var(--text-3)", fontWeight:600 }}>{item.score}점</span>
                    </div>
                    <div style={{ height:6, borderRadius:99, background:"var(--bg-2)", overflow:"hidden" }}>
                      <div style={{ width:`${barPct}%`, height:"100%", borderRadius:99, background: barColor, transition:"width .6s" }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize:11, color:"var(--text-3)", marginTop:12, textAlign:"center" }}>월드컵을 많이 플레이할수록 정확해져요 🎮</p>
        </div>
      )}

      {/* 문의/피드백 — 접기/열기 */}
      <div className="fade-up" style={{ marginTop: 8 }}>
        <button className="tap" onClick={() => setShowFeedback((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: showFeedback ? 14 : 0 }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>💬 문의 / 피드백</p>
          <span style={{ fontSize: 20, color: "var(--text-2)", transition: "transform .2s", transform: showFeedback ? "rotate(180deg)" : "" }}>⌄</span>
        </button>
        {showFeedback && <div>{fbSent ? (
          <div className="bounce-in" style={{ padding: "20px", borderRadius: 16, background: "var(--green-soft)", border: "1.5px solid var(--green)", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--green)", marginBottom: 6 }}>✓ 전달됐습니다!</p>
            <p style={{ fontSize: 13, color: "var(--text-2)" }}>소중한 의견 감사합니다 🙏</p>
            <button onClick={() => setFbSent(false)} style={{ marginTop: 12, padding: "8px 20px", borderRadius: "var(--r-pill)", border: "none", background: "var(--green)", color: "#fff", fontSize: 13, cursor: "pointer" }}>다시 작성</button>
          </div>
        ) : (
          <form onSubmit={submitFeedback} style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--surface)", borderRadius: 16, padding: "18px 16px", border: "var(--card-border)", boxShadow: "var(--card-shadow)" }}>
            {/* 카테고리 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {FEEDBACK_CATS.map((c) => (
                <button key={c.id} type="button" className="tap" onClick={() => setFbCat(c.id)} style={{
                  padding: "6px 14px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 600,
                  border: fbCat === c.id ? "none" : "1.5px solid var(--border)",
                  background: fbCat === c.id ? "var(--primary)" : "transparent",
                  color: fbCat === c.id ? "#fff" : "var(--text-2)", cursor: "pointer",
                }}>{c.label}</button>
              ))}
            </div>
            {/* 내용 */}
            <textarea value={fbContent} onChange={(e) => setFbContent(e.target.value)} required placeholder="내용을 입력해주세요 (버그, 불편한 점, 개선 아이디어 등)" rows={4}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 14, resize: "none", outline: "none", fontFamily: "var(--font-body)" }}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
            {/* 이메일 (선택) */}
            {currentUser.type !== "auth" && (
              <input value={fbEmail} onChange={(e) => setFbEmail(e.target.value)} placeholder="답변 받을 이메일 (선택)"
                style={{ padding: "10px 14px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 13, outline: "none" }}
                onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
            )}
            <button type="submit" disabled={fbSending || !fbContent.trim()} className="tap" style={{
              padding: "13px", borderRadius: "var(--r-pill)", border: "none",
              background: (!fbContent.trim() || fbSending) ? "var(--border)" : "var(--primary)",
              color: (!fbContent.trim() || fbSending) ? "var(--text-2)" : "#fff",
              fontFamily: "var(--font-display)", fontSize: 15, cursor: "pointer",
            }}>
              {fbSending ? "전송 중…" : "보내기 →"}
            </button>
          </form>
        )}</div>}
      </div>

      {/* 연결된 소셜 계정 + 계정 탈퇴 */}
      {currentUser.type === "auth" && (() => {
        async function handleDeleteAccount() {
          if (currentUser.type !== "auth") return;
          const { data: ownedGroups } = await getSupabase()
            .from("groups").select("id, name, emoji").eq("owner_id", currentUser.user.id);
          const owned = ownedGroups || [];

          let msg = "탈퇴하면 계정이 비활성화됩니다.\n리뷰·모임 기록 등은 보존됩니다.";
          if (owned.length > 0) {
            msg += `\n\n⚠️ 모임장인 모임 ${owned.length}개가 삭제됩니다:`;
            msg += owned.map(g => `\n• ${g.emoji || "🍱"} ${g.name}`).join("");
          }

          const confirmed = await showConfirm(msg, { icon: "⚠️", title: "계정 탈퇴", confirmLabel: "탈퇴", danger: true });
          if (!confirmed) return;

          const session = await getSupabase().auth.getSession();
          const token = session.data.session?.access_token;
          if (!token) { await showAlert("로그인 세션이 만료됐습니다. 다시 로그인해주세요."); return; }

          const res = await fetch("/api/auth/delete-account", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            await showAlert(`탈퇴 처리 중 오류가 발생했습니다.\n${data.error || ""}`);
            return;
          }
          await signOut();
          router.replace("/login");
        }
        return (
          <>
            {/* 연결된 소셜 계정 */}
            <div className="fade-up" style={{ paddingTop:16, borderTop:"1px solid var(--border)" }}>
              <p style={{ fontFamily:"var(--font-display)", fontSize:15, marginBottom:12 }}>🔗 연결된 소셜 계정</p>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {linkedProviders.filter(p => p !== "email").map(p => (
                  <div key={p} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", borderRadius:12, background:"var(--bg-2)", border:"1px solid var(--border)" }}>
                    <span style={{ fontSize:18 }}>{p === "google" ? "🔵" : p === "naver" ? "🟢" : p === "kakao" ? "🟡" : "🔗"}</span>
                    <span style={{ fontSize:13, color:"var(--text)" }}>{p === "google" ? "Google" : p === "naver" ? "Naver" : p === "kakao" ? "Kakao" : p} 연결됨</span>
                    <span style={{ marginLeft:"auto", fontSize:11, color:"var(--primary)", fontWeight:600 }}>✓</span>
                  </div>
                ))}
                {isSimpleAccount && (
                  <>
                    {!linkedProviders.includes("google") && (
                      <button className="tap" onClick={() => handleLinkSocial("google")} disabled={!!linkingProvider} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:12, background:"var(--surface)", border:"1.5px solid var(--border)", cursor:"pointer", textAlign:"left", opacity: linkingProvider ? 0.6 : 1 }}>
                        <span style={{ fontSize:18 }}>🔵</span>
                        <span style={{ fontSize:13, color:"var(--text)" }}>{linkingProvider === "google" ? "연결 중…" : "Google 계정 연결"}</span>
                        <span style={{ marginLeft:"auto", fontSize:12, color:"var(--text-3)" }}>+</span>
                      </button>
                    )}
                    {!linkedProviders.includes("naver") && (
                      <button className="tap" onClick={() => handleLinkSocial("naver")} disabled={!!linkingProvider} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:12, background:"var(--surface)", border:"1.5px solid var(--border)", cursor:"pointer", textAlign:"left", opacity: linkingProvider ? 0.6 : 1 }}>
                        <span style={{ fontSize:18 }}>🟢</span>
                        <span style={{ fontSize:13, color:"var(--text)" }}>{linkingProvider === "naver" ? "연결 중…" : "Naver 계정 연결"}</span>
                        <span style={{ marginLeft:"auto", fontSize:12, color:"var(--text-3)" }}>+</span>
                      </button>
                    )}
                    {linkedProviders.filter(p => p !== "email").length === 0 && (
                      <p style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>소셜 계정을 연결하면 해당 계정으로도 로그인할 수 있어요</p>
                    )}
                  </>
                )}
                {!isSimpleAccount && linkedProviders.filter(p => p !== "email").length === 0 && (
                  <p style={{ fontSize:12, color:"var(--text-3)" }}>연결된 소셜 계정이 없습니다</p>
                )}
              </div>
            </div>

            {/* 소셜 계정 충돌 모달 — 기존 소셜 계정이 있을 때만 표시 */}
            {showMigrateModal && migrateReason === "conflict" && (() => {
              const providerName = migrateProvider === "google" ? "Google" : migrateProvider === "naver" ? "Naver" : "소셜";
              const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("ko-KR", { year:"numeric", month:"short", day:"numeric" }) : "";
              const simpleGroupCount = myGroups.length + joinedGroups.length;
              const simpleNick = myProfile.nickname || myProfile.display_name || displayName || "나";
              return (
                <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200 }} onClick={() => setShowMigrateModal(false)}>
                  <div onClick={e => e.stopPropagation()} style={{ width:"100%", maxWidth:480, background:"var(--surface)", borderRadius:"20px 20px 0 0", padding:"24px 20px", paddingBottom:"max(24px, env(safe-area-inset-bottom, 24px))" }}>
                    <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 20px" }} />
                    <p style={{ fontFamily:"var(--font-display)", fontSize:17, marginBottom:6 }}>⚠️ 이미 가입된 {providerName} 계정</p>
                    <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:4 }}>두 계정의 모임·기록은 모두 동기화됩니다.</p>
                    <p style={{ fontSize:13, color:"var(--text)", fontWeight:600, marginBottom:16 }}>어떤 계정의 프로필 정보를 사용할까요?</p>

                    <div style={{ display:"flex", gap:10, marginBottom:14 }}>
                      {/* 현재 간편계정 카드 */}
                      <button className="tap" onClick={() => handleMigrateToSocial(true)} style={{ flex:1, padding:"14px 12px", borderRadius:16, border:"1.5px solid var(--primary)", background:"var(--primary-light)", color:"var(--text)", cursor:"pointer", textAlign:"left", display:"flex", flexDirection:"column", gap:6 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          {myProfile.profile_image
                            ? <img src={myProfile.profile_image} style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover" }} alt="" />
                            : <div style={{ width:36, height:36, borderRadius:"50%", background:"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>👤</div>}
                          <div style={{ minWidth:0 }}>
                            <p style={{ fontWeight:700, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{simpleNick}</p>
                            <p style={{ fontSize:11, color:"var(--primary)", fontWeight:600 }}>간편 계정 (현재)</p>
                          </div>
                        </div>
                        {simpleCreatedAt && <p style={{ fontSize:11, color:"var(--text-2)" }}>가입 {fmtDate(simpleCreatedAt)}</p>}
                        <p style={{ fontSize:11, color:"var(--text-2)" }}>참여 모임 {simpleGroupCount}개</p>
                        <p style={{ fontSize:12, fontWeight:700, color:"var(--primary)", marginTop:2 }}>이 정보 사용 →</p>
                      </button>

                      {/* 소셜 계정 카드 */}
                      <button className="tap" onClick={() => handleMigrateToSocial(false)} style={{ flex:1, padding:"14px 12px", borderRadius:16, border:"1.5px solid var(--border)", background:"var(--surface)", color:"var(--text)", cursor:"pointer", textAlign:"left", display:"flex", flexDirection:"column", gap:6 }}>
                        {conflictInfoLoading ? (
                          <p style={{ fontSize:12, color:"var(--text-3)" }}>불러오는 중…</p>
                        ) : socialConflictInfo ? (
                          <>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              {socialConflictInfo.profile_image
                                ? <img src={socialConflictInfo.profile_image} style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover" }} alt="" />
                                : <div style={{ width:36, height:36, borderRadius:"50%", background:"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>👤</div>}
                              <div style={{ minWidth:0 }}>
                                <p style={{ fontWeight:700, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{socialConflictInfo.display_name}</p>
                                <p style={{ fontSize:11, color:"var(--text-2)" }}>{providerName} 계정</p>
                              </div>
                            </div>
                            {socialConflictInfo.created_at && <p style={{ fontSize:11, color:"var(--text-2)" }}>가입 {fmtDate(socialConflictInfo.created_at)}</p>}
                            <p style={{ fontSize:11, color:"var(--text-2)" }}>참여 모임 {socialConflictInfo.group_count}개</p>
                            <p style={{ fontSize:12, fontWeight:700, color:"var(--text-2)", marginTop:2 }}>이 정보 사용 →</p>
                          </>
                        ) : (
                          <>
                            <div style={{ width:36, height:36, borderRadius:"50%", background:"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>👤</div>
                            <p style={{ fontSize:12, fontWeight:700, color:"var(--text-2)" }}>{providerName} 계정</p>
                            <p style={{ fontSize:12, fontWeight:700, color:"var(--text-2)", marginTop:2 }}>이 정보 사용 →</p>
                          </>
                        )}
                      </button>
                    </div>

                    <p style={{ fontSize:11, color:"var(--text-3)", textAlign:"center", marginBottom:12 }}>
                      가입된 모임 정보는 두 계정 모두 동기화됩니다
                    </p>
                    <button className="tap" onClick={() => setShowMigrateModal(false)} style={{ width:"100%", padding:"11px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:13, cursor:"pointer" }}>
                      취소
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="fade-up" style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <button className="tap" onClick={handleDeleteAccount} style={{ width:"100%", padding:"11px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--red)", background:"transparent", color:"var(--red)", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                회원 탈퇴
              </button>
              <p style={{ fontSize:11, color:"var(--text-3)", textAlign:"center", marginTop:6 }}>탈퇴 후 계정이 비활성화됩니다 · 리뷰/기록은 보존됨</p>
            </div>
          </>
        );
      })()}

      {/* 신고 내역 (로그인 사용자만) */}
      {currentUser.type === "auth" && (
        <div className="fade-up" style={{ marginTop: 8 }}>
          <button className="tap" onClick={() => setShowReports((v) => !v)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"none", border:"none", cursor:"pointer", padding:0, marginBottom: showReports ? 14 : 0 }}>
            <p style={{ fontFamily:"var(--font-display)", fontSize:17 }}>🚨 내 신고 내역</p>
            <span style={{ fontSize:20, color:"var(--text-2)", transition:"transform .2s", transform: showReports ? "rotate(180deg)" : "" }}>⌄</span>
          </button>
          {showReports && (
            <div style={{ background:"var(--surface)", borderRadius:16, border:"var(--card-border)", overflow:"hidden" }}>
              {myReports.length === 0 ? (
                <p style={{ padding:"20px 16px", textAlign:"center", color:"var(--text-3)", fontSize:14 }}>신고 내역이 없습니다</p>
              ) : myReports.map((r, i) => (
                <div key={r.id} style={{ padding:"12px 16px", borderBottom: i < myReports.length-1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>
                      {r.target_type === "user" ? "👤" : "👥"} {r.target_name}
                    </span>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:99,
                      background: r.status === "resolved" ? "var(--green-soft)" : r.status === "reviewed" ? "#FFF3CD" : "var(--bg-2)",
                      color: r.status === "resolved" ? "var(--green)" : r.status === "reviewed" ? "#856404" : "var(--text-3)" }}>
                      {r.status === "resolved" ? "처리완료" : r.status === "reviewed" ? "검토중" : "접수됨"}
                    </span>
                  </div>
                  <p style={{ fontSize:12, color:"var(--text-2)", marginBottom:2 }}>{r.reason}</p>
                  <p style={{ fontSize:11, color:"var(--text-3)" }}>{new Date(r.created_at).toLocaleDateString("ko-KR")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
