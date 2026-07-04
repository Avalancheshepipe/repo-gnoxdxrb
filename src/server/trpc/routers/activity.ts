import { z } from "zod";
import { formatRelativeTime } from "@/lib/format-time";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { assertMember } from "@/server/trpc/util";

const typeFromDb: Record<string, "agent" | "task" | "automation"> = {
  AGENT: "agent",
  TASK: "task",
  AUTOMATION: "automation",
  SYSTEM: "task",
};

const typeToDb: Record<"agent" | "task" | "automation", "AGENT" | "TASK" | "AUTOMATION"> =
  {
    agent: "AGENT",
    task: "TASK",
    automation: "AUTOMATION",
  };

function mapActivityItem(
  item: {
    id: string;
    actor: string;
    action: string;
    target: string | null;
    createdAt: Date;
    type: string;
  },
  now: number,
) {
  return {
    id: item.id,
    actor: item.actor,
    action: item.action,
    target: item.target ?? "",
    time: formatRelativeTime(item.createdAt),
    type: typeFromDb[item.type] ?? "task",
    status:
      item.type === "AGENT" && now - item.createdAt.getTime() < 60_000
        ? ("live" as const)
        : ("done" as const),
  };
}

export const activityRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        limit: z.number().min(1).max(100).default(30),
        type: z.enum(["agent", "task", "automation"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const items = await ctx.prisma.activityLog.findMany({
        where: {
          organizationId: input.organizationId,
          ...(input.type ? { type: typeToDb[input.type] } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      const now = Date.now();
      return items.map((item) => mapActivityItem(item, now));
    }),

  listPage: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
        type: z.enum(["agent", "task", "automation"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const batch = await ctx.prisma.activityLog.findMany({
        where: {
          organizationId: input.organizationId,
          ...(input.type ? { type: typeToDb[input.type] } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor
          ? { cursor: { id: input.cursor }, skip: 1 }
          : {}),
      });

      let nextCursor: string | null = null;
      if (batch.length > input.limit) {
        const extra = batch.pop()!;
        nextCursor = extra.id;
      }

      const now = Date.now();
      return {
        items: batch.map((item) => mapActivityItem(item, now)),
        nextCursor,
      };
    }),
});
