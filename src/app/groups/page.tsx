"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GroupsPage() {
  const router = useRouter();
  useEffect(() => {
    const lastGroup = localStorage.getItem("meogja_last_group");
    if (lastGroup) router.replace(`/groups/${lastGroup}`);
    else router.replace("/");
  }, [router]);
  return <div style={{ textAlign:"center", padding:60, color:"var(--text-2)", fontFamily:"var(--font-body)" }}>이동 중…</div>;
}
