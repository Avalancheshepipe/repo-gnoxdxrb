import { prisma } from "@/server/db";
import { queueEmail } from "./send";
import {
  assigneeNames,
  formatPriority,
  formatStatus,
  inviteUrl,
  taskUrl,
} from "./helpers";

const DEFAULT_LOCALE: "ru" | "en" = "ru";

/** Send workspace invitation email after creating/updating an invite. */
export async function notifyProjectInvitation(args: {
  invitationId: string;
  organizationId: string;
  email: string;
  workspaceName: string;
  invitedBy: string;
  role: string;
}): Promise<void> {
  await queueEmail({
    template: "project-invitation",
    to: args.email,
    subject:
      DEFAULT_LOCALE === "ru"
        ? `Приглашение в «${args.workspaceName}» — Julow`
        : `Invitation to ${args.workspaceName} — Julow`,
    locale: DEFAULT_LOCALE,
    organizationId: args.organizationId,
    props: {
      workspaceName: args.workspaceName,
      invitedBy: args.invitedBy,
      role: args.role,
      inviteUrl: inviteUrl(args.invitationId),
    },
  });
}

type TaskSnapshot = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  tags: string[];
  projectId: string;
  project: { name: string; organizationId: string };
  assignees: {
    userId: string | null;
    user: { id: string; name: string | null; email: string } | null;
    agent: { name: string } | null;
  }[];
};

async function loadTask(taskId: string): Promise<TaskSnapshot | null> {
  return prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      tags: true,
      projectId: true,
      project: { select: { name: true, organizationId: true } },
      assignees: {
        select: {
          userId: true,
          user: { select: { id: true, name: true, email: true } },
          agent: { select: { name: true } },
        },
      },
    },
  });
}

function humanAssignees(task: TaskSnapshot) {
  return task.assignees.filter((a) => a.userId && a.user?.email);
}

/** Notify newly added human assignees. */
export async function notifyTaskAssigned(args: {
  taskId: string;
  newUserIds: string[];
  actorUserId?: string;
}): Promise<void> {
  if (!args.newUserIds.length) return;
  const task = await loadTask(args.taskId);
  if (!task) return;

  const names = assigneeNames(task.assignees);
  const url = taskUrl(task.id, task.projectId);

  for (const userId of args.newUserIds) {
    if (userId === args.actorUserId) continue;
    const assignee = task.assignees.find((a) => a.userId === userId);
    if (!assignee?.user?.email) continue;

    await queueEmail({
      template: "task-assigned",
      to: assignee.user.email,
      subject:
        DEFAULT_LOCALE === "ru"
          ? `Вам назначена задача: ${task.title}`
          : `Assigned: ${task.title}`,
      locale: DEFAULT_LOCALE,
      organizationId: task.project.organizationId,
      props: {
        assigneeName: assignee.user.name ?? assignee.user.email,
        taskTitle: task.title,
        projectName: task.project.name,
        status: formatStatus(task.status),
        priority: formatPriority(task.priority),
        tags: task.tags,
        assignees: names,
        description: task.description ?? undefined,
        taskUrl: url,
      },
    });
  }
}

/** Simple in-process debounce: skip duplicate task-updated emails within 2s. */
const recentUpdates = new Map<string, number>();
const DEBOUNCE_MS = 2000;

export async function notifyTaskUpdated(args: {
  taskId: string;
  changesSummary: string;
  excludeUserId?: string;
}): Promise<void> {
  const key = `${args.taskId}:${args.changesSummary}`;
  const now = Date.now();
  const last = recentUpdates.get(key);
  if (last && now - last < DEBOUNCE_MS) return;
  recentUpdates.set(key, now);

  const task = await loadTask(args.taskId);
  if (!task) return;

  const names = assigneeNames(task.assignees);
  const url = taskUrl(task.id, task.projectId);

  for (const a of humanAssignees(task)) {
    if (!a.user?.email) continue;
    if (a.userId === args.excludeUserId) continue;

    await queueEmail({
      template: "task-updated",
      to: a.user.email,
      subject:
        DEFAULT_LOCALE === "ru"
          ? `Задача обновлена: ${task.title}`
          : `Task updated: ${task.title}`,
      locale: DEFAULT_LOCALE,
      organizationId: task.project.organizationId,
      props: {
        recipientName: a.user.name ?? a.user.email,
        taskTitle: task.title,
        projectName: task.project.name,
        changesSummary: args.changesSummary,
        status: formatStatus(task.status),
        priority: formatPriority(task.priority),
        tags: task.tags,
        assignees: names,
        description: task.description ?? undefined,
        taskUrl: url,
      },
    });
  }
}

/** Email human assignees when a task-scoped agent run completes successfully. */
export async function notifyAgentTaskResult(args: {
  runId: string;
  taskId: string;
  agentId: string;
  agentName: string;
  resultText: string;
  fileUrl?: string;
  fileName?: string;
}): Promise<void> {
  const task = await loadTask(args.taskId);
  if (!task) return;

  // Only when the agent is an assignee on this task.
  const agentRow = await prisma.taskAssignee.findFirst({
    where: { taskId: args.taskId, agentId: args.agentId },
  });
  if (!agentRow) return;

  const url = taskUrl(task.id, task.projectId);
  const summary = args.resultText.trim() || "—";

  for (const a of humanAssignees(task)) {
    if (!a.user?.email) continue;
    await queueEmail({
      template: "agent-task-result",
      to: a.user.email,
      subject:
        DEFAULT_LOCALE === "ru"
          ? `${args.agentName} завершил работу: ${task.title}`
          : `${args.agentName} finished: ${task.title}`,
      locale: DEFAULT_LOCALE,
      organizationId: task.project.organizationId,
      props: {
        recipientName: a.user.name ?? a.user.email,
        agentName: args.agentName,
        taskTitle: task.title,
        projectName: task.project.name,
        resultSummary: summary,
        taskUrl: url,
        fileUrl: args.fileUrl,
        fileName: args.fileName,
      },
    });
  }
}

/** Build a human-readable change summary for task update emails. */
export function summarizeTaskChanges(changes: {
  status?: string;
  priority?: string;
  title?: string;
  description?: boolean;
  dueDate?: boolean;
  tags?: boolean;
  assignees?: boolean;
}): string {
  const parts: string[] = [];
  if (changes.status) parts.push(`статус → ${changes.status}`);
  if (changes.priority) parts.push(`приоритет → ${changes.priority}`);
  if (changes.title) parts.push("название");
  if (changes.description) parts.push("описание");
  if (changes.dueDate) parts.push("срок");
  if (changes.tags) parts.push("теги");
  if (changes.assignees) parts.push("исполнители");
  return parts.length ? parts.join(", ") : "обновление";
}
