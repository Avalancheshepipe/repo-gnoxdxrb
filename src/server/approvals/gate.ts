import { findFreeSlot } from "@/lib/canvas-layout";
import { priorityToDb, statusToDb } from "@/lib/task-mappers";
import { executeCreateDocument, type ActionContext } from "@/server/ai/actions";
import { prisma } from "@/server/db";
import { enqueueAgentRun } from "@/server/queue/enqueue";
import type {
  ApprovalActionType,
  ApprovalLevel,
} from "@/generated/prisma/enums";
import type { ApprovalRequest } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

/** How long a pending request waits for a decision before expiring. */
export const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Workspace defaults when no explicit rule exists. Write actions that leave
 * the workspace (email, GitHub, Devin) require approval out of the box;
 * internal workspace edits run automatically.
 */
export const DEFAULT_APPROVAL_LEVELS: Record<ApprovalActionType, ApprovalLevel> = {
  CREATE_TASK: "AUTO",
  UPDATE_TASK: "AUTO",
  DELETE_TASK: "APPROVE",
  CREATE_DOCUMENT: "AUTO",
  SEND_EMAIL: "APPROVE",
  SPLIT_TASK: "AUTO",
  CANVAS_NOTE: "AUTO",
  GITHUB_PUSH: "APPROVE",
  DEVIN_DELEGATE: "APPROVE",
};

export async function getApprovalLevel(
  organizationId: string,
  actionType: ApprovalActionType,
): Promise<ApprovalLevel> {
  const rule = await prisma.approvalRule.findUnique({
    where: { organizationId_actionType: { organizationId, actionType } },
    select: { level: true },
  });
  return rule?.level ?? DEFAULT_APPROVAL_LEVELS[actionType];
}

export type GateContext = {
  organizationId: string;
  agentId?: string | null;
  agentName: string;
  runId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
};

export type GateOutcome =
  | { decision: "auto" }
  | { decision: "blocked"; message: string }
  | { decision: "pending"; requestId: string; message: string };

/**
 * Check the workspace's approval rule for an action. On APPROVE it records an
 * ApprovalRequest (the action's inputs are stored and replayed on approval)
 * and tells the agent to continue without doing the action itself.
 */
export async function gateAction(
  ctx: GateContext,
  actionType: ApprovalActionType,
  actionData: Record<string, unknown>,
): Promise<GateOutcome> {
  const level = await getApprovalLevel(ctx.organizationId, actionType);
  if (level === "AUTO") return { decision: "auto" };
  if (level === "BLOCKED") {
    return {
      decision: "blocked",
      message: `Action "${actionType}" is blocked by workspace policy. Do not retry it.`,
    };
  }
  const request = await prisma.approvalRequest.create({
    data: {
      organizationId: ctx.organizationId,
      agentId: ctx.agentId ?? null,
      agentRunId: ctx.runId ?? null,
      actionType,
      actionData: {
        ...actionData,
        _context: {
          projectId: ctx.projectId ?? null,
          taskId: ctx.taskId ?? null,
        },
      } as Prisma.InputJsonValue,
      requestedBy: ctx.agentName,
      expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
    },
  });
  await prisma.activityLog.create({
    data: {
      organizationId: ctx.organizationId,
      type: "AGENT",
      actor: ctx.agentName,
      action: "requested approval for",
      target: actionType.toLowerCase().replace(/_/g, " "),
      metadata: { approvalRequestId: request.id },
    },
  });
  return {
    decision: "pending",
    requestId: request.id,
    message:
      `Action "${actionType}" requires user approval. An approval request ` +
      `(${request.id}) was created — the action will run once a user approves ` +
      `it. Continue with the rest of your objective; do NOT retry this action.`,
  };
}

/** Mark overdue pending requests as EXPIRED. Called lazily before reads. */
export async function expireStaleRequests(organizationId: string): Promise<void> {
  await prisma.approvalRequest.updateMany({
    where: {
      organizationId,
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED", decidedAt: new Date() },
  });
}

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const STATUSES = ["todo", "in-progress", "review", "done"] as const;

function asPriority(v: unknown): (typeof PRIORITIES)[number] {
  return PRIORITIES.includes(v as (typeof PRIORITIES)[number])
    ? (v as (typeof PRIORITIES)[number])
    : "medium";
}

function asStatus(v: unknown): (typeof STATUSES)[number] {
  return STATUSES.includes(v as (typeof STATUSES)[number])
    ? (v as (typeof STATUSES)[number])
    : "todo";
}

type StoredContext = { projectId?: string | null; taskId?: string | null };

function storedContext(data: Record<string, unknown>): StoredContext {
  const raw = data._context;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as StoredContext;
  }
  return {};
}

async function resolveProjectId(
  organizationId: string,
  projectId?: string | null,
): Promise<string> {
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (project) return project.id;
  }
  const first = await prisma.project.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!first) throw new Error("No project exists in this workspace.");
  return first.id;
}

/**
 * Replay an APPROVED request's stored action. Each case mirrors the
 * corresponding autonomous agent tool in src/server/ai/tools.ts.
 */
export async function executeApprovedAction(
  request: ApprovalRequest,
): Promise<Prisma.InputJsonValue> {
  const data = request.actionData as Record<string, unknown>;
  const ctx = storedContext(data);
  const organizationId = request.organizationId;

  switch (request.actionType) {
    case "CREATE_TASK": {
      const projectId = await resolveProjectId(
        organizationId,
        (data.projectId as string | undefined) ?? ctx.projectId,
      );
      const task = await prisma.task.create({
        data: {
          projectId,
          title: String(data.title ?? "Untitled"),
          description: (data.description as string | undefined) ?? undefined,
          priority: priorityToDb(asPriority(data.priority)),
          status: statusToDb(asStatus(data.status)),
          ...(request.agentId
            ? { assignees: { create: { agentId: request.agentId } } }
            : {}),
        },
      });
      return { taskId: task.id, title: task.title };
    }

    case "UPDATE_TASK": {
      const taskId = String(data.taskId ?? "");
      const task = await prisma.task.findFirst({
        where: { id: taskId, project: { organizationId } },
        select: { id: true },
      });
      if (!task) throw new Error("Task not found");
      await prisma.task.update({
        where: { id: taskId },
        data: {
          ...(data.status ? { status: statusToDb(asStatus(data.status)) } : {}),
          ...(data.priority
            ? { priority: priorityToDb(asPriority(data.priority)) }
            : {}),
          ...(data.title ? { title: String(data.title) } : {}),
        },
      });
      return { taskId };
    }

    case "DELETE_TASK": {
      const taskId = String(data.taskId ?? "");
      const task = await prisma.task.findFirst({
        where: { id: taskId, project: { organizationId } },
        select: { id: true },
      });
      if (!task) throw new Error("Task not found");
      await prisma.task.update({
        where: { id: taskId },
        data: { archivedAt: data.archived === false ? null : new Date() },
      });
      return { taskId };
    }

    case "CREATE_DOCUMENT": {
      const actionCtx: ActionContext = {
        organizationId,
        agentId: request.agentId,
        agentName: request.requestedBy,
        projectId: ctx.projectId ?? undefined,
      };
      const r = await executeCreateDocument(actionCtx, {
        format: String(data.format ?? "word") as "word" | "excel" | "pdf",
        title: String(data.title ?? "Document"),
        content: data.content as {
          sections?: {
            heading?: string;
            paragraphs?: string[];
            bullets?: string[];
          }[];
          sheet?: { columns: string[]; rows: (string | number)[][] };
        },
        taskId: (data.taskId as string | undefined) ?? ctx.taskId ?? undefined,
      });
      return { url: r.url, filename: r.filename };
    }

    case "CANVAS_NOTE": {
      const projectId = await resolveProjectId(
        organizationId,
        (data.projectId as string | undefined) ?? ctx.projectId,
      );
      const existing = await prisma.canvasNode.findMany({
        where: { projectId },
        select: { x: true, y: true },
      });
      const slot = findFreeSlot(existing.map((n) => ({ x: n.x, y: n.y })));
      const note = await prisma.canvasNode.create({
        data: {
          projectId,
          type: "NOTE",
          title: String(data.title ?? "Note"),
          subtitle: (data.body as string | undefined) ?? undefined,
          x: slot.x,
          y: slot.y,
          width: 240,
        },
      });
      return { nodeId: note.id };
    }

    case "SPLIT_TASK": {
      if (!request.agentId) throw new Error("Agent no longer exists");
      const subObjectives = Array.isArray(data.subObjectives)
        ? (data.subObjectives as { objective: string; briefTool?: string }[])
        : [];
      const childRuns: string[] = [];
      for (const sub of subObjectives.slice(0, 4)) {
        const childRun = await prisma.agentRun.create({
          data: {
            agentId: request.agentId,
            parentRunId: request.agentRunId,
            status: "QUEUED",
            input: {
              prompt: sub.objective,
              projectId: ctx.projectId ?? null,
              briefTool: sub.briefTool ?? "general",
            },
          },
        });
        await enqueueAgentRun(childRun.id);
        childRuns.push(childRun.id);
      }
      return { childRuns };
    }

    // Future integrations (Phase 3+). Rules for these can already be
    // configured, but there is no executor yet.
    case "SEND_EMAIL":
    case "GITHUB_PUSH":
    case "DEVIN_DELEGATE":
      throw new Error(
        `No executor is implemented for action type ${request.actionType} yet.`,
      );

    default:
      throw new Error(`Unknown action type ${request.actionType}`);
  }
}
