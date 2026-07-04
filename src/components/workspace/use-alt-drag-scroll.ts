"use client";

import { useCallback, useEffect, useRef } from "react";

type UseAltDragScrollOptions = {
  /** When true, touch drag pans horizontally (no Alt required). */
  enableTouchDrag?: boolean;
};

export function useAltDragScroll<T extends HTMLElement>(
  options: UseAltDragScrollOptions = {},
) {
  const { enableTouchDrag = true } = options;
  const ref = useRef<T>(null);
  const drag = useRef({
    active: false,
    startX: 0,
    scrollLeft: 0,
    isTouch: false,
  });

  const endDrag = useCallback(() => {
    const el = ref.current;
    if (el) {
      el.style.cursor = "";
      el.style.userSelect = "";
    }
    drag.current.active = false;
    drag.current.isTouch = false;
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!e.altKey || !ref.current) return;
    e.preventDefault();
    drag.current = {
      active: true,
      startX: e.pageX,
      scrollLeft: ref.current.scrollLeft,
      isTouch: false,
    };
    ref.current.style.cursor = "grabbing";
    ref.current.style.userSelect = "none";
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enableTouchDrag || !ref.current || e.touches.length !== 1) return;
    drag.current = {
      active: true,
      startX: e.touches[0].pageX,
      scrollLeft: ref.current.scrollLeft,
      isTouch: true,
    };
  }, [enableTouchDrag]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!drag.current.active || !drag.current.isTouch || !ref.current) return;
    const dx = e.touches[0].pageX - drag.current.startX;
    if (Math.abs(dx) > 4) e.preventDefault();
    ref.current.scrollLeft = drag.current.scrollLeft - dx;
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!drag.current.active || drag.current.isTouch || !ref.current) return;
      e.preventDefault();
      const dx = e.pageX - drag.current.startX;
      ref.current.scrollLeft = drag.current.scrollLeft - dx;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", endDrag);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endDrag);
    };
  }, [endDrag]);

  const onMouseEnter = useCallback((e: React.MouseEvent) => {
    if (e.altKey && ref.current) ref.current.style.cursor = "grab";
  }, []);

  const onMouseLeave = useCallback(() => {
    if (!drag.current.active && ref.current) ref.current.style.cursor = "";
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.altKey && ref.current) ref.current.style.cursor = "grab";
  }, []);

  const onKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (!drag.current.active && ref.current && !e.altKey) {
      ref.current.style.cursor = "";
    }
  }, []);

  return {
    ref,
    scrollProps: {
      onMouseDown,
      onMouseEnter,
      onMouseLeave,
      onKeyDown,
      onKeyUp,
      onTouchStart,
      onTouchMove,
      onTouchEnd: endDrag,
      onTouchCancel: endDrag,
    },
  };
}
