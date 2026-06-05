"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { getDeviceId } from "@/lib/auth";

type Props = {
  targetType: "user" | "group";
  targetId: string;
  targetName: string;
  reporterUserId: string | null;
  onClose: () => void;
};

export default function ReportModal({ targetType, targetId, targetName, reporterUserId, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    const deviceId = getDeviceId();
    await getSupabase().from("reports").insert({
      reporter_user_id: reporterUserId || null,
      reporter_device_id: deviceId,
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      reason: reason.trim(),
    });
    setSubmitting(false);
    setDone(true);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:20, width:"100%", maxWidth:360, overflow:"hidden", boxShadow:"0 20px 50px rgba(0,0,0,.3)" }}>
        {/* header */}
        <div style={{ padding:"14px 18px", background:"linear-gradient(135deg,#E53935,#E91E63)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <img src="/meogja_tabs/meogja_cat_074.png" alt="" style={{ width:32, height:32, objectFit:"contain" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <span style={{ fontFamily:"var(--font-display)", fontSize:16, color:"#fff" }}>
              {targetType === "user" ? "사용자" : "모임"} 신고
            </span>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.25)", border:"none", borderRadius:"50%", width:28, height:28, cursor:"pointer", color:"#fff", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>

        <div style={{ padding:"18px 18px 22px" }}>
          {done ? (
            <div style={{ textAlign:"center", padding:"20px 0" }}>
              <p style={{ fontSize:36, marginBottom:12 }}>✅</p>
              <p style={{ fontFamily:"var(--font-display)", fontSize:18, color:"var(--text)", marginBottom:6 }}>신고가 접수되었습니다</p>
              <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:20 }}>검토 후 적절한 조치가 취해집니다.</p>
              <button onClick={onClose} style={{ padding:"10px 28px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:14, cursor:"pointer" }}>
                확인
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:6 }}>신고 대상</p>
              <p style={{ fontFamily:"var(--font-display)", fontSize:15, color:"var(--text)", marginBottom:16, padding:"8px 12px", background:"var(--bg-2)", borderRadius:10 }}>
                {targetType === "user" ? "👤" : "👥"} {targetName}
              </p>
              <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:6 }}>신고 사유 <span style={{ color:"#E53935" }}>*</span></p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="신고 사유를 자세히 적어주세요 (스팸, 부적절한 내용, 사기 등)"
                rows={4}
                style={{ width:"100%", padding:"10px 12px", borderRadius:12, border:"1.5px solid var(--border)", background:"var(--bg)", fontSize:13, resize:"none", outline:"none", color:"var(--text)", boxSizing:"border-box" }}
              />
              <button onClick={submit} disabled={!reason.trim() || submitting} style={{
                marginTop:12, width:"100%", padding:"12px", borderRadius:"var(--r-pill)", border:"none",
                background: reason.trim() ? "linear-gradient(135deg,#E53935,#E91E63)" : "var(--bg-2)",
                color: reason.trim() ? "#fff" : "var(--text-3)",
                fontFamily:"var(--font-display)", fontSize:15, cursor: reason.trim() ? "pointer" : "default",
              }}>
                {submitting ? "제출 중…" : "🚨 신고 제출"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
