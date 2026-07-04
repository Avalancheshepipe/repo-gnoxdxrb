import { z } from "zod";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { assertMember } from "@/server/trpc/util";

const agentStatusFromDb: Record<string, "online" | "busy" | "idle" | "offline"> =
  {
    ONLINE: "online",
    BUSY: "busy",
    IDLE: "idle",
    OFFLINE: "offline",
  };

export const agentRouter = router({
  list: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const agents = await ctx.prisma.agent.findMany({
        where: { organizationId: input.organizationId },
        include: {
          _count: { select: { runs: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      const byName = new Map<string, (typeof agents)[number]>();
      for (const agent of agents) {
        const key = agent.name.trim().toLowerCase();
        if (!byName.has(key)) byName.set(key, agent);
      }

      return Array.from(byName.values())
        .sort(
          (a, b) =>
            a.createdAt.getTime() - b.createdAt.getTime(),
        )
        .map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          responsibility: a.responsibility ?? "",
          status: agentStatusFromDb[a.status] ?? "idle",
          model: a.model,
          tasksCompleted: a._count.runs,
          avgResponse: "—",
          capabilities: Array.isArray(a.tools) ? (a.tools as string[]) : [],
        }));
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const agent = await ctx.prisma.agent.findUnique({ where: { id: input.id } });
      if (!agent) return null;
      await assertMember(ctx.user.id, agent.organizationId);
      return agent;
    }),

  create: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        name: z.string().min(1).max(60),
        role: z.string().min(1).max(120),
        responsibility: z.string().max(2000).optional(),
        systemPrompt: z.string().min(1).max(20_000),
        model: z.string().min(1),
        fallbackModel: z.string().optional(),
        tools: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId, ["owner", "admin"]);
      const { organizationId, tools, ...rest } = input;
      return ctx.prisma.agent.create({
        data: { organizationId, tools, ...rest },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(60).optional(),
        role: z.string().min(1).max(120).optional(),
        responsibility: z.string().max(2000).nullable().optional(),
        systemPrompt: z.string().min(1).max(20_000).optional(),
        model: z.string().min(1).optional(),
        fallbackModel: z.string().nullable().optional(),
        tools: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const agent = await ctx.prisma.agent.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });
      if (!agent) throw new Error("Agent not found");
      await assertMember(ctx.user.id, agent.organizationId, ["owner", "admin"]);
      const { id, ...data } = input;
      return ctx.prisma.agent.update({ where: { id }, data });
    }),
});
