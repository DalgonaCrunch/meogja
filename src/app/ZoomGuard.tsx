"use client";
// (2026-11-23) iPhone / iPad Safari ignores user-scalable=no: a two-finger pinch or a double tap on a button zoomed the whole page
// and it stayed that way (buttons off screen). Block page zoom everywhere except inside [data-allow-pinch] (the map keeps its pinch),
// (meogja scrolls as a page, so no scroll reset after the keyboard — that would jump to the top.)
import { useEffect } from "react";

export default function ZoomGuard() {
  useEffect(() => {
    const free = (t: EventTarget | null) => !!(t instanceof Element && t.closest("[data-allow-pinch]"));
    const onGesture = (e: Event) => { if (!free(e.target)) e.preventDefault(); };
    const onMove = (e: TouchEvent) => { const sc = (e as TouchEvent & { scale?: number }).scale; if (sc !== undefined && sc !== 1 && !free(e.target)) e.preventDefault(); };
    const evs = ["gesturestart", "gesturechange", "gestureend"];
    evs.forEach((t) => document.addEventListener(t, onGesture, { passive: false }));
    document.addEventListener("touchmove", onMove, { passive: false });
    return () => { evs.forEach((t) => document.removeEventListener(t, onGesture)); document.removeEventListener("touchmove", onMove); };
  }, []);
  return null;
}
