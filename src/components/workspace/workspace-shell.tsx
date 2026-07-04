"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { type ReactNode } from "react";
import { TaskWorkspaceProvider } from "@/components/workspace/task-workspace-context";
import { WorkspaceDesktopShell } from "@/components/workspace/workspace-desktop-shell";
import { useIsMobileWorkspace } from "@/lib/use-media-query";

const WorkspaceMobileShell = dynamic(
  () =>
    import("@/components/workspace/mobile/workspace-mobile-shell").then(
      (m) => m.WorkspaceMobileShell,
    ),
  { ssr: false },
);

type WorkspaceShellProps = {
  children: ReactNode;
  showAgentPanel?: boolean;
};

function WorkspaceShellInner({
  children,
  showAgentPanel = true,
}: WorkspaceShellProps) {
  const isMobile = useIsMobileWorkspace();
  const searchParams = useSearchParams();
  // Embed mode: the native app loads a view (e.g. the canvas) inside a WebView
  // and supplies its own chrome. Render only the content, full-bleed, with no
  // topbar / bottom-nav / overlays.
  const isEmbed = searchParams.get("embed") === "1";

  if (isEmbed) {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-transparent">
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <WorkspaceMobileShell showAgentPanel={showAgentPanel}>
        {children}
      </WorkspaceMobileShell>
    );
  }

  return (
    <WorkspaceDesktopShell showAgentPanel={showAgentPanel}>
      {children}
    </WorkspaceDesktopShell>
  );
}

export function WorkspaceShell(props: WorkspaceShellProps) {
  return (
    <TaskWorkspaceProvider>
      <WorkspaceShellInner {...props} />
    </TaskWorkspaceProvider>
  );
}
