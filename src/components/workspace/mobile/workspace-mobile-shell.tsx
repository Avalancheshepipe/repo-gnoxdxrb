"use client";

import { useEffect, type ReactNode } from "react";
import { WorkspaceBottomNav } from "@/components/workspace/mobile/workspace-bottom-nav";
import { WorkspaceMobileOverlays } from "@/components/workspace/mobile/workspace-mobile-overlays";
import { WorkspaceTopbar } from "@/components/workspace/workspace-topbar";

type WorkspaceMobileShellProps = {
  children: ReactNode;
  showAgentPanel?: boolean;
};

export function WorkspaceMobileShell({
  children,
  showAgentPanel = true,
}: WorkspaceMobileShellProps) {
  useEffect(() => {
    const open = () => {
      window.dispatchEvent(new CustomEvent("julow:open-agents-mobile"));
    };
    window.addEventListener("julow:open-agents", open);
    return () => window.removeEventListener("julow:open-agents", open);
  }, []);

  return (
    <div className="workspace-shell workspace-shell--mobile fixed inset-0 flex flex-col overflow-hidden">
      <WorkspaceTopbar variant="mobile" />

      <main className="workspace-main relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {children}
      </main>

      <WorkspaceBottomNav />

      <WorkspaceMobileOverlays showAgentPanel={showAgentPanel} />
    </div>
  );
}
