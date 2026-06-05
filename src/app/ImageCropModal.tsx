"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  src: string;           // image URL or data URL
  onSave: (dataUrl: string) => void;
  onClose: () => void;
  size?: number;         // output size (default 300)
  title?: string;
};

export default function ImageCropModal({ src, onSave, onClose, size = 300, title = "이미지 위치 조정" }: Props) {
  const PREVIEW = 240; // preview circle size in px
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImgSize({ w: img.width, h: img.height });
      // 초기 스케일: 짧은 쪽이 원을 꽉 채우도록
      const minDim = Math.min(img.width, img.height);
      const initScale = PREVIEW / minDim;
      setScale(initScale);
      setOffset({ x: 0, y: 0 });
    };
    img.src = src;
  }, [src]);

  const clampOffset = useCallback((ox: number, oy: number, sc: number) => {
    const sw = imgSize.w * sc;
    const sh = imgSize.h * sc;
    const half = PREVIEW / 2;
    const maxX = Math.max(0, (sw - PREVIEW) / 2);
    const maxY = Math.max(0, (sh - PREVIEW) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    };
  }, [imgSize]);

  // Mouse events
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    const clamped = clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, scale);
    setOffset(clamped);
  }
  function onMouseUp() { setDragging(false); dragStart.current = null; }

  // Touch events
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragStart.current = { mx: t.clientX, my: t.clientY, ox: offset.x, oy: offset.y };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx*dx + dy*dy);
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1 && dragStart.current) {
      const t = e.touches[0];
      const dx = t.clientX - dragStart.current.mx;
      const dy = t.clientY - dragStart.current.my;
      const clamped = clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, scale);
      setOffset(clamped);
    } else if (e.touches.length === 2 && lastPinchDist.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const ratio = dist / lastPinchDist.current;
      lastPinchDist.current = dist;
      const newScale = Math.max(0.5, Math.min(5, scale * ratio));
      const clamped = clampOffset(offset.x, offset.y, newScale);
      setScale(newScale);
      setOffset(clamped);
    }
  }
  function onTouchEnd() { lastPinchDist.current = null; }

  // Wheel zoom
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(5, scale * delta));
    const clamped = clampOffset(offset.x, offset.y, newScale);
    setScale(newScale);
    setOffset(clamped);
  }

  function handleSave() {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    // Clip to circle
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
    ctx.clip();
    const img = imgRef.current;
    if (!img) return;
    const ratio = size / PREVIEW;
    const sw = imgSize.w * scale * ratio;
    const sh = imgSize.h * scale * ratio;
    const dx = (size - sw) / 2 + offset.x * ratio;
    const dy = (size - sh) / 2 + offset.y * ratio;
    ctx.drawImage(img, dx, dy, sw, sh);
    onSave(canvas.toDataURL("image/jpeg", 0.9));
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:"20px" }}>
      <div style={{ background:"var(--surface)", borderRadius:24, padding:"24px 22px", width:"100%", maxWidth:360, display:"flex", flexDirection:"column", gap:20, animation:"sheetUp .25s both" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <p style={{ fontFamily:"var(--font-display)", fontSize:18 }}>{title}</p>
          <button onClick={onClose} style={{ background:"var(--bg-2)", border:"none", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontSize:16 }}>✕</button>
        </div>

        <p style={{ fontSize:12, color:"var(--text-2)", textAlign:"center", marginTop:-10 }}>드래그로 이동 · 핀치/스크롤로 확대</p>

        {/* Preview circle */}
        <div style={{ display:"flex", justifyContent:"center" }}>
          <div
            ref={containerRef}
            style={{
              width:PREVIEW, height:PREVIEW, borderRadius:"50%", overflow:"hidden",
              cursor:dragging?"grabbing":"grab",
              background:"var(--bg-2)", border:"3px solid var(--primary)",
              touchAction:"none", userSelect:"none", position:"relative",
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onWheel={onWheel}
          >
            <img
              ref={imgRef}
              src={src}
              alt="crop"
              draggable={false}
              style={{
                width: imgSize.w * scale,
                height: imgSize.h * scale,
                position:"absolute",
                left: (PREVIEW - imgSize.w * scale) / 2 + offset.x,
                top: (PREVIEW - imgSize.h * scale) / 2 + offset.y,
                pointerEvents:"none",
              }}
            />
          </div>
        </div>

        {/* Scale slider */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:12, color:"var(--text-3)" }}>축소</span>
          <input type="range" min={0.5} max={5} step={0.05} value={scale}
            onChange={(e) => {
              const newScale = parseFloat(e.target.value);
              const clamped = clampOffset(offset.x, offset.y, newScale);
              setScale(newScale);
              setOffset(clamped);
            }}
            style={{ flex:1, accentColor:"var(--primary)" }}
          />
          <span style={{ fontSize:12, color:"var(--text-3)" }}>확대</span>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button className="tap" onClick={onClose} style={{ flex:1, padding:"12px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:14, cursor:"pointer" }}>취소</button>
          <button className="tap" onClick={handleSave} style={{ flex:2, padding:"12px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer" }}>적용하기</button>
        </div>
      </div>
    </div>
  );
}
