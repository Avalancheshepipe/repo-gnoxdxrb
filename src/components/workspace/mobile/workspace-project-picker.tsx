"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Button, Popover } from "@heroui/react";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon, PlusIcon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import { api } from "@/lib/trpc";

function initials(value: string): string {
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

export function WorkspaceProjectPicker() {
  const { t } = useI18n();
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    organizationId,
    activeProject,
    workspaceName,
    ready,
  } = useTaskWorkspace();
  const projectLabel =
    activeProject?.name ?? (ready ? workspaceName : t("common.loading"));

  const [open, setOpen] = useState(false);
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
      setOpen(false);
    },
  });

  function selectProject(id: string) {
    setActiveProjectId(id);
    setOpen(false);
  }

  return (
    <>
      <Popover isOpen={open} onOpenChange={setOpen}>
        <Popover.Trigger>
          <button
            type="button"
            className="julow-project-picker-trigger"
            aria-label={t("common.projects")}
            aria-expanded={open}
          >
            <span className="julow-project-picker-trigger__icon">
              {initials(projectLabel)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {projectLabel}
            </span>
            <Icon
              icon={ArrowDown01Icon}
              size={14}
              className={`shrink-0 text-julow-muted transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </Popover.Trigger>
        <Popover.Content
          placement="bottom start"
          className="julow-project-picker-menu w-[min(18rem,calc(100vw-5rem))] p-0"
        >
          <Popover.Dialog className="p-0">
            <div className="border-b border-julow-panel-solid-border px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-julow-muted">
                {t("common.projects")}
              </p>
            </div>
            <div className="max-h-[min(16rem,50dvh)] overflow-y-auto p-1.5">
              {projects.length === 0 && (
                <p className="px-2.5 py-3 text-center text-sm text-julow-muted">
                  {t("sidebar.noProjects")}
                </p>
              )}
              {projects.map((project) => {
                const active = project.id === activeProjectId;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => selectProject(project.id)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm transition-colors ${
                      active
                        ? "bg-accent/12 text-accent"
                        : "text-julow-fg hover:bg-julow-input-bg-subtle"
                    }`}
                  >
                    <span className="julow-project-picker-trigger__icon julow-project-picker-trigger__icon--sm">
                      {initials(project.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {project.name}
                    </span>
                    {project.taskCount > 0 && (
                      <span className="shrink-0 text-[11px] tabular-nums text-julow-muted">
                        {project.taskCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-julow-panel-solid-border p-1.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setCreateOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/8"
              >
                <PlusIcon size={16} color="currentColor" />
                {t("common.newProject")}
              </button>
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>

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
        <label htmlFor="picker-project-name" className="julow-field-label">
          {t("common.newProject")}
        </label>
        <input
          id="picker-project-name"
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
    </>
  );
}
