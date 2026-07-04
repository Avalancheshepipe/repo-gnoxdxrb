"use client";

import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { useCallback, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import {
  AssigneeStack,
  kanbanColumns,
  PriorityChip,
  statusLabel,
} from "@/components/workspace/inbox-shared";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import { formatDueLabel } from "@/lib/task-mappers";
import type { InboxTask, TaskStatus } from "@/lib/workspace-data";

type InboxKanbanProps = {
  tasks: InboxTask[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
};

export function InboxKanban({ tasks, onStatusChange }: InboxKanbanProps) {
  const { locale, t } = useI18n();
  const { selectedTaskId, openTask } = useTaskWorkspace();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const didDragRef = useRef(false);

  const tasksByStatus = useCallback(
    (status: TaskStatus) => tasks.filter((t) => t.status === status),
    [tasks],
  );

  const handleDragStart = (taskId: string) => {
    didDragRef.current = true;
    setDraggingId(taskId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  };

  const handleDrop = (status: TaskStatus) => {
    if (draggingId) {
      onStatusChange(draggingId, status);
    }
    setDraggingId(null);
    setDropTarget(null);
  };

  const handleCardClick = (taskId: string) => {
    if (didDragRef.current) return;
    openTask(taskId);
  };

  return (
    <div className="julow-kanban-board workspace-scroll flex min-h-[480px] flex-col gap-4 sm:flex-row sm:items-stretch sm:overflow-x-auto sm:pb-2">
      {kanbanColumns.map((status) => {
        const columnTasks = tasksByStatus(status);
        const isTarget = dropTarget === status;

        return (
          <div
            key={status}
            className={`julow-kanban-column flex min-h-[200px] flex-col rounded-xl border transition-colors sm:w-72 sm:min-w-[17rem] sm:shrink-0 xl:w-auto xl:min-w-0 xl:flex-1 ${
              isTarget
                ? "border-accent/40 bg-accent/5"
                : "border-julow-glass-border bg-julow-glass-bg/30"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget(status);
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(status);
            }}
          >
            <header className="flex items-center justify-between border-b border-julow-glass-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{statusLabel(status, t)}</span>
                <span className="rounded-md bg-julow-glass-bg px-1.5 py-0.5 text-[11px] font-medium text-julow-muted">
                  {columnTasks.length}
                </span>
              </div>
            </header>

            <div className="flex flex-1 flex-col gap-2.5 p-2.5">
              {columnTasks.map((task) => (
                <article
                  key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(task.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleCardClick(task.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openTask(task.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`julow-kanban-card glass-panel cursor-pointer rounded-xl p-3 transition-all active:cursor-grabbing ${
                    draggingId === task.id
                      ? "scale-[0.98] opacity-50 shadow-lg"
                      : "hover:shadow-md"
                  } ${selectedTaskId === task.id ? "ring-1 ring-accent/35" : ""}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-julow-fg">
                      {task.title}
                    </h3>
                    <PriorityChip priority={task.priority} />
                  </div>

                  <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-julow-muted">
                    {task.description}
                  </p>

                  <div className="mb-3 flex flex-wrap gap-1">
                    {task.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-julow-glass-bg px-1.5 py-0.5 text-[10px] text-julow-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <footer className="flex items-center justify-between gap-2 border-t border-julow-glass-border pt-2.5">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <AssigneeStack assignees={task.assignees} max={2} />
                    </div>
                    {(() => {
                      const dueText = formatDueLabel(
                        task.dueDate,
                        task.status,
                        locale,
                      );
                      return (
                        <span
                          className={`inline-flex min-w-0 max-w-[46%] items-center gap-1 text-[10px] leading-tight ${
                            task.dueLabel === "Today"
                              ? "font-medium text-danger"
                              : "text-julow-muted"
                          }`}
                          title={dueText}
                        >
                          <Icon
                            icon={Calendar03Icon}
                            size={11}
                            className="shrink-0"
                          />
                          <span className="truncate">{dueText}</span>
                        </span>
                      );
                    })()}
                  </footer>
                </article>
              ))}

              {columnTasks.length === 0 && (
                <div
                  className={`flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-8 text-center text-xs text-julow-muted ${
                    isTarget ? "border-accent/30" : "border-julow-glass-border"
                  }`}
                >
                  {t("inbox.dropTasks")}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
