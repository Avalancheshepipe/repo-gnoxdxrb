"use client";

import dynamic from "next/dynamic";
import {
  FilterIcon,
  LayoutGridIcon,
  LeftToRightListDashIcon,
} from "@hugeicons/core-free-icons";
import {
  Button,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useState } from "react";
import { usePersistentState } from "@/lib/use-persistent-state";
import { defaultInboxViewMode } from "@/lib/inbox-view-mode";
import { Icon } from "@/components/ui/icon";
import { InboxActivityMenu } from "@/components/workspace/inbox-activity-menu";
import { InboxTasksFallback } from "@/components/workspace/views/inbox-tasks-panel";
import type { InboxViewMode } from "@/components/workspace/views/inbox-tasks-panel";
import { useI18n } from "@/components/providers/i18n-provider";
import { NewTaskDialog } from "@/components/workspace/new-task-dialog";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import { WorkspacePage } from "@/components/workspace/workspace-page";
import { api } from "@/lib/trpc";

const InboxTasksPanel = dynamic(
  () =>
    import("@/components/workspace/views/inbox-tasks-panel").then(
      (m) => m.InboxTasksPanel,
    ),
  { ssr: false, loading: () => <InboxTasksFallback /> },
);

const filters = [
  { id: "all", key: "inbox.all" },
  { id: "mine", key: "inbox.assignedToMe" },
  { id: "agents", key: "inbox.agents" },
  { id: "overdue", key: "inbox.dueToday" },
  { id: "archived", key: "inbox.archived" },
] as const;

export function InboxView() {
  const { t } = useI18n();
  const [filter, setFilter] = usePersistentState<string>(
    "julow_inbox_filter",
    "all",
  );
  const [viewMode, setViewMode] = usePersistentState<InboxViewMode>(
    "julow_inbox_view_mode",
    defaultInboxViewMode(),
  );
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const { organizationId, isLive, tasks, isLoadingTasks } = useTaskWorkspace();

  const activitiesQuery = api.activity.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: isLive, staleTime: 30_000 },
  );

  const taskCount = isLoadingTasks ? 0 : tasks.length;

  return (
    <WorkspacePage
      wide
      title={t("inbox.title")}
      description={t("inbox.description")}
      actions={
        <>
          <ToggleButtonGroup
            selectionMode="single"
            selectedKeys={[viewMode]}
            onSelectionChange={(keys) => {
              const key = Array.from(keys)[0];
              if (key === "list" || key === "kanban") setViewMode(key);
            }}
            size="sm"
            isDetached
            className="julow-view-toggle hidden md:flex"
          >
            <ToggleButton id="list" aria-label="List view" isIconOnly variant="ghost">
              <Icon icon={LeftToRightListDashIcon} size={16} />
            </ToggleButton>
            <ToggleButton id="kanban" aria-label="Kanban view" isIconOnly variant="ghost">
              <Icon icon={LayoutGridIcon} size={16} />
            </ToggleButton>
          </ToggleButtonGroup>

          <InboxActivityMenu activities={activitiesQuery.data ?? []} />

          <Button size="sm" variant="outline" className="hidden lg:inline-flex">
            <Icon icon={FilterIcon} size={16} />
            {t("common.filter")}
          </Button>
          <Button size="sm" variant="primary" onPress={() => setNewTaskOpen(true)}>
            {t("common.newTask")}
          </Button>
        </>
      }
    >
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-3 border-b border-julow-glass-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Tabs
            selectedKey={filter}
            onSelectionChange={(key) => setFilter(String(key))}
            className="julow-inbox-tabs min-w-0 flex-1"
          >
            <Tabs.ListContainer className="w-full">
              <Tabs.List aria-label="Inbox filters" className="w-full">
                {filters.map((f) => (
                  <Tabs.Tab key={f.id} id={f.id}>
                    {t(f.key)}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          <p className="shrink-0 text-xs text-julow-muted sm:pl-4">
            {t("inbox.taskCount").replace("{count}", String(taskCount))}
            <span className="hidden sm:inline"> · {t("inbox.clickToOpen")}</span>
          </p>
        </div>

        <InboxTasksPanel />

        <div className="flex items-center justify-between border-t border-julow-glass-border px-4 py-2.5 text-xs text-julow-muted sm:px-5">
          <span>
            {viewMode === "list" ? t("inbox.listView") : t("inbox.kanbanView")} ·{" "}
            {t("inbox.taskCount").replace("{count}", String(taskCount))}
          </span>
          <span className="hidden sm:inline">{t("inbox.updatedNow")}</span>
        </div>
      </div>

      <NewTaskDialog open={newTaskOpen} onClose={() => setNewTaskOpen(false)} />
    </WorkspacePage>
  );
}
