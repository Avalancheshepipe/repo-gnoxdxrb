"use client";

import { useEffect, useRef, useState } from "react";

const LERP = 0.2;
const DOT_SIZE = 8;
const DOT_SIZE_ACTIVE = 10;

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const pressedRef = useRef(false);
  const frame = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (!finePointer) return;

    setEnabled(true);
    document.documentElement.classList.add("julow-cursor-active");

    const onMove = (e: MouseEvent) => {
      target.current = { x: e.clientX, y: e.clientY };
      setVisible(true);
    };

    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);
    const onDown = () => {
      pressedRef.current = true;
      setPressed(true);
    };
    const onUp = () => {
      pressedRef.current = false;
      setPressed(false);
    };

    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * LERP;
      current.current.y += (target.current.y - current.current.y) * LERP;

      if (dotRef.current) {
        const size = pressedRef.current ? DOT_SIZE_ACTIVE : DOT_SIZE;
        dotRef.current.style.width = `${size}px`;
        dotRef.current.style.height = `${size}px`;
        dotRef.current.style.transform = `translate3d(${current.current.x - size / 2}px, ${current.current.y - size / 2}px, 0)`;
      }

      frame.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);
    frame.current = requestAnimationFrame(tick);

    return () => {
      document.documentElement.classList.remove("julow-cursor-active");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  if (!enabled) return null;

  const size = pressed ? DOT_SIZE_ACTIVE : DOT_SIZE;

  return (
    <div
      ref={dotRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[10000] will-change-transform"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--julow-cursor)",
        boxShadow: pressed
          ? "0 0 0 8px var(--julow-cursor-ring), 0 2px 12px oklch(0 0 0 / 0.18)"
          : "0 0 0 6px var(--julow-cursor-ring), 0 2px 8px oklch(0 0 0 / 0.12)",
        opacity: visible ? 1 : 0,
        transition: "box-shadow 0.15s ease, opacity 0.2s ease",
      }}
    />
  );
}
