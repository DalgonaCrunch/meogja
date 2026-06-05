"use client";
import { useEffect, useState, useRef } from "react";
import { _registerDialog, _registerToast, DialogState, ToastState } from "@/lib/dialog";

export default function DialogProvider() {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [promptValue, setPromptValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    _registerDialog(setDialog);
    _registerToast((t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 2500);
    });
  }, []);

  useEffect(() => {
    if (dialog?.type === "prompt") {
      setPromptValue(dialog.defaultValue || "");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [dialog]);

  function close() { setDialog(null); }

  return (
    <>
      {/* ── Toast 스택 ── */}
      <div style={{
        position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        zIndex: 200, pointerEvents: "none", width: "calc(100% - 32px)", maxWidth: 440,
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: "rgba(30,30,30,.92)", color: "#fff", backdropFilter: "blur(8px)",
            borderRadius: "var(--r-pill)", padding: "10px 18px",
            fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,.25)", animation: "sheetUp .25s both",
          }}>
            <span>{t.icon}</span>{t.message}
          </div>
        ))}
      </div>

      {/* ── Dialog 오버레이 ── */}
      {dialog && (
        <div
          onClick={() => {
            if (dialog.type === "alert") { dialog.resolve(); close(); }
          }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 180, padding: "0 24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)", borderRadius: 22, padding: "24px 22px 20px",
              width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,.35)",
              animation: "sheetUp .22s both",
            }}
          >
            {/* Alert */}
            {dialog.type === "alert" && (
              <>
                {dialog.icon && <div style={{ fontSize: 36, textAlign: "center", marginBottom: 10 }}>{dialog.icon}</div>}
                {dialog.title && <p style={{ fontFamily: "var(--font-display)", fontSize: 17, marginBottom: 8, textAlign: "center" }}>{dialog.title}</p>}
                <p style={{ fontSize: 14, color: "var(--text-2)", textAlign: "center", lineHeight: 1.6, marginBottom: 20, whiteSpace: "pre-line" }}>{dialog.message}</p>
                <button className="tap" onClick={() => { dialog.resolve(); close(); }} style={{
                  width: "100%", padding: "13px", borderRadius: "var(--r-pill)", border: "none",
                  background: "var(--primary)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 15, cursor: "pointer",
                }}>확인</button>
              </>
            )}

            {/* Confirm */}
            {dialog.type === "confirm" && (
              <>
                {dialog.icon && <div style={{ fontSize: 36, textAlign: "center", marginBottom: 10 }}>{dialog.icon}</div>}
                {dialog.title && <p style={{ fontFamily: "var(--font-display)", fontSize: 17, marginBottom: 8, textAlign: "center" }}>{dialog.title}</p>}
                <p style={{ fontSize: 14, color: "var(--text-2)", textAlign: "center", lineHeight: 1.6, marginBottom: 22, whiteSpace: "pre-line" }}>{dialog.message}</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="tap" onClick={() => { dialog.resolve(false); close(); }} style={{
                    flex: 1, padding: "12px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--border)",
                    background: "transparent", color: "var(--text-2)", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  }}>취소</button>
                  <button className="tap" onClick={() => { dialog.resolve(true); close(); }} style={{
                    flex: 1, padding: "12px", borderRadius: "var(--r-pill)", border: "none",
                    background: dialog.danger ? "#E53935" : "var(--primary)",
                    color: "#fff", fontFamily: "var(--font-display)", fontSize: 14, cursor: "pointer",
                  }}>{dialog.confirmLabel || "확인"}</button>
                </div>
              </>
            )}

            {/* Prompt */}
            {dialog.type === "prompt" && (
              <>
                {dialog.title && <p style={{ fontFamily: "var(--font-display)", fontSize: 17, marginBottom: 6 }}>{dialog.title}</p>}
                <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 14, lineHeight: 1.5, whiteSpace: "pre-line" }}>{dialog.message}</p>
                <input
                  ref={inputRef}
                  type={dialog.inputType || "text"}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  placeholder={dialog.placeholder || ""}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { dialog.resolve(promptValue || null); close(); }
                    if (e.key === "Escape") { dialog.resolve(null); close(); }
                  }}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: "var(--r-pill)",
                    border: "1.5px solid var(--border)", background: "var(--bg)",
                    fontSize: 15, color: "var(--text)", outline: "none", marginBottom: 16,
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="tap" onClick={() => { dialog.resolve(null); close(); }} style={{
                    flex: 1, padding: "12px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--border)",
                    background: "transparent", color: "var(--text-2)", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  }}>취소</button>
                  <button className="tap" onClick={() => { dialog.resolve(promptValue || null); close(); }} style={{
                    flex: 1, padding: "12px", borderRadius: "var(--r-pill)", border: "none",
                    background: "var(--primary)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 14, cursor: "pointer",
                  }}>확인</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
