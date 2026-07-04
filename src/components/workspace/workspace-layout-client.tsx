"use client";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export function WorkspaceLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
