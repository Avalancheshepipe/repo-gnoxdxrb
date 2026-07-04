"use client";

import { usePathname } from "next/navigation";
import { CustomCursor } from "./custom-cursor";

export function ConditionalCursor() {
  const pathname = usePathname();
  const isWorkspace = pathname.startsWith("/app");

  if (isWorkspace) return null;

  return <CustomCursor />;
}
