export default function AuthLoadingPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 20 }}>
      <img src="/meogja-logo.jpg" alt="meogja" style={{ width: 80, height: "auto", borderRadius: 16, objectFit: "contain" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--primary)", animation: "pulse-dot 0.8s ease-in-out infinite" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--primary)", animation: "pulse-dot 0.8s ease-in-out 0.2s infinite" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--primary)", animation: "pulse-dot 0.8s ease-in-out 0.4s infinite" }} />
      </div>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-2)" }}>로그인 중…</p>
    </div>
  );
}
