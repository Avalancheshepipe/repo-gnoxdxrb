"use client";

import { useSyncExternalStore } from "react";

/** Matches Tailwind `lg` breakpoint (1024px). */
export const WORKSPACE_MOBILE_QUERY = "(max-width: 1023px)";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsMobileWorkspace(): boolean {
  return useMediaQuery(WORKSPACE_MOBILE_QUERY);
}
