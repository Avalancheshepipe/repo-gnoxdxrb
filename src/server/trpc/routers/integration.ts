import { z } from "zod";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { assertMember } from "@/server/trpc/util";

const platformFromDb: Record<string, "telegram" | "discord" | "slack"> = {
  TELEGRAM: "telegram",
  DISCORD: "discord",
  SLACK: "slack",
};

export const integrationRouter = router({
  list: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const integrations = await ctx.prisma.integration.findMany({
        where: { organizationId: input.organizationId },
        orderBy: { createdAt: "asc" },
      });
      return integrations.map((i) => ({
        id: i.id,
        platform: platformFromDb[i.type] ?? "telegram",
        name: i.name,
        handle: i.handle ?? "",
        connected: i.connected,
        lastMessage: i.lastMessage ?? undefined,
      }));
    }),

  upsertTelegram: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        name: z.string().min(1),
        handle: z.string().optional(),
        chatId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId, ["owner", "admin"]);
      return ctx.prisma.integration.create({
        data: {
          organizationId: input.organizationId,
          type: "TELEGRAM",
          name: input.name,
          handle: input.handle,
          connected: true,
          config: { chatId: input.chatId },
        },
      });
    }),
});
