"use client";
import { useRef } from "react";

/**
 * 폰에서 위아래로 스크롤하다 손가락이 막대에 닿아도 값이 바뀌지 않는 range 입력.
 * 터치는 옆으로 확실히 끌었을 때(가로 12px 이상, 세로보다 1.5배 이상)만 값을 바꾼다.
 * 마우스는 그대로. value 를 받는 controlled 입력이라 무시한 변경은 React 가 원래 값으로 되돌린다.
 */
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  onValue: (v: number) => void;
};

export default function ScrollSafeRange({ onValue, style, ...rest }: Props) {
  const g = useRef<{ x: number; y: number; ok: boolean } | null>(null);
  return (
    <input
      type="range"
      {...rest}
      style={{ touchAction: "pan-y", ...style }}
      onPointerDown={e => { g.current = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY, ok: false }; }}
      onPointerMove={e => {
        const s = g.current;
        if (!s || s.ok) return;
        const dx = Math.abs(e.clientX - s.x), dy = Math.abs(e.clientY - s.y);
        if (dx > 12 && dx > dy * 1.5) s.ok = true;
      }}
      onPointerUp={() => { g.current = null; }}
      onPointerCancel={() => { g.current = null; }}
      onChange={e => { if (g.current && !g.current.ok) return; onValue(Number(e.target.value)); }}
    />
  );
}
