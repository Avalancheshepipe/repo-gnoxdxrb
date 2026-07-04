"use client";

import { type ReactNode } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { usePersistentState } from "@/lib/use-persistent-state";
import { WorkspaceRightRail } from "./workspace-right-rail";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { WorkspaceTopbar } from "./workspace-topbar";

type WorkspaceDesktopShellProps = {
  children: ReactNode;
  showAgentPanel?: boolean;
};

export function WorkspaceDesktopShell({
  children,
  showAgentPanel = true,
}: WorkspaceDesktopShellProps) {
  const { t } = useI18n();
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState(
    "julow_sidebar_collapsed",
    false,
  );
  const [panelCollapsed, setPanelCollapsed] = usePersistentState(
    "julow_agent_panel_collapsed",
    false,
  );

  return (
    <div className="workspace-shell fixed inset-0 flex overflow-hidden">
      <WorkspaceSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceTopbar variant="desktop" />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <main className="workspace-main relative min-h-0 min-w-0 flex-1 overflow-hidden">
            {children}
          </main>

          <WorkspaceRightRail
            showAgentPanel={showAgentPanel}
            collapsed={panelCollapsed}
            onToggle={() => setPanelCollapsed((v) => !v)}
          />
        </div>

        <footer className="workspace-desktop-footer glass-panel-subtle flex h-[var(--footer-height)] shrink-0 items-center justify-between border-t border-julow-glass-border px-3 text-[11px] text-julow-muted sm:px-4">
          <span className="flex min-w-0 shrink-0 items-center gap-1.5">
            <span className="size-1.5 shrink-0 rounded-full bg-success" />
            <span className="truncate">{t("status.agentsReady")}</span>
          </span>
          <span className="julow-footer-chip julow-footer-chip--success">
            <span className="hidden sm:inline">{t("status.allOperational")}</span>
            <span className="sm:hidden">{t("status.ok")}</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
