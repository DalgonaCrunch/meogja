"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { getDeviceId } from "@/lib/auth";

type Props = {
  targetType: "user" | "group" | "message";
  targetId: string;
  targetName: string;
  reporterUserId: string | null;
  /** 신고 대상이 글이면 그 내용. 메시지는 지워질 수 있어서 id 만으로는 검토가 안 된다. */
  targetContent?: string;
  /** 어느 모임에서 일어난 일인지 */
  groupId?: string;
  onClose: () => void;
};

const LABEL: Record<Props["targetType"], string> = {
  user: "사용자",
  group: "모임",
  message: "메시지",
};

const ICON: Record<Props["targetType"], string> = {
  user: "👤",
  group: "👥",
  message: "💬",
};

/** 사유를 처음부터 글로 쓰게 하면 대부분 신고를 포기한다. 한 번 눌러 고르게 한다. */
const PRESETS = [
  "스팸 · 광고",
  "욕설 · 혐오 표현",
  "성적인 내용",
  "사기 · 사칭",
  "개인정보 노출",
  "기타",
];

export default function ReportModal({ targetType, targetId, targetName, reporterUserId, targetContent, groupId, onClose }: Props) {
  const [preset, setPreset] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const fullReason = [preset, reason.trim()].filter(Boolean).join(" — ");
  const canSubmit = Boolean(preset || reason.trim());

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    const deviceId = getDeviceId();
    const row: Record<string, unknown> = {
      reporter_user_id: reporterUserId || null,
      reporter_device_id: deviceId,
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      reason: fullReason,
    };
    if (targetContent) row.target_content = targetContent.slice(0, 2000);
    if (groupId) row.group_id = groupId;

    let { error: err } = await getSupabase().from("reports").insert(row);

    // 마이그레이션 전이면 target_content/group_id 컬럼이 없거나 target_type 체크에 걸린다.
    // 신고 자체가 막히는 것이 가장 나쁘므로, 새 필드를 빼고 한 번 더 시도한다.
    if (err) {
      const fallback: Record<string, unknown> = { ...row, target_type: targetType === "message" ? "user" : targetType };
      delete fallback.target_content;
      delete fallback.group_id;
      const retry = await getSupabase().from("reports").insert(fallback);
      err = retry.error;
    }

    setSubmitting(false);
    if (err) {
      setError("신고를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setDone(true);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:20, width:"100%", maxWidth:360, overflow:"hidden", boxShadow:"0 20px 50px rgba(0,0,0,.3)" }}>
        {/* header */}
        <div style={{ padding:"14px 18px", background:"linear-gradient(135deg,#E53935,#E91E63)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <img src="/mascot/tabs/warning.png" alt="" style={{ width:32, height:32, objectFit:"contain" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <span style={{ fontFamily:"var(--font-display)", fontSize:16, color:"#fff" }}>
              {LABEL[targetType]} 신고
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
              <p style={{ fontFamily:"var(--font-display)", fontSize:15, color:"var(--text)", marginBottom: targetContent ? 8 : 16, padding:"8px 12px", background:"var(--bg-2)", borderRadius:10 }}>
                {ICON[targetType]} {targetName}
              </p>
              {targetContent && (
                <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:16, padding:"8px 12px", background:"var(--bg)", border:"1px solid var(--border)", borderRadius:10, maxHeight:88, overflow:"auto", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                  {targetContent}
                </p>
              )}
              <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:6 }}>신고 사유 <span style={{ color:"#E53935" }}>*</span></p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                {PRESETS.map((r) => (
                  <button key={r} type="button" onClick={() => setPreset(preset === r ? "" : r)} style={{
                    padding:"7px 12px", borderRadius:100, fontSize:12.5, cursor:"pointer",
                    border: preset === r ? "1.5px solid #E53935" : "1.5px solid var(--border)",
                    background: preset === r ? "#E5393512" : "transparent",
                    color: preset === r ? "#E53935" : "var(--text-2)",
                    fontWeight: preset === r ? 700 : 400,
                  }}>{r}</button>
                ))}
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="자세한 내용을 적어주시면 검토에 도움이 됩니다 (선택)"
                rows={3}
                style={{ width:"100%", padding:"10px 12px", borderRadius:12, border:"1.5px solid var(--border)", background:"var(--bg)", fontSize:13, resize:"none", outline:"none", color:"var(--text)", boxSizing:"border-box" }}
              />
              {error && (
                <p style={{ marginTop:10, fontSize:12.5, color:"#E53935" }}>{error}</p>
              )}
              <button onClick={submit} disabled={!canSubmit || submitting} style={{
                marginTop:12, width:"100%", padding:"12px", borderRadius:"var(--r-pill)", border:"none",
                background: canSubmit ? "linear-gradient(135deg,#E53935,#E91E63)" : "var(--bg-2)",
                color: canSubmit ? "#fff" : "var(--text-3)",
                fontFamily:"var(--font-display)", fontSize:15, cursor: canSubmit ? "pointer" : "default",
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
