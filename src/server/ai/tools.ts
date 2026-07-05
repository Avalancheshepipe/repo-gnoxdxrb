import { tool } from "ai";
import { z } from "zod";
import { findFreeSlot } from "@/lib/canvas-layout";
import { priorityToDb, statusToDb } from "@/lib/task-mappers";
import {
  executeCreateDocument,
  executeReport,
  executeResearch,
  executeReviewTask,
  executeValidateTask,
  type ActionContext,
} from "@/server/ai/actions";
import {
  normalizeAgentTools,
  workerToolNames,
  type ToolKey,
} from "@/server/ai/capabilities";
import { gateAction, type GateOutcome } from "@/server/approvals/gate";
import { prisma } from "@/server/db";
import { enqueueAgentRun } from "@/server/queue/enqueue";
import type { ApprovalActionType } from "@/generated/prisma/enums";

export type AgentToolContext = {
  organizationId: string;
  agentId: string;
  agentName: string;
  userId?: string;
  projectId?: string;
  /** When the run is scoped to a task, created documents attach to it. */
  taskId?: string;
  /** The current run, used to link delegated child runs. */
  runId?: string;
  /** The agent's configured tools (Json array). Filters the toolset. */
  tools?: unknown;
  /**
   * Extra capabilities to grant beyond the agent's config — e.g. a per-task
   * brief that asks for research/document work. Ensures a briefed agent gets
   * the tool its brief needs even if its base config doesn't list it.
   */
  extraCapabilities?: ToolKey[];
};

async function resolveProjectId(
  ctx: AgentToolContext,
  projectId?: string,
): Promise<string> {
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (project) return project.id;
  }
  if (ctx.projectId) return ctx.projectId;
  const first = await prisma.project.findFirst({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!first) throw new Error("No project exists in this workspace.");
  return first.id;
}

async function logActivity(
  ctx: AgentToolContext,
  action: string,
  target: string,
) {
  await prisma.activityLog.create({
    data: {
      organizationId: ctx.organizationId,
      type: "AGENT",
      actor: ctx.agentName,
      action,
      target,
    },
  });
}

type GateResult =
  | { ok: false; blocked: true; error: string }
  | { ok: true; pendingApproval: true; approvalRequestId: string; message: string };

/**
 * Build the toolset an agent can call. Tools are FILTERED by the agent's
 * configured capabilities (agent.tools), so each agent only gets what it's set
 * up for. `list_tasks` is always available (read-only). Falls back to a sane
 * default set when no recognizable tools are configured.
 */
export function createAgentTools(ctx: AgentToolContext) {
  const keys = [
    ...normalizeAgentTools(ctx.tools),
    ...(ctx.extraCapabilities ?? []),
  ];
  const allowed = workerToolNames([...new Set(keys)]);
  const actionCtx: ActionContext = {
    organizationId: ctx.organizationId,
    agentId: ctx.agentId,
    agentName: ctx.agentName,
    projectId: ctx.projectId,
  };

  const gateCtx = {
    organizationId: ctx.organizationId,
    agentId: ctx.agentId,
    agentName: ctx.agentName,
    runId: ctx.runId,
    projectId: ctx.projectId,
    taskId: ctx.taskId,
  };

  /** Approval-gate check for a write tool; null means proceed (AUTO). */
  async function checkGate(
    actionType: ApprovalActionType,
    actionData: Record<string, unknown>,
  ): Promise<GateResult | null> {
    const outcome: GateOutcome = await gateAction(gateCtx, actionType, actionData);
    if (outcome.decision === "auto") return null;
    if (outcome.decision === "blocked") {
      return { ok: false, blocked: true, error: outcome.message };
    }
    return {
      ok: true,
      pendingApproval: true,
      approvalRequestId: outcome.requestId,
      message: outcome.message,
    };
  }

  const defs = {
    list_tasks: tool({
      description:
        "List tasks in the workspace. Optionally filter by status. Use this to understand current work before acting.",
      inputSchema: z.object({
        status: z
          .enum(["todo", "in-progress", "review", "done"])
          .optional()
          .describe("Filter by task status"),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ status, limit }) => {
        const tasks = await prisma.task.findMany({
          where: {
            project: { organizationId: ctx.organizationId },
            ...(status ? { status: statusToDb(status) } : {}),
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            project: { select: { name: true } },
          },
          take: limit,
          orderBy: { createdAt: "desc" },
        });
        return tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          project: t.project.name,
        }));
      },
    }),

    create_task: tool({
      description:
        "Create a new task in the workspace. Returns the created task id.",
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(5000).optional(),
        projectId: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        status: z
          .enum(["todo", "in-progress", "review", "done"])
          .default("todo"),
      }),
      execute: async ({ title, description, projectId, priority, status }) => {
        const gated = await checkGate("CREATE_TASK", {
          title,
          description,
          projectId,
          priority,
          status,
        });
        if (gated) return gated;
        const resolved = await resolveProjectId(ctx, projectId);
        const task = await prisma.task.create({
          data: {
            projectId: resolved,
            title,
            description,
            priority: priorityToDb(priority),
            status: statusToDb(status),
            assignees: { create: { agentId: ctx.agentId } },
          },
        });
        await logActivity(ctx, "created task", title);
        return { id: task.id, title: task.title };
      },
    }),

    update_task: tool({
      description:
        "Update a task by id: its status, priority and/or title (rename). Pass `title` to rename.",
      inputSchema: z.object({
        taskId: z.string().min(1),
        status: z.enum(["todo", "in-progress", "review", "done"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        title: z.string().min(1).max(200).optional().describe("New title (rename)"),
      }),
      execute: async ({ taskId, status, priority, title }) => {
        const gated = await checkGate("UPDATE_TASK", {
          taskId,
          status,
          priority,
          title,
        });
        if (gated) return gated;
        const task = await prisma.task.findFirst({
          where: { id: taskId, project: { organizationId: ctx.organizationId } },
          select: { id: true, title: true },
        });
        if (!task) return { ok: false, error: "Task not found" };
        await prisma.task.update({
          where: { id: taskId },
          data: {
            ...(status ? { status: statusToDb(status) } : {}),
            ...(priority ? { priority: priorityToDb(priority) } : {}),
            ...(title ? { title } : {}),
          },
        });
        await logActivity(ctx, "updated task", title ?? task.title);
        return { ok: true };
      },
    }),

    archive_task: tool({
      description:
        "Archive or restore a task by id. Archived tasks are hidden from the inbox and canvas but kept in the workspace.",
      inputSchema: z.object({
        taskId: z.string().min(1),
        archived: z.boolean().default(true),
      }),
      execute: async ({ taskId, archived }) => {
        const gated = await checkGate("DELETE_TASK", { taskId, archived });
        if (gated) return gated;
        const task = await prisma.task.findFirst({
          where: { id: taskId, project: { organizationId: ctx.organizationId } },
          select: { id: true, title: true },
        });
        if (!task) return { ok: false, error: "Task not found" };
        await prisma.task.update({
          where: { id: taskId },
          data: { archivedAt: archived ? new Date() : null },
        });
        await logActivity(ctx, archived ? "archived task" : "restored task", task.title);
        return { ok: true };
      },
    }),

    add_canvas_note: tool({
      description:
        "Add a note to the project canvas to capture an insight or summary. Optionally link it to a task by id.",
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        body: z.string().max(2000).optional(),
        projectId: z.string().optional(),
        linkTaskId: z.string().optional(),
      }),
      execute: async ({ title, body, projectId, linkTaskId }) => {
        const gated = await checkGate("CANVAS_NOTE", {
          title,
          body,
          projectId,
          linkTaskId,
        });
        if (gated) return gated;
        const resolved = await resolveProjectId(ctx, projectId);
        const existing = await prisma.canvasNode.findMany({
          where: { projectId: resolved },
          select: { x: true, y: true },
        });
        const doc = await prisma.canvasDoc
          .findUnique({
            where: { projectId: resolved },
            select: { boardLayout: true },
          })
          .catch(() => null);
        const boardLayout =
          doc?.boardLayout &&
          typeof doc.boardLayout === "object" &&
          !Array.isArray(doc.boardLayout)
            ? Object.values(
                doc.boardLayout as Record<string, { x: number; y: number }>,
              )
            : [];
        const slot = findFreeSlot([
          ...existing.map((n) => ({ x: n.x, y: n.y })),
          ...boardLayout,
        ]);
        const note = await prisma.canvasNode.create({
          data: {
            projectId: resolved,
            type: "NOTE",
            title,
            subtitle: body,
            x: slot.x,
            y: slot.y,
            width: 240,
          },
        });
        if (linkTaskId) {
          const taskNode = await prisma.canvasNode.findFirst({
            where: { taskId: linkTaskId, projectId: resolved },
            select: { id: true },
          });
          if (taskNode) {
            await prisma.canvasEdge.create({
              data: {
                projectId: resolved,
                sourceId: taskNode.id,
                targetId: note.id,
                kind: "PRODUCES",
              },
            });
          }
        }
        await logActivity(ctx, "added note on", title);
        return { id: note.id };
      },
    }),

    split_task: tool({
      description:
        "Split a large objective into parallel sub-tasks. Each sub-objective runs as an autonomous child run of yourself (the same agent) in the background. Use this when a task has multiple independent parts that can be worked on concurrently. Max 4 concurrent sub-runs.",
      inputSchema: z.object({
        subObjectives: z
          .array(
            z.object({
              objective: z
                .string()
                .min(1)
                .max(2000)
                .describe("Clear instructions for one sub-task"),
              briefTool: z
                .enum(["research", "document", "report", "review", "general"])
                .optional()
                .describe("The type of work this sub-task involves"),
            }),
          )
          .min(1)
          .max(4)
          .describe("1-4 independent sub-objectives to run in parallel"),
      }),
      execute: async ({ subObjectives }) => {
        const gated = await checkGate("SPLIT_TASK", { subObjectives });
        if (gated) return gated;
        const self = await prisma.agent.findFirst({
          where: { id: ctx.agentId },
          select: { id: true, name: true },
        });
        if (!self) {
          return { ok: false, error: "Agent not found" };
        }
        const childRuns: { runId: string; objective: string }[] = [];
        for (const sub of subObjectives) {
          const childRun = await prisma.agentRun.create({
            data: {
              agentId: self.id,
              parentRunId: ctx.runId ?? null,
              status: "QUEUED",
              input: {
                prompt: sub.objective,
                projectId: ctx.projectId ?? null,
                briefTool: sub.briefTool ?? "general",
              },
            },
          });
          await enqueueAgentRun(childRun.id);
          childRuns.push({ runId: childRun.id, objective: sub.objective });
        }
        await logActivity(
          ctx,
          "split into",
          `${childRuns.length} parallel sub-tasks`,
        );
        return {
          ok: true,
          childRuns,
        };
      },
    }),

    research: tool({
      description:
        "Search the web for up-to-date information and save a sourced summary to the canvas. Budget: results are capped.",
      inputSchema: z.object({
        query: z.string().min(1).max(300),
        maxResults: z.number().int().min(1).max(8).optional(),
      }),
      execute: async ({ query, maxResults }) => {
        const r = await executeResearch(actionCtx, {
          query,
          maxResults,
          save: true,
        });
        return {
          summary: r.summary,
          sources: r.sources.map((s) => ({ title: s.title, url: s.url })),
        };
      },
    }),

    create_document: tool({
      description:
        "Create a REAL Word, Excel, or PDF document and return a download link. Provide the content directly: `sections` for Word/PDF, `sheet` for Excel.",
      inputSchema: z.object({
        format: z.enum(["word", "excel", "pdf"]),
        title: z.string().min(1).max(160),
        sections: z
          .array(
            z.object({
              heading: z.string().optional(),
              paragraphs: z.array(z.string()).optional(),
              bullets: z.array(z.string()).optional(),
            }),
          )
          .optional()
          .describe("Word document content"),
        sheet: z
          .object({
            columns: z.array(z.string()),
            rows: z.array(z.array(z.union([z.string(), z.number()]))),
          })
          .optional()
          .describe("Excel workbook content"),
        taskId: z.string().optional(),
      }),
      execute: async ({ format, title, sections, sheet, taskId }) => {
        const gated = await checkGate("CREATE_DOCUMENT", {
          format,
          title,
          content: { sections, sheet },
          taskId: taskId ?? ctx.taskId,
        });
        if (gated) return gated;
        const r = await executeCreateDocument(actionCtx, {
          format,
          title,
          content: { sections, sheet },
          taskId: taskId ?? ctx.taskId,
        });
        return { url: r.url, filename: r.filename };
      },
    }),

    create_report: tool({
      description:
        "Compile a report from REAL workspace data (tasks, agents, automations, activity). Optionally export an Excel file.",
      inputSchema: z.object({
        title: z.string().max(160).optional(),
        format: z.enum(["markdown", "excel"]).optional(),
      }),
      execute: async ({ title, format }) => {
        const r = await executeReport(actionCtx, { title, format });
        return { ok: true, url: r.url, summary: r.markdown.slice(0, 1200) };
      },
    }),

    review_task: tool({
      description:
        "Review a task against its goal/criteria and record an approve / changes-requested verdict on the task.",
      inputSchema: z.object({
        taskId: z.string().min(1),
        criteria: z.string().max(2000).optional(),
      }),
      execute: async ({ taskId, criteria }) =>
        executeReviewTask(actionCtx, { taskId, criteria }),
    }),

    validate_task: tool({
      description:
        "Validate a task/spec against acceptance criteria (a checklist) and record the pass/fail outcome on the task.",
      inputSchema: z.object({
        taskId: z.string().min(1),
        criteria: z.string().max(2000).optional(),
      }),
      execute: async ({ taskId, criteria }) =>
        executeValidateTask(actionCtx, { taskId, criteria }),
    }),
  };

  const enabled: Record<string, (typeof defs)[keyof typeof defs]> = {
    list_tasks: defs.list_tasks,
  };
  for (const name of Object.keys(defs) as (keyof typeof defs)[]) {
    if (name === "list_tasks") continue;
    if (allowed.has(name)) enabled[name] = defs[name];
  }
  return enabled;
}

export type AgentTools = ReturnType<typeof createAgentTools>;
