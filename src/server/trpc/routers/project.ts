import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { assertMember, assertProjectAccess } from "@/server/trpc/util";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "project"
  );
}

export const projectRouter = router({
  list: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      return ctx.prisma.project.findMany({
        where: { organizationId: input.organizationId, archived: false },
        include: { _count: { select: { tasks: true } } },
        orderBy: { createdAt: "asc" },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.user.id, input.id);
      return ctx.prisma.project.findUniqueOrThrow({ where: { id: input.id } });
    }),

  create: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        name: z.string().min(1).max(80),
        description: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId, ["owner", "admin", "member"]);
      const base = slugify(input.name);
      let slug = base;
      for (
        let i = 1;
        await ctx.prisma.project.findUnique({
          where: { organizationId_slug: { organizationId: input.organizationId, slug } },
        });
        i++
      ) {
        slug = `${base}-${i}`;
      }

      return ctx.prisma.project.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          description: input.description,
          slug,
          canvas: { create: {} },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(80).optional(),
        description: z.string().max(2000).nullable().optional(),
        archived: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.user.id, input.id, ["owner", "admin", "member"]);
      const { id, ...data } = input;
      return ctx.prisma.project.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.user.id, input.id, ["owner", "admin"]);
      await ctx.prisma.project.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  /** Agents subscribed to a project (their zone of responsibility). */
  agents: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.user.id, input.projectId);
      const subs = await ctx.prisma.projectAgent.findMany({
        where: { projectId: input.projectId },
        include: { agent: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      });
      return subs.map((s) => ({
        agentId: s.agentId,
        name: s.agent.name,
        role: s.agent.role,
        instructions: s.instructions ?? "",
      }));
    }),

  /** Subscribe (or update instructions for) an agent on a project. */
  subscribeAgent: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        agentId: z.string().min(1),
        instructions: z.string().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await assertProjectAccess(ctx.user.id, input.projectId, [
        "owner",
        "admin",
        "member",
      ]);
      const agent = await ctx.prisma.agent.findFirst({
        where: { id: input.agentId, organizationId: project.organizationId },
        select: { id: true },
      });
      if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
      await ctx.prisma.projectAgent.upsert({
        where: {
          projectId_agentId: { projectId: input.projectId, agentId: input.agentId },
        },
        update: { instructions: input.instructions ?? null },
        create: {
          projectId: input.projectId,
          agentId: input.agentId,
          instructions: input.instructions ?? null,
        },
      });
      return { ok: true };
    }),

  unsubscribeAgent: protectedProcedure
    .input(z.object({ projectId: z.string().min(1), agentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.user.id, input.projectId, ["owner", "admin", "member"]);
      await ctx.prisma.projectAgent
        .delete({
          where: {
            projectId_agentId: { projectId: input.projectId, agentId: input.agentId },
          },
        })
        .catch(() => undefined);
      return { ok: true };
    }),
});
