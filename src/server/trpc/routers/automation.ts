import { z } from "zod";
import {
  enqueueAutomation,
  scheduleAutomation,
  unscheduleAutomation,
} from "@/server/queue/enqueue";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { assertMember } from "@/server/trpc/util";

type RuleSpec = { label?: string; type: string; config?: Record<string, unknown> };

function ruleLabel(value: unknown): string {
  if (value && typeof value === "object") {
    const spec = value as RuleSpec;
    return spec.label ?? spec.type ?? "";
  }
  return "";
}

export const automationRouter = router({
  list: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const rules = await ctx.prisma.automation.findMany({
        where: { organizationId: input.organizationId },
        orderBy: { createdAt: "asc" },
      });
      return rules.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? "",
        trigger: ruleLabel(r.trigger),
        action: ruleLabel(r.action),
        enabled: r.enabled,
        runsToday: r.runsToday,
        aiManaged: r.aiManaged,
      }));
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.string().min(1), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.prisma.automation.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });
      if (!rule) throw new Error("Automation not found");
      await assertMember(ctx.user.id, rule.organizationId, ["owner", "admin"]);
      const updated = await ctx.prisma.automation.update({
        where: { id: input.id },
        data: { enabled: input.enabled },
      });
      // Respect the toggle in the scheduler (enable/disable the job).
      await scheduleAutomation(updated).catch(() => undefined);
      return updated;
    }),

  /** Update an automation's definition and reschedule its job. */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(2000).nullable().optional(),
        trigger: z
          .object({
            type: z.string(),
            label: z.string().optional(),
            config: z.record(z.string(), z.any()).optional(),
          })
          .optional(),
        action: z
          .object({
            type: z.string(),
            label: z.string().optional(),
            config: z.record(z.string(), z.any()).optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.prisma.automation.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });
      if (!rule) throw new Error("Automation not found");
      await assertMember(ctx.user.id, rule.organizationId, ["owner", "admin"]);
      const { id, ...rest } = input;
      const updated = await ctx.prisma.automation.update({
        where: { id },
        data: {
          ...(rest.name !== undefined ? { name: rest.name } : {}),
          ...(rest.description !== undefined ? { description: rest.description } : {}),
          ...(rest.trigger !== undefined ? { trigger: rest.trigger } : {}),
          ...(rest.action !== undefined ? { action: rest.action } : {}),
        },
      });
      await scheduleAutomation(updated).catch(() => undefined);
      return updated;
    }),

  /** Delete an automation and remove its scheduled job. */
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.prisma.automation.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });
      if (!rule) return { ok: true };
      await assertMember(ctx.user.id, rule.organizationId, ["owner", "admin"]);
      await unscheduleAutomation(input.id).catch(() => undefined);
      await ctx.prisma.automation.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  /** Manually trigger an automation now (runs in the worker). */
  run: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.prisma.automation.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });
      if (!rule) throw new Error("Automation not found");
      await assertMember(ctx.user.id, rule.organizationId, ["owner", "admin"]);
      await enqueueAutomation(input.id);
      return { ok: true };
    }),

  create: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        name: z.string().min(1).max(120),
        description: z.string().max(2000).optional(),
        trigger: z.object({
          type: z.string(),
          label: z.string().optional(),
          config: z.record(z.string(), z.any()).optional(),
        }),
        action: z.object({
          type: z.string(),
          label: z.string().optional(),
          config: z.record(z.string(), z.any()).optional(),
        }),
        aiManaged: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId, ["owner", "admin"]);
      const created = await ctx.prisma.automation.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          description: input.description,
          trigger: input.trigger,
          action: input.action,
          aiManaged: input.aiManaged,
        },
      });
      // Schedule immediately so date/time + recurring rules actually run.
      await scheduleAutomation(created).catch(() => undefined);
      return created;
    }),
});
