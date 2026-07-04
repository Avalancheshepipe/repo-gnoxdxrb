"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import { useState } from "react";
import { Drawer } from "vaul";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon, PlusIcon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import { api } from "@/lib/trpc";

type WorkspaceProjectSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function WorkspaceProjectSheet({
  open,
  onClose,
}: WorkspaceProjectSheetProps) {
  const { t } = useI18n();
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
      onClose();
    },
  });

  function selectProject(id: string) {
    setActiveProjectId(id);
    onClose();
  }

  return (
    <>
      <Drawer.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        modal
      >
        <Drawer.Portal>
          <Drawer.Overlay className="julow-sheet-overlay" />
          <Drawer.Content
            className="julow-sheet"
            data-vaul-custom-container="true"
          >
            <div className="julow-sheet-handle" aria-hidden />
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-julow-glass-border px-4 py-3">
              <Drawer.Title className="text-base font-semibold tracking-tight">
                {t("common.projects")}
              </Drawer.Title>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="Close"
                onPress={onClose}
              >
                <Icon icon={Cancel01Icon} size={16} />
              </Button>
            </header>

            <div className="julow-sheet-body px-2 py-2">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-julow-glass-bg"
              >
                <PlusIcon size={16} color="currentColor" />
                {t("common.newProject")}
              </button>

              {projects.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-julow-muted">
                  {t("sidebar.noProjects")}
                </p>
              )}

              <div className="space-y-0.5">
                {projects.map((project) => {
                  const active = project.id === activeProjectId;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => selectProject(project.id)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        active
                          ? "bg-accent/10 text-accent"
                          : "text-julow-fg hover:bg-julow-glass-bg"
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
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

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
        <label htmlFor="mobile-project-name" className="julow-field-label">
          {t("common.newProject")}
        </label>
        <input
          id="mobile-project-name"
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
