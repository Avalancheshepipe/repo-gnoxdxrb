import { z } from "zod";
import {
  DEFAULT_APPROVAL_LEVELS,
  executeApprovedAction,
  expireStaleRequests,
} from "@/server/approvals/gate";
import { prisma } from "@/server/db";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { assertMember } from "@/server/trpc/util";
import type { ApprovalRequest } from "@/generated/prisma/client";

const actionType = z.enum([
  "CREATE_TASK",
  "UPDATE_TASK",
  "DELETE_TASK",
  "CREATE_DOCUMENT",
  "SEND_EMAIL",
  "SPLIT_TASK",
  "CANVAS_NOTE",
  "GITHUB_PUSH",
  "DEVIN_DELEGATE",
]);

const level = z.enum(["AUTO", "APPROVE", "BLOCKED"]);

async function decideRequest(
  request: ApprovalRequest,
  userId: string,
  approve: boolean,
): Promise<{ id: string; status: string; error?: string }> {
  if (request.status !== "PENDING") {
    return { id: request.id, status: request.status };
  }
  if (request.expiresAt < new Date()) {
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: { status: "EXPIRED", decidedAt: new Date() },
    });
    return { id: request.id, status: "EXPIRED" };
  }
  if (!approve) {
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED", decidedById: userId, decidedAt: new Date() },
    });
    return { id: request.id, status: "REJECTED" };
  }
  try {
    const result = await executeApprovedAction(request);
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        decidedById: userId,
        decidedAt: new Date(),
        result,
      },
    });
    return { id: request.id, status: "APPROVED" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        decidedById: userId,
        decidedAt: new Date(),
        error: message,
      },
    });
    return { id: request.id, status: "APPROVED", error: message };
  }
}

export const approvalRouter = router({
  rules: router({
    list: protectedProcedure
      .input(z.object({ organizationId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        await assertMember(ctx.user.id, input.organizationId);
        const rules = await prisma.approvalRule.findMany({
          where: { organizationId: input.organizationId },
        });
        const byType = new Map(rules.map((r) => [r.actionType, r.level]));
        return actionType.options.map((t) => ({
          actionType: t,
          level: byType.get(t) ?? DEFAULT_APPROVAL_LEVELS[t],
          isDefault: !byType.has(t),
        }));
      }),

    set: protectedProcedure
      .input(
        z.object({
          organizationId: z.string().min(1),
          actionType,
          level,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertMember(ctx.user.id, input.organizationId);
        const rule = await prisma.approvalRule.upsert({
          where: {
            organizationId_actionType: {
              organizationId: input.organizationId,
              actionType: input.actionType,
            },
          },
          create: {
            organizationId: input.organizationId,
            actionType: input.actionType,
            level: input.level,
          },
          update: { level: input.level },
        });
        return { id: rule.id, actionType: rule.actionType, level: rule.level };
      }),
  }),

  requests: router({
    list: protectedProcedure
      .input(
        z.object({
          organizationId: z.string().min(1),
          status: z
            .enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"])
            .optional(),
          limit: z.number().int().min(1).max(100).default(50),
        }),
      )
      .query(async ({ ctx, input }) => {
        await assertMember(ctx.user.id, input.organizationId);
        await expireStaleRequests(input.organizationId);
        return prisma.approvalRequest.findMany({
          where: {
            organizationId: input.organizationId,
            ...(input.status ? { status: input.status } : {}),
          },
          include: {
            agent: { select: { name: true } },
            decidedBy: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        });
      }),

    pendingCount: protectedProcedure
      .input(z.object({ organizationId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        await assertMember(ctx.user.id, input.organizationId);
        await expireStaleRequests(input.organizationId);
        return prisma.approvalRequest.count({
          where: { organizationId: input.organizationId, status: "PENDING" },
        });
      }),

    approve: protectedProcedure
      .input(
        z.object({
          organizationId: z.string().min(1),
          requestId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertMember(ctx.user.id, input.organizationId);
        const request = await prisma.approvalRequest.findFirst({
          where: { id: input.requestId, organizationId: input.organizationId },
        });
        if (!request) throw new Error("Approval request not found");
        return decideRequest(request, ctx.user.id, true);
      }),

    reject: protectedProcedure
      .input(
        z.object({
          organizationId: z.string().min(1),
          requestId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertMember(ctx.user.id, input.organizationId);
        const request = await prisma.approvalRequest.findFirst({
          where: { id: input.requestId, organizationId: input.organizationId },
        });
        if (!request) throw new Error("Approval request not found");
        return decideRequest(request, ctx.user.id, false);
      }),

    batchApprove: protectedProcedure
      .input(
        z.object({
          organizationId: z.string().min(1),
          requestIds: z.array(z.string().min(1)).min(1).max(50),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertMember(ctx.user.id, input.organizationId);
        const requests = await prisma.approvalRequest.findMany({
          where: {
            id: { in: input.requestIds },
            organizationId: input.organizationId,
          },
        });
        const results = [];
        for (const request of requests) {
          results.push(await decideRequest(request, ctx.user.id, true));
        }
        return results;
      }),
  }),
});
