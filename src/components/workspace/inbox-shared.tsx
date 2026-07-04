"use client";

import { Avatar, Chip } from "@heroui/react";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  AgentOrbAvatar,
  AgentOverflowAvatar,
} from "@/components/workspace/agent-avatar";
import type { InboxTask, TaskAssignee, TaskPriority, TaskStatus } from "@/lib/workspace-data";

export const statusColors: Record<
  InboxTask["status"],
  "default" | "accent" | "warning" | "success"
> = {
  todo: "default",
  "in-progress": "accent",
  review: "warning",
  done: "success",
};

export const priorityColors: Record<
  InboxTask["priority"],
  "default" | "accent" | "warning" | "danger"
> = {
  low: "default",
  medium: "accent",
  high: "warning",
  urgent: "danger",
};

const statusKeys: Record<TaskStatus, string> = {
  todo: "canvas.todo",
  "in-progress": "canvas.inProgress",
  review: "canvas.review",
  done: "canvas.done",
};

const priorityKeys: Record<TaskPriority, string> = {
  low: "priority.low",
  medium: "priority.medium",
  high: "priority.high",
  urgent: "priority.urgent",
};

export function statusLabel(status: TaskStatus, t: (key: string) => string) {
  return t(statusKeys[status]);
}

export function priorityLabel(priority: TaskPriority, t: (key: string) => string) {
  return t(priorityKeys[priority]);
}

export const kanbanColumns: TaskStatus[] = [
  "todo",
  "in-progress",
  "review",
  "done",
];

function assigneeInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
}

export function AssigneeAvatar({
  assignee,
  size = "sm",
}: {
  assignee: TaskAssignee;
  size?: "sm" | "md";
}) {
  if (assignee.type === "agent") {
    return (
      <AgentOrbAvatar
        seed={assignee.name}
        size={size}
        className="julow-assignee-avatar"
      />
    );
  }

  return (
    <Avatar size={size} color="default" className="julow-assignee-avatar">
      <Avatar.Fallback>{assigneeInitials(assignee.name)}</Avatar.Fallback>
    </Avatar>
  );
}

export function AssigneeStack({
  assignees,
  max = 3,
}: {
  assignees: TaskAssignee[];
  max?: number;
}) {
  const { t } = useI18n();
  const visible = assignees.slice(0, max);
  const overflow = assignees.length - max;
  const label = assignees.map((a) => a.name).join(", ");

  return (
    <div className="flex items-center" title={label}>
      <div className="flex -space-x-1.5">
        {visible.map((assignee, i) => (
          <div key={`${assignee.name}-${i}`} style={{ zIndex: max - i }}>
            <AssigneeAvatar assignee={assignee} />
          </div>
        ))}
        {overflow > 0 && (
          <AgentOverflowAvatar
            count={overflow}
            className="julow-assignee-avatar"
          />
        )}
      </div>
      <span className="ml-2 hidden truncate text-sm lg:inline">
        {assignees.length === 1
          ? assignees[0].name
          : t("inbox.assigneeCount").replace("{count}", String(assignees.length))}
      </span>
    </div>
  );
}

export function PriorityChip({ priority }: { priority: InboxTask["priority"] }) {
  const { t } = useI18n();
  return (
    <Chip
      size="sm"
      variant="soft"
      color={priorityColors[priority]}
      className="julow-priority-chip"
    >
      {priorityLabel(priority, t)}
    </Chip>
  );
}

export function StatusChip({ status }: { status: InboxTask["status"] }) {
  const { t } = useI18n();
  return (
    <Chip
      size="sm"
      variant="soft"
      color={statusColors[status]}
      className="julow-status-chip"
    >
      {statusLabel(status, t)}
    </Chip>
  );
}

export function taskMatchesFilter(task: InboxTask, filter: string) {
  if (filter === "mine") return task.assignees.some((a) => a.name === "You");
  if (filter === "agents") return task.assignees.some((a) => a.type === "agent");
  if (filter === "overdue") return task.dueLabel === "Today";
  return true;
}
