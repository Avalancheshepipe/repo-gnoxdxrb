import { priorityToDb, statusToDb } from "@/lib/task-mappers";
import {
  parseAction,
  parseTrigger,
  type AutomationActionSpec,
  type TaskStatusKey,
} from "@/server/automations/spec";
import { prisma } from "@/server/db";
import { enqueueAgentRun } from "@/server/queue/enqueue";
import { notifyOrganizationTelegram } from "@/server/telegram/send";

export type AutomationJob =
  | { type: "deadline-scan" }
  | { type: "run-automation"; automationId: string }
  | {
      type: "task-event";
      event: "created" | "status";
      organizationId: string;
      taskId: string;
      status?: string;
    }
  | { type: "reset-daily-counters" };

const DAY = 24 * 60 * 60 * 1000;

type ActionTask = {
  id: string;
  title: string;
  projectId: string;
  project: { organizationId: string; name: string };
};

const taskSelect = {
  id: true,
  title: true,
  projectId: true,
  project: { select: { organizationId: true, name: true } },
} as const;

async function telegramTargets(organizationId: string) {
  return prisma.integration.findMany({
    where: { organizationId, type: "TELEGRAM", connected: true },
    select: { config: true },
  });
}

async function firstProjectId(organizationId: string): Promise<string | null> {
  const p = await prisma.project.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return p?.id ?? null;
}

async function findTaskByTitle(
  organizationId: string,
  title: string,
): Promise<ActionTask | null> {
  return prisma.task.findFirst({
    where: {
      project: { organizationId },
      title: { equals: title, mode: "insensitive" },
    },
    select: taskSelect,
  });
}

async function findAgent(organizationId: string, name: string) {
  return prisma.agent.findFirst({
    where: { organizationId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
}

async function logAuto(
  organizationId: string,
  actor: string,
  action: string,
  target: string,
) {
  await prisma.activityLog
    .create({
      data: { organizationId, type: "AUTOMATION", actor, action, target },
    })
    .catch(() => undefined);
}

function fillTemplate(text: string, task: ActionTask | null): string {
  return text
    .replace(/\{\{?\s*task\s*\}?\}/gi, task?.title ?? "")
    .replace(/\{\{?\s*title\s*\}?\}/gi, task?.title ?? "");
}

/** Run a single automation's action. Returns a short human note. */
async function executeAutomationAction(
  automation: { id: string; name: string; organizationId: string; action: unknown },
  task: ActionTask | null,
): Promise<string> {
  const action: AutomationActionSpec = parseAction(automation.action);
  const orgId = automation.organizationId;

  switch (action.type) {
    case "telegram_message": {
      const text = fillTemplate(action.text, task) || automation.name;
      const targets = await telegramTargets(orgId);
      await notifyOrganizationTelegram(targets, text);
      await logAuto(orgId, automation.name, "sent Telegram message", task?.title ?? automation.name);
      return "sent telegram";
    }
    case "create_task": {
      const projectId = action.projectId ?? task?.projectId ?? (await firstProjectId(orgId));
      if (!projectId) return "no project";
      const created = await prisma.task.create({
        data: {
          projectId,
          title: action.title,
          description: action.description,
          priority: priorityToDb((action.priority as "low" | "medium" | "high" | "urgent") ?? "medium"),
          status: statusToDb(action.status ?? "todo"),
        },
      });
      await logAuto(orgId, automation.name, "created task", created.title);
      return `created task ${created.title}`;
    }
    case "set_task_status": {
      const target =
        task ?? (action.taskTitle ? await findTaskByTitle(orgId, action.taskTitle) : null);
      if (!target) return "no task";
      await prisma.task.update({
        where: { id: target.id },
        data: { status: statusToDb(action.status) },
      });
      await logAuto(orgId, automation.name, `set status ${action.status}`, target.title);
      return `status → ${action.status}`;
    }
    case "assign_agent": {
      const target =
        task ?? (action.taskTitle ? await findTaskByTitle(orgId, action.taskTitle) : null);
      if (!target) return "no task";
      const agent = await findAgent(orgId, action.agentName);
      if (!agent) return `no agent ${action.agentName}`;
      const existing = await prisma.taskAssignee.findFirst({
        where: { taskId: target.id, agentId: agent.id },
      });
      if (!existing) {
        await prisma.taskAssignee.create({
          data: { taskId: target.id, agentId: agent.id },
        });
      }
      await logAuto(orgId, automation.name, `assigned ${agent.name}`, target.title);
      return `assigned ${agent.name}`;
    }
    case "run_agent": {
      const agent = await findAgent(orgId, action.agentName);
      if (!agent) return `no agent ${action.agentName}`;
      const run = await prisma.agentRun.create({
        data: {
          agentId: agent.id,
          taskId: task?.id ?? null,
          status: "QUEUED",
          input: {
            prompt: fillTemplate(action.prompt, task),
            projectId: action.projectId ?? task?.projectId ?? null,
          },
        },
      });
      await enqueueAgentRun(run.id);
      await logAuto(orgId, automation.name, `ran agent ${agent.name}`, task?.title ?? automation.name);
      return `queued ${agent.name}`;
    }
    case "post_activity": {
      const text = fillTemplate(action.text, task);
      await logAuto(orgId, automation.name, text || "ran", task?.title ?? automation.name);
      return "posted activity";
    }
    case "custom":
    default: {
      await logAuto(
        orgId,
        automation.name,
        action.label ? `ran: ${action.label}` : "ran automation",
        task?.title ?? automation.name,
      );
      return "ran (custom)";
    }
  }
}

async function bumpRun(automationId: string) {
  await prisma.automation
    .update({
      where: { id: automationId },
      data: { runsToday: { increment: 1 }, lastRunAt: new Date() },
    })
    .catch(() => undefined);
}

/** Scheduled (date/time + recurring) automations call this. */
export async function runAutomationById(automationId: string): Promise<void> {
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
  });
  if (!automation || !automation.enabled) return;
  await executeAutomationAction(automation, null);
  await bumpRun(automation.id);
}

/** Event-triggered (task created / status changed) automations. */
async function handleTaskEvent(job: Extract<AutomationJob, { type: "task-event" }>): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: job.taskId },
    select: taskSelect,
  });
  if (!task) return;
  const statusKey = job.status
    ? (job.status.toLowerCase().replace(/_/g, "-") as TaskStatusKey)
    : undefined;

  const automations = await prisma.automation.findMany({
    where: { organizationId: job.organizationId, enabled: true },
  });
  for (const automation of automations) {
    const trigger = parseTrigger(automation.trigger);
    const matches =
      (job.event === "created" &&
        trigger.type === "task_created" &&
        (!trigger.projectId || trigger.projectId === task.projectId)) ||
      (job.event === "status" &&
        trigger.type === "task_status" &&
        trigger.status === statusKey);
    if (!matches) continue;
    await executeAutomationAction(automation, task).catch((err) =>
      console.error(`[automation ${automation.id}] action failed`, err),
    );
    await bumpRun(automation.id);
  }
}

async function runDueSoonAutomations(now: Date): Promise<void> {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const automations = await prisma.automation.findMany({ where: { enabled: true } });
  for (const automation of automations) {
    const trigger = parseTrigger(automation.trigger);
    if (trigger.type !== "task_due_soon") continue;
    const horizon = new Date(now.getTime() + trigger.withinHours * 60 * 60 * 1000);
    const due = await prisma.task.findMany({
      where: {
        status: { not: "DONE" },
        dueDate: { gte: now, lte: horizon },
        project: { organizationId: automation.organizationId },
      },
      select: taskSelect,
      take: 10,
    });
    for (const task of due) {
      // De-dupe: skip if this automation already fired for this task today.
      const already = await prisma.activityLog.findFirst({
        where: {
          organizationId: automation.organizationId,
          actor: automation.name,
          target: task.title,
          action: "due-soon fired",
          createdAt: { gte: startToday },
        },
        select: { id: true },
      });
      if (already) continue;
      await executeAutomationAction(automation, task).catch((err) =>
        console.error(`[automation ${automation.id}] due-soon action failed`, err),
      );
      await logAuto(automation.organizationId, automation.name, "due-soon fired", task.title);
      await bumpRun(automation.id);
    }
  }
}

/**
 * Scan for tasks due within 24h (escalate) and overdue tasks (suggest agent),
 * then run any task_due_soon automations. Runs on a repeatable schedule.
 */
export async function runDeadlineScan(): Promise<{ flagged: number }> {
  const now = new Date();
  const soon = new Date(now.getTime() + DAY);

  const dueSoon = await prisma.task.findMany({
    where: { status: { not: "DONE" }, dueDate: { gte: now, lte: soon } },
    include: { project: { select: { organizationId: true, name: true } } },
  });

  for (const task of dueSoon) {
    await prisma.activityLog.create({
      data: {
        organizationId: task.project.organizationId,
        type: "AUTOMATION",
        actor: "Deadline AI",
        action: "flagged due soon",
        target: task.title,
      },
    });
    const targets = await telegramTargets(task.project.organizationId);
    await notifyOrganizationTelegram(
      targets,
      `⏰ <b>${task.title}</b> is due soon in ${task.project.name}.`,
    );
  }

  const overdue = await prisma.task.findMany({
    where: { status: { notIn: ["DONE"] }, dueDate: { lt: now } },
    include: {
      project: { select: { organizationId: true, name: true } },
      assignees: { where: { agentId: { not: null } }, select: { agentId: true } },
    },
    take: 25,
  });

  for (const task of overdue) {
    const agentId = task.assignees[0]?.agentId;
    if (!agentId) continue;
    const run = await prisma.agentRun.create({
      data: {
        agentId,
        taskId: task.id,
        status: "QUEUED",
        input: {
          prompt: `Task "${task.title}" is overdue. Review it, take the next concrete action, and post a brief status update.`,
        },
      },
    });
    await enqueueAgentRun(run.id);
    await prisma.activityLog.create({
      data: {
        organizationId: task.project.organizationId,
        type: "AUTOMATION",
        actor: "Deadline AI",
        action: "handed overdue task to agent",
        target: task.title,
      },
    });
  }

  await runDueSoonAutomations(now).catch((err) =>
    console.error("[automation] due-soon scan failed", err),
  );

  return { flagged: dueSoon.length };
}

export async function resetDailyCounters(): Promise<void> {
  await prisma.automation.updateMany({ data: { runsToday: 0 } });
}

export async function processAutomationJob(job: AutomationJob): Promise<void> {
  switch (job.type) {
    case "deadline-scan":
      await runDeadlineScan();
      return;
    case "run-automation":
      await runAutomationById(job.automationId);
      return;
    case "task-event":
      await handleTaskEvent(job);
      return;
    case "reset-daily-counters":
      await resetDailyCounters();
      return;
  }
}
