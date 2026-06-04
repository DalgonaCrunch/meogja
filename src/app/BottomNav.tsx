"use client";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/", icon: "🏠", label: "홈" },
  { href: "/groups", icon: "👥", label: "모임" },
  { href: "/profile", icon: "👤", label: "내 정보" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

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
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
            background: "none", border: "none", cursor: "pointer", padding: "8px 0",
            color: isActive ? "var(--primary)" : "var(--text-3)",
            transition: "color .15s",
          }}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 400 }}>{t.label}</span>
            {isActive && <div style={{ width: 4, height: 4, borderRadius: 2, background: "var(--primary)", marginTop: 1 }} />}
          </button>
        );
      })}
    </nav>
  );
}
