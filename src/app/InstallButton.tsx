"use client";
import { useEffect, useState } from "react";

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isInstalled, setIsInstalled] = useState(true); // 기본값 true로 숨겨두고
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return; // 이미 설치됨
    setIsInstalled(false);
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isInstalled) return null;

  async function handleClick() {
    if (isIOS) { setShowIOSGuide(true); return; }
    if (deferredPrompt) {
      (deferredPrompt as unknown as { prompt: () => void }).prompt();
    }
  }

  return (
    <>
      <button className="tap" onClick={handleClick} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "9px 18px", borderRadius: "var(--r-pill)",
        border: "1.5px solid var(--border)", background: "var(--surface)",
        color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer",
        boxShadow: "var(--card-shadow)",
      }}>
        📲 앱 추가
      </button>

      {/* iOS 가이드 */}
      {showIOSGuide && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:80 }}
          onClick={() => setShowIOSGuide(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"24px 22px 40px", width:"100%", maxWidth:480, boxShadow:"0 -20px 50px rgba(0,0,0,.3)", animation:"sheetUp .3s both" }}>
            <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 20px" }} />
            <p style={{ fontFamily:"var(--font-display)", fontSize:20, marginBottom:16 }}>📲 홈화면에 추가하기</p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:"var(--primary-light)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>1</div>
                <p style={{ fontSize:14, color:"var(--text-2)" }}>하단 <strong>공유 버튼</strong>(□↑)을 탭</p>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:"var(--primary-light)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>2</div>
                <p style={{ fontSize:14, color:"var(--text-2)" }}><strong>"홈 화면에 추가"</strong> 선택</p>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:"var(--primary-light)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>3</div>
                <p style={{ fontSize:14, color:"var(--text-2)" }}><strong>"추가"</strong> 버튼 탭</p>
              </div>
            </div>
            <button className="tap" onClick={() => setShowIOSGuide(false)} style={{ marginTop:20, width:"100%", padding:"13px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer" }}>
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
