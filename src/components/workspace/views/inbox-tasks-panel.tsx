"use client";

import {
  Calendar03Icon,
  FilterIcon,
  LayoutGridIcon,
  LeftToRightListDashIcon,
} from "@hugeicons/core-free-icons";
import {
  Button,
  Chip,
  Table,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePersistentState, readStoredState } from "@/lib/use-persistent-state";
import { defaultInboxViewMode } from "@/lib/inbox-view-mode";
import { isQueryBootstrapping } from "@/lib/query-loading";
import { Icon } from "@/components/ui/icon";
import { InboxActivityMenu } from "@/components/workspace/inbox-activity-menu";
import { InboxKanban } from "@/components/workspace/inbox-kanban";
import {
  InboxKanbanSkeleton,
  InboxTableSkeletonRows,
} from "@/components/workspace/inbox-skeletons";
import {
  AssigneeStack,
  PriorityChip,
  StatusChip,
  taskMatchesFilter,
} from "@/components/workspace/inbox-shared";
import { useI18n } from "@/components/providers/i18n-provider";
import { NewTaskDialog } from "@/components/workspace/new-task-dialog";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import { WorkspacePage } from "@/components/workspace/workspace-page";
import { formatDueLabel } from "@/lib/task-mappers";
import { api } from "@/lib/trpc";
import type { InboxTask } from "@/lib/workspace-data";

const filters = [
  { id: "all", key: "inbox.all" },
  { id: "mine", key: "inbox.assignedToMe" },
  { id: "agents", key: "inbox.agents" },
  { id: "overdue", key: "inbox.dueToday" },
  { id: "archived", key: "inbox.archived" },
] as const;

export type InboxViewMode = "list" | "kanban";

const VIEW_MODE_KEY = "julow_inbox_view_mode";

function TaskTitleCell({ task }: { task: InboxTask }) {
  return (
    <div className="min-w-[220px] py-0.5">
      <p className="font-medium leading-snug text-julow-fg">{task.title}</p>
      <p className="mt-0.5 line-clamp-1 text-xs text-julow-muted">
        {task.description}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1 lg:hidden">
        {task.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-julow-glass-bg px-1.5 py-0.5 text-[10px] text-julow-muted"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function InboxTaskRow({
  task,
  isSelected,
  onOpen,
}: {
  task: InboxTask;
  isSelected: boolean;
  onOpen: (taskId: string) => void;
}) {
  const { locale } = useI18n();
  const dueText = formatDueLabel(task.dueDate, task.status, locale);
  const open = () => onOpen(task.id);
  const cellClass = "cursor-pointer";

  return (
    <Table.Row
      id={task.id}
      className={isSelected ? "julow-inbox-table__row--selected" : undefined}
    >
      <Table.Cell className={cellClass} onClick={open}>
        <TaskTitleCell task={task} />
      </Table.Cell>
      <Table.Cell className={cellClass} onClick={open}>
        <span className="inline-flex w-fit">
          <StatusChip status={task.status} />
        </span>
      </Table.Cell>
      <Table.Cell className={cellClass} onClick={open}>
        <span className="inline-flex w-fit">
          <PriorityChip priority={task.priority} />
        </span>
      </Table.Cell>
      <Table.Cell className={cellClass} onClick={open}>
        <AssigneeStack assignees={task.assignees} />
      </Table.Cell>
      <Table.Cell className={cellClass} onClick={open}>
        <span
          className={`inline-flex max-w-[11rem] items-center gap-1 truncate text-sm ${
            task.dueLabel === "Today"
              ? "font-medium text-danger"
              : "text-julow-muted"
          }`}
          title={dueText}
        >
          <Icon icon={Calendar03Icon} size={14} className="shrink-0" />
          <span className="truncate">{dueText}</span>
        </span>
      </Table.Cell>
      <Table.Cell className={`hidden lg:table-cell ${cellClass}`} onClick={open}>
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <Chip key={tag} size="sm" variant="soft">
              {tag}
            </Chip>
          ))}
        </div>
      </Table.Cell>
      <Table.Cell
        className={`hidden md:table-cell text-sm text-julow-muted ${cellClass}`}
        onClick={open}
      >
        {task.project}
      </Table.Cell>
    </Table.Row>
  );
}

function InboxListSkeleton({ t }: { t: (key: string) => string }) {
  return (
    <Table variant="secondary" className="julow-inbox-table">
      <Table.ScrollContainer>
        <Table.Content aria-label="Loading tasks">
          <Table.Header>
            <Table.Column isRowHeader minWidth={240}>
              {t("inbox.task")}
            </Table.Column>
            <Table.Column minWidth={120}>{t("inbox.status")}</Table.Column>
            <Table.Column minWidth={90}>{t("inbox.priority")}</Table.Column>
            <Table.Column minWidth={160}>{t("inbox.assignees")}</Table.Column>
            <Table.Column minWidth={110}>{t("inbox.due")}</Table.Column>
            <Table.Column minWidth={120} className="hidden lg:table-cell">
              {t("inbox.tags")}
            </Table.Column>
            <Table.Column minWidth={130} className="hidden md:table-cell">
              {t("inbox.project")}
            </Table.Column>
          </Table.Header>
          <Table.Body>
            <InboxTableSkeletonRows />
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function InboxTasksBody({
  viewMode,
  isLoading,
  filtered,
  selectedTaskId,
  openTask,
  updateTask,
  t,
}: {
  viewMode: InboxViewMode;
  isLoading: boolean;
  filtered: InboxTask[];
  selectedTaskId: string | null;
  openTask: (taskId: string) => void;
  updateTask: (taskId: string, patch: Partial<InboxTask>) => void;
  t: (key: string) => string;
}) {
  if (isLoading) {
    return (
      <div className="julow-inbox-body" aria-busy="true">
        {viewMode === "list" ? (
          <InboxListSkeleton t={t} />
        ) : (
          <div className="p-3 sm:p-4">
            <InboxKanbanSkeleton />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="julow-inbox-body julow-inbox-enter">
      {viewMode === "list" ? (
        <Table variant="secondary" className="julow-inbox-table">
          <Table.ScrollContainer>
            <Table.Content aria-label="Inbox tasks">
              <Table.Header>
                <Table.Column isRowHeader minWidth={240}>
                  {t("inbox.task")}
                </Table.Column>
                <Table.Column minWidth={120}>{t("inbox.status")}</Table.Column>
                <Table.Column minWidth={90}>{t("inbox.priority")}</Table.Column>
                <Table.Column minWidth={160}>{t("inbox.assignees")}</Table.Column>
                <Table.Column minWidth={110}>{t("inbox.due")}</Table.Column>
                <Table.Column minWidth={120} className="hidden lg:table-cell">
                  {t("inbox.tags")}
                </Table.Column>
                <Table.Column minWidth={130} className="hidden md:table-cell">
                  {t("inbox.project")}
                </Table.Column>
              </Table.Header>
              <Table.Body items={filtered}>
                {(task) => (
                  <InboxTaskRow
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onOpen={openTask}
                  />
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : (
        <div className="p-3 sm:p-4">
          <InboxKanban
            tasks={filtered}
            onStatusChange={(taskId, status) => updateTask(taskId, { status })}
          />
        </div>
      )}
    </div>
  );
}

/** Client-only fallback: reads saved view mode before React hydrates persisted state. */
export function InboxTasksFallback() {
  const { t } = useI18n();
  const viewMode = readStoredState<InboxViewMode>(
    VIEW_MODE_KEY,
    defaultInboxViewMode(),
  );

  return (
    <div className="julow-inbox-body" aria-busy="true">
      {viewMode === "list" ? (
        <InboxListSkeleton t={t} />
      ) : (
        <div className="p-3 sm:p-4">
          <InboxKanbanSkeleton />
        </div>
      )}
    </div>
  );
}

export function InboxTasksPanel() {
  const { t } = useI18n();
  const [filter] = usePersistentState<string>("julow_inbox_filter", "all");
  const [viewMode] = usePersistentState<InboxViewMode>(
    VIEW_MODE_KEY,
    defaultInboxViewMode(),
  );
  const {
    tasks,
    selectedTaskId,
    openTask,
    updateTask,
    organizationId,
    activeProjectId,
    isLive,
    isLoadingTasks,
  } = useTaskWorkspace();

  const searchParams = useSearchParams();
  const taskParam = searchParams.get("task");
  useEffect(() => {
    if (taskParam) openTask(taskParam);
  }, [taskParam, openTask]);

  const archivedQuery = api.task.list.useQuery(
    {
      organizationId: organizationId ?? "",
      projectId: activeProjectId ?? undefined,
      archived: "archived",
    },
    { enabled: isLive && filter === "archived" && Boolean(activeProjectId) },
  );

  const filtered = useMemo(() => {
    if (filter === "archived") return archivedQuery.data ?? [];
    return tasks.filter((task) => taskMatchesFilter(task, filter));
  }, [tasks, filter, archivedQuery.data]);

  const archivedQueryEnabled =
    isLive && filter === "archived" && Boolean(activeProjectId);

  const isLoading =
    filter === "archived"
      ? isQueryBootstrapping(archivedQueryEnabled, archivedQuery)
      : isLoadingTasks;

  return (
    <InboxTasksBody
      viewMode={viewMode}
      isLoading={isLoading}
      filtered={filtered}
      selectedTaskId={selectedTaskId}
      openTask={openTask}
      updateTask={updateTask}
      t={t}
    />
  );
}
