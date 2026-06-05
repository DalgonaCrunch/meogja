"use client";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/", img: "/mascot/tabs/home.png", label: "홈" },
  { href: "/groups", img: "/mascot/tabs/community.png", label: "모임" },
  { href: "/battle", img: "/mascot/tabs/game.png", label: "게임" },
  { href: "/profile", img: "/mascot/tabs/profile.png", label: "내 정보" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const active = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/groups") return pathname === "/groups" || pathname.startsWith("/groups/");
    return pathname.startsWith(href);
  };

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "var(--surface)",
      borderTop: "1px solid var(--border)",
      display: "flex", alignItems: "stretch",
      height: "var(--nav-h)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    }}>
      {TABS.map((t) => {
        const isActive = active(t.href);
        return (
          <button key={t.href} className="tap" onClick={() => router.push(t.href)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
            background: "none", border: "none", cursor: "pointer", padding: "6px 0",
            opacity: isActive ? 1 : 0.45,
            transition: "opacity .15s, transform .15s",
            transform: isActive ? "scale(1.08)" : "scale(1)",
          }}>
            <img src={(t as {href:string;img:string;label:string}).img} alt={t.label} style={{ width:34, height:34, objectFit:"contain" }} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 400, color: isActive ? "var(--primary)" : "var(--text-3)" }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
