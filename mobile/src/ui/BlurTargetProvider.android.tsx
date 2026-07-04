import type { ReactNode } from "react";

/** Native Dimezis blur segfaults on some Vivo/MediaTek devices (RenderThread SIGSEGV). */
export function BlurTargetProvider({ children }: { children: ReactNode }) {
  return children;
}
