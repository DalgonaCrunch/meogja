"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Redirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get("tab");
    router.replace(tab ? `/play?tab=${tab}` : "/play");
  }, []);
  return null;
}

export default function BattlePage() {
  return (
    <Suspense fallback={null}>
      <Redirect />
    </Suspense>
  );
}
