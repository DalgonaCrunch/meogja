"use client";
import { useEffect } from "react";
import { loadSavedTheme } from "@/lib/theme";

export default function ThemeLoader() {
  useEffect(() => { loadSavedTheme(); }, []);
  return null;
}
