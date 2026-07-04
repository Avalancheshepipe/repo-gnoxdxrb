import { z } from "zod";
import {
  briefContentToDb,
  dbBriefToContent,
  dbTaskToInbox,
  parseAgentBrief,
  priorityToDb,
  statusToDb,
} from "@/lib/task-mappers";
import type { TaskAgentBrief } from "@/lib/workspace-data";
import {
  notifyTaskAssigned,
  notifyTaskUpdated,
  summarizeTaskChanges,
} from "@/server/mail/notifications";
import { formatPriority, formatStatus } from "@/server/mail/helpers";
import { emitTaskEvent, enqueueAgentRun } from "@/server/queue/enqueue";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { assertMember, assertProjectAccess } from "@/server/trpc/util";

const statusEnum = z.enum(["todo", "in-progress", "review", "done"]);
const priorityEnum = z.enum(["low", "medium", "high", "urgent"]);
const briefToolEnum = z.enum([
  "general",
  "research",
  "document",
  "report",
  "review",
]);

const briefOptionsInput = z
  .object({
    webSearch: z.boolean().optional(),
    researchQuery: z.string().max(500).optional(),
    format: z.enum(["word", "excel", "pdf"]).optional(),
    documentSpec: z.string().max(4000).optional(),
  })
  .optional();

/** Per-(task, agent) brief content: instructions + chosen capability + extras. */
const briefContentInput = z.object({
  instructions: z.string().max(4000).optional(),
  tool: briefToolEnum.optional(),
  options: briefOptionsInput,
  knowledge: z.string().max(8000).optional(),
});

const agentBriefInput = z.object({
  agentId: z.string().optional(),
  instructions: z.string().max(4000).optional(),
  tool: briefToolEnum.optional(),
  options: briefOptionsInput,
  knowledge: z.string().max(8000).optional(),
});

const taskInclude = {
  project: { select: { name: true } },
  assignees: {
    include: {
      user: { select: { id: true, name: true } },
      agent: { select: { id: true, name: true } },
    },
  },
} as const;

/** Build the autonomous-run prompt from a task + its agent brief. */
function buildAssignmentPrompt(
  task: { id: string; title: string; description: string | null },
  brief: TaskAgentBrief | null,
  projectName: string,
): string {
  const parts: string[] = [
    "You have been assigned to work on the following task and complete it.",
    `Task: "${task.title}" (id: ${task.id}) in project "${projectName}".`,
  ];
  if (task.description) parts.push(`Task description:\n${task.description}`);
  if (brief?.instructions) parts.push(`Your instructions / context:\n${brief.instructions}`);
  if (brief?.knowledge) parts.push(`Extra knowledge to use:\n${brief.knowledge}`);

  switch (brief?.tool) {
    case "research":
      parts.push(
        `Use your web research tool to research: ${
          brief.options?.researchQuery || brief.instructions || task.title
        }. Save a concise, sourced summary.`,
      );
      break;
    case "document":
      parts.push(
        `Create a ${
          brief.options?.format === "excel" ? "Excel" : brief.options?.format === "pdf" ? "PDF" : "Word"
        } document for this task using your document tool. It must contain: ${
          brief.options?.documentSpec || brief.instructions || task.title
        }. Attach it to this task (taskId: ${task.id}).`,
      );
      break;
    case "report":
      parts.push("Compile a report from the workspace data relevant to this task.");
      break;
    case "review":
      parts.push(
        "Review this task against its goal/acceptance criteria and record a verdict.",
      );
      break;
    default:
      parts.push(
        "Proceed and use your available tools to make progress, then report what you did.",
      );
  }
  parts.push(
    "If you are missing information you need to finish, clearly state what you need (a clarifying question).",
  );
  return parts.join("\n\n");
}

export const taskRouter = router({
  /** Tasks for a workspace, optionally scoped to one project, for the Inbox. */
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        projectId: z.string().min(1).optional(),
        /** active (default): hide archived; archived: only archived; all: both. */
        archived: z.enum(["active", "archived", "all"]).default("active"),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const archivedFilter =
        input.archived === "archived"
          ? { archivedAt: { not: null } }
          : input.archived === "all"
            ? {}
            : { archivedAt: null };
      const tasks = await ctx.prisma.task.findMany({
        where: {
          ...archivedFilter,
          project: {
            organizationId: input.organizationId,
            ...(input.projectId ? { id: input.projectId } : {}),
          },
        },
        include: taskInclude,
        orderBy: [{ createdAt: "asc" }],
      });
      return tasks.map(dbTaskToInbox);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({
        where: { id: input.id },
        include: { ...taskInclude, attachments: true },
      });
      if (!task) return null;
      await assertProjectAccess(ctx.user.id, task.projectId);
      return { ...dbTaskToInbox(task), attachments: task.attachments };
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        title: z.string().min(1).max(200),
        description: z.string().max(10_000).optional(),
        status: statusEnum.default("todo"),
        priority: priorityEnum.default("medium"),
        dueDate: z.string().datetime().nullish(),
        tags: z.array(z.string()).default([]),
        assigneeUserIds: z.array(z.string()).default([]),
        assigneeAgentIds: z.array(z.string()).default([]),
        agentBrief: agentBriefInput.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await assertProjectAccess(ctx.user.id, input.projectId, [
        "owner",
        "admin",
        "member",
      ]);

      const [validAgents, validMembers] = await Promise.all([
        input.assigneeAgentIds.length
          ? ctx.prisma.agent.findMany({
              where: { id: { in: input.assigneeAgentIds }, organizationId: project.organizationId },
              select: { id: true },
            })
          : Promise.resolve([]),
        input.assigneeUserIds.length
          ? ctx.prisma.member.findMany({
              where: { organizationId: project.organizationId, userId: { in: input.assigneeUserIds } },
              select: { userId: true },
            })
          : Promise.resolve([]),
      ]);

      const task = await ctx.prisma.task.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          status: statusToDb(input.status),
          priority: priorityToDb(input.priority),
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          tags: input.tags,
          ...(input.agentBrief
            ? { agentBrief: { ...input.agentBrief, updatedAt: new Date().toISOString() } }
            : {}),
          assignees: {
            create: [
              ...validMembers.map((m) => ({ userId: m.userId })),
              ...validAgents.map((a) => ({ agentId: a.id })),
            ],
          },
        },
        include: taskInclude,
      });
      await emitTaskEvent({
        event: "created",
        organizationId: project.organizationId,
        taskId: task.id,
      });
      void notifyTaskAssigned({
        taskId: task.id,
        newUserIds: validMembers.map((m) => m.userId),
        actorUserId: ctx.user.id,
      }).catch((err) => console.error("[email] task assigned", err));
      return dbTaskToInbox(task);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(10_000).nullable().optional(),
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        dueDate: z.string().datetime().nullable().optional(),
        tags: z.array(z.string()).optional(),
        agentBrief: agentBriefInput.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.task.findUnique({
        where: { id: input.id },
        select: {
          projectId: true,
          status: true,
          priority: true,
          title: true,
          description: true,
          dueDate: true,
          tags: true,
        },
      });
      if (!existing) {
        throw new Error("Task not found");
      }
      const project = await assertProjectAccess(ctx.user.id, existing.projectId, [
        "owner",
        "admin",
        "member",
      ]);

      const task = await ctx.prisma.task.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.status ? { status: statusToDb(input.status) } : {}),
          ...(input.priority ? { priority: priorityToDb(input.priority) } : {}),
          ...(input.dueDate !== undefined
            ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
            : {}),
          ...(input.tags ? { tags: input.tags } : {}),
          ...(input.agentBrief !== undefined
            ? {
                agentBrief: input.agentBrief
                  ? { ...input.agentBrief, updatedAt: new Date().toISOString() }
                  : undefined,
              }
            : {}),
        },
        include: taskInclude,
      });
      if (input.status && statusToDb(input.status) !== existing.status) {
        await emitTaskEvent({
          event: "status",
          organizationId: project.organizationId,
          taskId: task.id,
          status: statusToDb(input.status),
        });
      }

      const changes = summarizeTaskChanges({
        status:
          input.status && statusToDb(input.status) !== existing.status
            ? formatStatus(statusToDb(input.status))
            : undefined,
        priority:
          input.priority && priorityToDb(input.priority) !== existing.priority
            ? formatPriority(priorityToDb(input.priority))
            : undefined,
        title: input.title !== undefined && input.title !== existing.title ? input.title : undefined,
        description:
          input.description !== undefined && input.description !== existing.description,
        dueDate: input.dueDate !== undefined,
        tags: input.tags !== undefined,
      });
      if (
        changes !== "обновление" ||
        input.title !== undefined ||
        input.description !== undefined ||
        input.dueDate !== undefined ||
        input.tags !== undefined ||
        input.priority ||
        input.status
      ) {
        const hasMeaningful =
          (input.status && statusToDb(input.status) !== existing.status) ||
          (input.priority && priorityToDb(input.priority) !== existing.priority) ||
          (input.title !== undefined && input.title !== existing.title) ||
          (input.description !== undefined && input.description !== existing.description) ||
          input.dueDate !== undefined ||
          input.tags !== undefined;
        if (hasMeaningful) {
          void notifyTaskUpdated({
            taskId: task.id,
            changesSummary: changes,
            excludeUserId: ctx.user.id,
          }).catch((err) => console.error("[email] task updated", err));
        }
      }
      return dbTaskToInbox(task);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.task.findUnique({
        where: { id: input.id },
        select: { projectId: true },
      });
      if (!existing) return { ok: true };
      await assertProjectAccess(ctx.user.id, existing.projectId, ["owner", "admin", "member"]);
      await ctx.prisma.task.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  /** Archive or restore a single task (archived = hidden from inbox/canvas). */
  setArchived: protectedProcedure
    .input(z.object({ id: z.string().min(1), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.task.findUnique({
        where: { id: input.id },
        select: { projectId: true },
      });
      if (!existing) throw new Error("Task not found");
      await assertProjectAccess(ctx.user.id, existing.projectId, [
        "owner",
        "admin",
        "member",
      ]);
      const task = await ctx.prisma.task.update({
        where: { id: input.id },
        data: { archivedAt: input.archived ? new Date() : null },
        include: taskInclude,
      });
      return dbTaskToInbox(task);
    }),

  /**
   * Apply a change to MANY tasks at once (bulk move/priority/archive). Targets
   * are resolved by explicit ids, or by a status/tag filter within the org (and
   * optional project). Used by the agent's `propose_bulk_update_tasks` so a
   * request like "move all in-progress to review" runs as a single action.
   */
  bulkUpdate: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        projectId: z.string().min(1).optional(),
        filter: z
          .object({
            ids: z.array(z.string()).optional(),
            status: statusEnum.optional(),
            tags: z.array(z.string()).optional(),
          })
          .default({}),
        changes: z.object({
          status: statusEnum.optional(),
          priority: priorityEnum.optional(),
          archive: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId, [
        "owner",
        "admin",
        "member",
      ]);
      const { filter, changes } = input;
      // Only restore reaches archived tasks; every other bulk op acts on active.
      const archivedFilter =
        changes.archive === false ? {} : { archivedAt: null };
      const targets = await ctx.prisma.task.findMany({
        where: {
          ...archivedFilter,
          project: {
            organizationId: input.organizationId,
            ...(input.projectId ? { id: input.projectId } : {}),
          },
          ...(filter.ids && filter.ids.length ? { id: { in: filter.ids } } : {}),
          ...(filter.status ? { status: statusToDb(filter.status) } : {}),
          ...(filter.tags && filter.tags.length
            ? { tags: { hasSome: filter.tags } }
            : {}),
        },
        select: { id: true, title: true, status: true },
      });
      if (targets.length === 0) return { count: 0, tasks: [] };

      const data: {
        status?: ReturnType<typeof statusToDb>;
        priority?: ReturnType<typeof priorityToDb>;
        archivedAt?: Date | null;
      } = {};
      if (changes.status) data.status = statusToDb(changes.status);
      if (changes.priority) data.priority = priorityToDb(changes.priority);
      if (changes.archive !== undefined)
        data.archivedAt = changes.archive ? new Date() : null;

      await ctx.prisma.task.updateMany({
        where: { id: { in: targets.map((t) => t.id) } },
        data,
      });

      if (changes.status) {
        const nextStatus = statusToDb(changes.status);
        for (const t of targets) {
          if (t.status === nextStatus) continue;
          await emitTaskEvent({
            event: "status",
            organizationId: input.organizationId,
            taskId: t.id,
            status: nextStatus,
          }).catch(() => undefined);
        }
      }

      return {
        count: targets.length,
        tasks: targets.map((t) => ({ id: t.id, title: t.title })),
      };
    }),

  /** Replace the full assignee set (members + agents) for a task. */
  setAssignees: protectedProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        userIds: z.array(z.string()).default([]),
        agentIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({
        where: { id: input.taskId },
        select: {
          projectId: true,
          assignees: { select: { userId: true } },
        },
      });
      if (!task) throw new Error("Task not found");
      const project = await assertProjectAccess(ctx.user.id, task.projectId, [
        "owner",
        "admin",
        "member",
      ]);

      const prevUserIds = new Set(
        task.assignees.map((a) => a.userId).filter((id): id is string => Boolean(id)),
      );

      const [validAgents, validMembers] = await Promise.all([
        input.agentIds.length
          ? ctx.prisma.agent.findMany({
              where: { id: { in: input.agentIds }, organizationId: project.organizationId },
              select: { id: true },
            })
          : Promise.resolve([]),
        input.userIds.length
          ? ctx.prisma.member.findMany({
              where: { organizationId: project.organizationId, userId: { in: input.userIds } },
              select: { userId: true },
            })
          : Promise.resolve([]),
      ]);

      await ctx.prisma.$transaction([
        ctx.prisma.taskAssignee.deleteMany({ where: { taskId: input.taskId } }),
        ctx.prisma.taskAssignee.createMany({
          data: [
            ...validMembers.map((m) => ({ taskId: input.taskId, userId: m.userId })),
            ...validAgents.map((a) => ({ taskId: input.taskId, agentId: a.id })),
          ],
        }),
      ]);
      const updated = await ctx.prisma.task.findUnique({
        where: { id: input.taskId },
        include: taskInclude,
      });

      const newUserIds = validMembers
        .map((m) => m.userId)
        .filter((id) => !prevUserIds.has(id));
      const assigneesChanged =
        newUserIds.length > 0 ||
        prevUserIds.size !== validMembers.length ||
        validMembers.some((m) => !prevUserIds.has(m.userId));

      if (newUserIds.length) {
        void notifyTaskAssigned({
          taskId: input.taskId,
          newUserIds,
          actorUserId: ctx.user.id,
        }).catch((err) => console.error("[email] task assigned", err));
      } else if (assigneesChanged) {
        void notifyTaskUpdated({
          taskId: input.taskId,
          changesSummary: "исполнители",
          excludeUserId: ctx.user.id,
        }).catch((err) => console.error("[email] task updated", err));
      }

      return updated ? dbTaskToInbox(updated) : { ok: true };
    }),

  /** Assign an agent to a task (idempotent). */
  assignAgent: protectedProcedure
    .input(z.object({ taskId: z.string().min(1), agentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({
        where: { id: input.taskId },
        select: { projectId: true },
      });
      if (!task) throw new Error("Task not found");
      const project = await assertProjectAccess(ctx.user.id, task.projectId, [
        "owner",
        "admin",
        "member",
      ]);
      const agent = await ctx.prisma.agent.findFirst({
        where: { id: input.agentId, organizationId: project.organizationId },
        select: { id: true },
      });
      if (!agent) throw new Error("Agent not found");
      const existing = await ctx.prisma.taskAssignee.findFirst({
        where: { taskId: input.taskId, agentId: input.agentId },
      });
      if (!existing) {
        await ctx.prisma.taskAssignee.create({
          data: { taskId: input.taskId, agentId: input.agentId },
        });
      }
      return { ok: true };
    }),

  /** Per-(task, agent) briefs for a task, with each agent's display name. */
  briefs: protectedProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({
        where: { id: input.taskId },
        select: { projectId: true },
      });
      if (!task) return [];
      await assertProjectAccess(ctx.user.id, task.projectId);
      const rows = await ctx.prisma.taskAgentBrief.findMany({
        where: { taskId: input.taskId },
        include: { agent: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(dbBriefToContent);
    }),

  /** Create/update ONE agent's per-task brief and ensure it's an assignee. */
  setBrief: protectedProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        agentId: z.string().min(1),
        instructions: z.string().max(4000).optional(),
        tool: briefToolEnum.optional(),
        options: briefOptionsInput,
        knowledge: z.string().max(8000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({
        where: { id: input.taskId },
        select: { projectId: true },
      });
      if (!task) throw new Error("Task not found");
      const project = await assertProjectAccess(ctx.user.id, task.projectId, [
        "owner",
        "admin",
        "member",
      ]);
      const agent = await ctx.prisma.agent.findFirst({
        where: { id: input.agentId, organizationId: project.organizationId },
        select: { id: true },
      });
      if (!agent) throw new Error("Agent not found");

      const db = briefContentToDb(input);
      await ctx.prisma.taskAgentBrief.upsert({
        where: { taskId_agentId: { taskId: input.taskId, agentId: input.agentId } },
        update: { instructions: db.instructions, tool: db.tool, config: db.config },
        create: {
          taskId: input.taskId,
          agentId: input.agentId,
          instructions: db.instructions,
          tool: db.tool,
          config: db.config,
          createdById: ctx.user.id,
        },
      });
      const assignee = await ctx.prisma.taskAssignee.findFirst({
        where: { taskId: input.taskId, agentId: input.agentId },
      });
      if (!assignee) {
        await ctx.prisma.taskAssignee.create({
          data: { taskId: input.taskId, agentId: input.agentId },
        });
      }
      return { ok: true };
    }),

  /**
   * Assign an agent + brief to a task and kick off an autonomous run that uses
   * the agent's REAL tools (research/documents/report/review) to work on it.
   * The run is linked to the task and executed by the BullMQ worker. The brief
   * is persisted per-(task, agent) in TaskAgentBrief.
   */
  runAgent: protectedProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        agentId: z.string().min(1),
        brief: briefContentInput.optional(),
        locale: z.enum(["ru", "en"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({
        where: { id: input.taskId },
        include: { project: { select: { name: true, organizationId: true } } },
      });
      if (!task) throw new Error("Task not found");
      const organizationId = task.project.organizationId;
      await assertProjectAccess(ctx.user.id, task.projectId, ["owner", "admin", "member"]);

      const agent = await ctx.prisma.agent.findFirst({
        where: { id: input.agentId, organizationId },
        select: { id: true, name: true },
      });
      if (!agent) throw new Error("Agent not found");

      // Persist the per-agent brief (if provided), then resolve the brief used
      // for the run (provided > stored TaskAgentBrief > legacy Task.agentBrief).
      if (input.brief) {
        const db = briefContentToDb(input.brief);
        await ctx.prisma.taskAgentBrief.upsert({
          where: { taskId_agentId: { taskId: task.id, agentId: agent.id } },
          update: { instructions: db.instructions, tool: db.tool, config: db.config },
          create: {
            taskId: task.id,
            agentId: agent.id,
            instructions: db.instructions,
            tool: db.tool,
            config: db.config,
            createdById: ctx.user.id,
          },
        });
      }
      const storedBrief = await ctx.prisma.taskAgentBrief.findUnique({
        where: { taskId_agentId: { taskId: task.id, agentId: agent.id } },
        include: { agent: { select: { name: true } } },
      });
      const brief: TaskAgentBrief | null = storedBrief
        ? dbBriefToContent(storedBrief)
        : parseAgentBrief(task.agentBrief);

      const assignee = await ctx.prisma.taskAssignee.findFirst({
        where: { taskId: task.id, agentId: agent.id },
      });
      if (!assignee) {
        await ctx.prisma.taskAssignee.create({
          data: { taskId: task.id, agentId: agent.id },
        });
      }

      const prompt = buildAssignmentPrompt(
        { id: task.id, title: task.title, description: task.description },
        brief,
        task.project.name,
      );
      const run = await ctx.prisma.agentRun.create({
        data: {
          agentId: agent.id,
          taskId: task.id,
          triggeredById: ctx.user.id,
          status: "QUEUED",
          input: {
            prompt,
            projectId: task.projectId,
            taskId: task.id,
            locale: input.locale ?? "ru",
            briefTool: brief?.tool,
          },
        },
      });
      await enqueueAgentRun(run.id);
      await ctx.prisma.activityLog
        .create({
          data: {
            organizationId,
            userId: ctx.user.id,
            type: "AGENT",
            actor: agent.name,
            action: "assigned to task",
            target: task.title,
          },
        })
        .catch(() => undefined);
      return { runId: run.id };
    }),

  /**
   * Orchestrator delegation / decomposition. Resolves (or creates) the task,
   * then for each assignment: picks the agent (by name, or auto-selects by
   * capability when none was named), assigns it, sets its per-task brief, and
   * kicks off an autonomous run. The single entry point behind the chat's
   * `propose_delegate_task` proposal so the whole chain runs after one approval.
   */
  delegate: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        taskId: z.string().optional(),
        taskTitle: z.string().optional(),
        createTask: z
          .object({
            title: z.string().min(1).max(200),
            description: z.string().max(4000).optional(),
            projectName: z.string().optional(),
            priority: priorityEnum.optional(),
            dueDate: z.string().datetime().nullish(),
          })
          .optional(),
        assignments: z
          .array(
            z.object({
              agentName: z.string().optional(),
              tool: briefToolEnum.optional(),
              brief: z.string().min(1).max(4000),
              format: z.enum(["word", "excel", "pdf"]).optional(),
              documentSpec: z.string().max(4000).optional(),
              researchQuery: z.string().max(500).optional(),
            }),
          )
          .min(1)
          .max(6),
        run: z.boolean().default(true),
        locale: z.enum(["ru", "en"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId, [
        "owner",
        "admin",
        "member",
      ]);

      // 1. Resolve the task (by id, then exact title, then create).
      type DelegateTask = {
        id: string;
        title: string;
        description: string | null;
        projectId: string;
        project: { name: string };
      };
      let task: DelegateTask | null = null;
      if (input.taskId) {
        const found = await ctx.prisma.task.findFirst({
          where: { id: input.taskId, project: { organizationId: input.organizationId } },
          select: {
            id: true,
            title: true,
            description: true,
            projectId: true,
            project: { select: { name: true } },
          },
        });
        if (found) task = found;
      }
      if (!task && input.taskTitle) {
        const found = await ctx.prisma.task.findFirst({
          where: {
            title: { equals: input.taskTitle, mode: "insensitive" },
            project: { organizationId: input.organizationId },
          },
          select: {
            id: true,
            title: true,
            description: true,
            projectId: true,
            project: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        });
        if (found) task = found;
      }
      if (!task && input.createTask) {
        const project =
          (input.createTask.projectName
            ? await ctx.prisma.project.findFirst({
                where: {
                  organizationId: input.organizationId,
                  name: { equals: input.createTask.projectName, mode: "insensitive" },
                },
                select: { id: true },
              })
            : null) ??
          (await ctx.prisma.project.findFirst({
            where: { organizationId: input.organizationId },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          }));
        if (!project) throw new Error("No project to create the task in");
        const created = await ctx.prisma.task.create({
          data: {
            projectId: project.id,
            title: input.createTask.title,
            description: input.createTask.description,
            priority: priorityToDb(input.createTask.priority ?? "medium"),
            status: "TODO",
            dueDate: input.createTask.dueDate
              ? new Date(input.createTask.dueDate)
              : null,
          },
          select: {
            id: true,
            title: true,
            description: true,
            projectId: true,
            project: { select: { name: true } },
          },
        });
        task = created;
        await emitTaskEvent({
          event: "created",
          organizationId: input.organizationId,
          taskId: created.id,
        });
      }
      if (!task) throw new Error("No task to delegate to");

      // 2. For each assignment: resolve the workspace's main agent → assign → brief → run.
      const mainAgent = await ctx.prisma.agent.findFirst({
        where: { organizationId: input.organizationId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, tools: true },
      });
      if (!mainAgent) {
        return { taskId: task.id, projectId: task.projectId, assigned: [{ agent: "agent", error: "no agent in workspace" }] };
      }

      const assigned: { agent: string; runId?: string; error?: string }[] = [];
      for (const a of input.assignments) {
        const agent = mainAgent;

        const briefOptions = {
          ...(a.format ? { format: a.format } : {}),
          ...(a.documentSpec ? { documentSpec: a.documentSpec } : {}),
          ...(a.researchQuery ? { researchQuery: a.researchQuery } : {}),
        };
        const db = briefContentToDb({
          instructions: a.brief,
          tool: a.tool,
          options: briefOptions,
        });
        await ctx.prisma.taskAgentBrief.upsert({
          where: { taskId_agentId: { taskId: task.id, agentId: agent.id } },
          update: { instructions: db.instructions, tool: db.tool, config: db.config },
          create: {
            taskId: task.id,
            agentId: agent.id,
            instructions: db.instructions,
            tool: db.tool,
            config: db.config,
            createdById: ctx.user.id,
          },
        });
        const existing = await ctx.prisma.taskAssignee.findFirst({
          where: { taskId: task.id, agentId: agent.id },
        });
        if (!existing) {
          await ctx.prisma.taskAssignee.create({
            data: { taskId: task.id, agentId: agent.id },
          });
        }

        let runId: string | undefined;
        if (input.run) {
          const prompt = buildAssignmentPrompt(
            { id: task.id, title: task.title, description: task.description },
            { instructions: a.brief, tool: a.tool, options: briefOptions, agentId: agent.id },
            task.project.name,
          );
          const run = await ctx.prisma.agentRun.create({
            data: {
              agentId: agent.id,
              taskId: task.id,
              triggeredById: ctx.user.id,
              status: "QUEUED",
              input: {
                prompt,
                projectId: task.projectId,
                taskId: task.id,
                locale: input.locale ?? "ru",
                briefTool: a.tool,
              },
            },
          });
          await enqueueAgentRun(run.id);
          runId = run.id;
        }
        await ctx.prisma.activityLog
          .create({
            data: {
              organizationId: input.organizationId,
              userId: ctx.user.id,
              type: "AGENT",
              actor: agent.name,
              action: input.run ? "delegated work on" : "briefed for",
              target: task.title,
            },
          })
          .catch(() => undefined);
        assigned.push({ agent: agent.name, runId });
      }

      return { taskId: task.id, projectId: task.projectId, assigned };
    }),
});
