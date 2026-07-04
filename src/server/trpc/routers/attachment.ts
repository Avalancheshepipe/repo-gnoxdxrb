import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import {
  buildAttachmentKey,
  deleteObject,
  presignDownload,
  presignUpload,
} from "@/server/s3";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { assertProjectAccess } from "@/server/trpc/util";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

async function taskOrgGuard(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
  return assertProjectAccess(userId, task.projectId, ["owner", "admin", "member"]);
}

export const attachmentRouter = router({
  /** Step 1: get a presigned PUT url; client uploads the bytes directly to S3. */
  createUploadUrl: protectedProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        name: z.string().min(1).max(200),
        mime: z.string().min(1).max(150),
        size: z.number().int().positive().max(MAX_SIZE),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await taskOrgGuard(ctx.user.id, input.taskId);
      const key = buildAttachmentKey(project.organizationId, input.taskId, input.name);
      const uploadUrl = await presignUpload(key, input.mime);
      return { key, uploadUrl };
    }),

  /** Step 2: persist the attachment row after the upload succeeded. */
  confirm: protectedProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        key: z.string().min(1),
        name: z.string().min(1).max(200),
        mime: z.string().min(1).max(150),
        size: z.number().int().positive().max(MAX_SIZE),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await taskOrgGuard(ctx.user.id, input.taskId);
      return ctx.prisma.attachment.create({
        data: {
          taskId: input.taskId,
          key: input.key,
          name: input.name,
          mime: input.mime,
          size: input.size,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await taskOrgGuard(ctx.user.id, input.taskId);
      return ctx.prisma.attachment.findMany({
        where: { taskId: input.taskId },
        orderBy: { createdAt: "desc" },
      });
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await ctx.prisma.attachment.findUnique({
        where: { id: input.id },
      });
      if (!attachment?.taskId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await taskOrgGuard(ctx.user.id, attachment.taskId);
      return { url: await presignDownload(attachment.key) };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await ctx.prisma.attachment.findUnique({
        where: { id: input.id },
      });
      if (!attachment) return { ok: true };
      if (attachment.taskId) {
        await taskOrgGuard(ctx.user.id, attachment.taskId);
      }
      await deleteObject(attachment.key).catch(() => undefined);
      await ctx.prisma.attachment.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
