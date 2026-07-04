import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { enqueueAgentRun } from "@/server/queue/enqueue";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { assertMember } from "@/server/trpc/util";

export const agentRunRouter = router({
  /** Queue an autonomous agent run; the worker executes it in the background. */
  start: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        agentId: z.string().min(1),
        prompt: z.string().min(1).max(4000),
        projectId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const agent = await ctx.prisma.agent.findFirst({
        where: { id: input.agentId, organizationId: input.organizationId },
        select: { id: true },
      });
      if (!agent) throw new TRPCError({ code: "NOT_FOUND" });

      const run = await ctx.prisma.agentRun.create({
        data: {
          agentId: agent.id,
          triggeredById: ctx.user.id,
          status: "QUEUED",
          input: { prompt: input.prompt, projectId: input.projectId ?? null },
        },
      });
      await enqueueAgentRun(run.id);
      return { runId: run.id };
    }),

  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const runs = await ctx.prisma.agentRun.findMany({
        where: { agent: { organizationId: input.organizationId } },
        include: { agent: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
      return runs.map((r) => ({
        id: r.id,
        agent: r.agent.name,
        status: r.status,
        result: r.result,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        costUsd: Number(r.costUsd),
        createdAt: r.createdAt,
      }));
    }),

  /** Agents currently working on a task (queued/running) — drives the task
   *  chat's live "agent is working" indicator. */
  runningForTask: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        taskId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const runs = await ctx.prisma.agentRun.findMany({
        where: {
          taskId: input.taskId,
          status: { in: ["QUEUED", "RUNNING"] },
          agent: { organizationId: input.organizationId },
        },
        select: { id: true, agent: { select: { name: true } } },
        take: 10,
      });
      return {
        active: runs.length,
        agents: [...new Set(runs.map((r) => r.agent.name))],
      };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.prisma.agentRun.findUnique({
        where: { id: input.id },
        include: {
          agent: { select: { name: true, organizationId: true } },
          steps: { orderBy: { index: "asc" } },
        },
      });
      if (!run) return null;
      await assertMember(ctx.user.id, run.agent.organizationId);
      return run;
    }),

  /** Current month spend for budget display. */
  budget: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const agg = await ctx.prisma.agentRun.aggregate({
        _sum: { costUsd: true },
        where: {
          agent: { organizationId: input.organizationId },
          createdAt: { gte: start },
        },
      });
      return { spentUsd: Number(agg._sum.costUsd ?? 0) };
    }),
});
