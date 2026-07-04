"use client";

import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Logo } from "@/components/brand/logo";
import { Icon, PlusIcon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import { workspaceViewIcons } from "@/components/workspace/workspace-nav-icons";
import { api } from "@/lib/trpc";
import { getViewFromPath, sidebarViews } from "@/lib/workspace-data";

const viewIcons = workspaceViewIcons;

type WorkspaceSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function WorkspaceSidebar({ collapsed, onToggle }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const activeView = getViewFromPath(pathname);
  const { projects, activeProjectId, setActiveProjectId, organizationId } =
    useTaskWorkspace();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const utils = api.useUtils();
  const createProject = api.project.create.useMutation({
    onSuccess: async (project) => {
      if (organizationId)
        await utils.project.list.invalidate({ organizationId });
      setActiveProjectId(project.id);
      setName("");
      setCreateOpen(false);
    },
  });

  return (
    <aside
      className={`workspace-sidebar glass-panel flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r-0 transition-[width] duration-300 ${
        collapsed ? "w-[4.25rem]" : "w-[var(--sidebar-width)]"
      }`}
    >
      <div
        className={`flex h-[var(--topbar-height)] shrink-0 items-center border-b border-julow-glass-border ${
          collapsed
            ? "flex-col justify-center gap-0 px-1"
            : "justify-between gap-2 px-3"
        }`}
      >
        <Logo
          showWordmark={!collapsed}
          size={collapsed ? 26 : 28}
          href={null}
          wordmarkClassName="text-sm font-medium tracking-tight text-julow-muted"
        />
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onPress={onToggle}
          className={collapsed ? "size-7 min-w-0" : undefined}
        >
          <Icon
            icon={ArrowLeft01Icon}
            size={collapsed ? 14 : 16}
            className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </Button>
      </div>

      <div className="workspace-scroll flex-1 overflow-y-auto px-2 py-3">
        <nav className="space-y-1">
          {sidebarViews.map((view) => {
            const isActive = activeView === view.id;
            return (
              <Link
                key={view.id}
                href={view.href}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-julow-muted hover:bg-julow-glass-bg hover:text-julow-fg"
                } ${collapsed ? "justify-center px-2" : ""}`}
                title={collapsed ? t(`nav.${view.id}`) : undefined}
              >
                <Icon icon={viewIcons[view.id]} size={18} />
                {!collapsed && <span className="flex-1">{t(`nav.${view.id}`)}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <>
            <div className="mb-2 mt-6 flex items-center justify-between px-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-julow-muted">
                {t("common.projects")}
              </p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                aria-label={t("common.newProject")}
                className="flex size-5 items-center justify-center rounded-md transition-colors hover:bg-julow-glass-bg [--add-icon:var(--julow-muted)] hover:[--add-icon:var(--julow-fg)]"
              >
                <PlusIcon size={14} color="var(--add-icon)" />
              </button>
            </div>
            <div className="space-y-0.5">
              {projects.length === 0 && (
                <p className="px-2.5 py-2 text-xs text-julow-muted">
                  {t("sidebar.noProjects")}
                </p>
              )}
              {projects.map((project) => {
                const active = project.id === activeProjectId;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setActiveProjectId(project.id)}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-julow-glass-bg text-julow-fg"
                        : "text-julow-muted hover:bg-julow-glass-bg hover:text-julow-fg"
                    }`}
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${
                        active ? "bg-accent" : "bg-julow-muted/40"
                      }`}
                    />
                    <span className="flex-1 truncate">{project.name}</span>
                    {project.taskCount > 0 && (
                      <span className="shrink-0 text-[11px] text-julow-muted">
                        {project.taskCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("common.newProject")}
        description={t("sidebar.newProjectDescription")}
        footer={
          <>
            <Button variant="ghost" onPress={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              isDisabled={!name.trim() || !organizationId || createProject.isPending}
              onPress={() =>
                organizationId &&
                createProject.mutate({ organizationId, name: name.trim() })
              }
            >
              {createProject.isPending ? "…" : t("common.create")}
            </Button>
          </>
        }
      >
        <label htmlFor="project-name" className="julow-field-label">
          {t("common.newProject")}
        </label>
        <input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              name.trim() &&
              organizationId &&
              !createProject.isPending
            ) {
              createProject.mutate({ organizationId, name: name.trim() });
            }
          }}
          placeholder="e.g. Mobile App v2"
          className="julow-input"
          autoFocus
        />
      </Modal>
    </aside>
  );
}
