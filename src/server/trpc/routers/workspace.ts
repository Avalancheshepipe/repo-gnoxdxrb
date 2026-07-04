import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { handleFromAgentName, handleFromEmail, type Mentionable } from "@/lib/mentions";
import { notifyProjectInvitation } from "@/server/mail/notifications";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { assertMember } from "@/server/trpc/util";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  );
}

export const workspaceRouter = router({
  /** Workspaces (organizations) the current user belongs to. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const members = await ctx.prisma.member.findMany({
      where: { userId: ctx.user.id },
      include: {
        organization: {
          include: { _count: { select: { projects: true, members: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return members.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      projectCount: m.organization._count.projects,
      memberCount: m.organization._count.members,
    }));
  }),

  get: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      return ctx.prisma.organization.findUniqueOrThrow({
        where: { id: input.organizationId },
        include: { _count: { select: { projects: true, members: true } } },
      });
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(2).max(60) }))
    .mutation(async ({ ctx, input }) => {
      const base = slugify(input.name);
      let slug = base;
      for (let i = 1; await ctx.prisma.organization.findUnique({ where: { slug } }); i++) {
        slug = `${base}-${i}`;
      }

      return ctx.prisma.organization.create({
        data: {
          name: input.name,
          slug,
          members: { create: { userId: ctx.user.id, role: "owner" } },
        },
      });
    }),

  members: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const members = await ctx.prisma.member.findMany({
        where: { organizationId: input.organizationId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: "asc" },
      });
      return members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
      }));
    }),

  /** Taggable people + agents for the chat @mention autocomplete. */
  mentionables: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<Mentionable[]> => {
      await assertMember(ctx.user.id, input.organizationId);
      const [agents, members] = await Promise.all([
        ctx.prisma.agent.findMany({
          where: { organizationId: input.organizationId },
          select: { name: true, role: true },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prisma.member.findMany({
          where: { organizationId: input.organizationId },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      const used = new Set<string>();
      const dedupe = (h: string) => {
        let handle = h;
        let i = 2;
        while (used.has(handle)) handle = `${h}${i++}`;
        used.add(handle);
        return handle;
      };

      const agentList: Mentionable[] = agents.map((a) => ({
        kind: "agent" as const,
        name: a.name,
        handle: dedupe(handleFromAgentName(a.name)),
        sub: a.role,
      }));
      const userList: Mentionable[] = members.map((m) => ({
        kind: "user" as const,
        name: m.user.name ?? m.user.email,
        handle: dedupe(handleFromEmail(m.user.email)),
        sub: m.role,
      }));
      return [...agentList, ...userList];
    }),

  /** Remove a member (owner/admin only). */
  removeMember: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1), memberId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId, ["owner", "admin"]);
      const member = await ctx.prisma.member.findUnique({ where: { id: input.memberId } });
      if (!member || member.organizationId !== input.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.prisma.member.delete({ where: { id: input.memberId } });
      return { ok: true };
    }),

  // ───────────────────────────── Invitations ─────────────────────────────

  /** Pending invitations for a workspace (owner/admin). */
  invitations: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId, ["owner", "admin"]);
      const invites = await ctx.prisma.invitation.findMany({
        where: { organizationId: input.organizationId, status: "pending" },
        orderBy: { id: "desc" },
      });
      return invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role ?? "member",
        expiresAt: i.expiresAt,
      }));
    }),

  /** Create (or refresh) an invitation. Returns a shareable accept link. */
  invite: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        email: z.string().email(),
        role: z.enum(["admin", "member"]).default("member"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId, ["owner", "admin"]);
      const email = input.email.toLowerCase().trim();

      // Already a member? Nothing to do.
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existingUser) {
        const member = await ctx.prisma.member.findUnique({
          where: {
            organizationId_userId: {
              organizationId: input.organizationId,
              userId: existingUser.id,
            },
          },
        });
        if (member) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This person is already a member of the workspace.",
          });
        }
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const prior = await ctx.prisma.invitation.findFirst({
        where: {
          organizationId: input.organizationId,
          email,
          status: "pending",
        },
      });
      const invite = prior
        ? await ctx.prisma.invitation.update({
            where: { id: prior.id },
            data: { role: input.role, expiresAt, inviterId: ctx.user.id },
          })
        : await ctx.prisma.invitation.create({
            data: {
              organizationId: input.organizationId,
              email,
              role: input.role,
              status: "pending",
              expiresAt,
              inviterId: ctx.user.id,
            },
          });

      const [org, inviter] = await Promise.all([
        ctx.prisma.organization.findUnique({
          where: { id: input.organizationId },
          select: { name: true },
        }),
        ctx.prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { name: true },
        }),
      ]);

      void notifyProjectInvitation({
        invitationId: invite.id,
        organizationId: input.organizationId,
        email,
        workspaceName: org?.name ?? "Julow",
        invitedBy: inviter?.name ?? "Команда",
        role: invite.role ?? "member",
      }).catch((err) => console.error("[email] invitation", err));

      return { id: invite.id, email: invite.email, role: invite.role ?? "member" };
    }),

  /** Cancel a pending invitation. */
  revokeInvite: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1), invitationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId, ["owner", "admin"]);
      const invite = await ctx.prisma.invitation.findUnique({
        where: { id: input.invitationId },
      });
      if (!invite || invite.organizationId !== input.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.prisma.invitation.update({
        where: { id: invite.id },
        data: { status: "cancelled" },
      });
      return { ok: true };
    }),

  /** Public-ish preview of an invitation for the accept page. */
  invitePreview: protectedProcedure
    .input(z.object({ invitationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const invite = await ctx.prisma.invitation.findUnique({
        where: { id: input.invitationId },
        include: {
          organization: { select: { name: true } },
          inviter: { select: { name: true } },
        },
      });
      if (!invite) return null;
      return {
        id: invite.id,
        email: invite.email,
        role: invite.role ?? "member",
        status: invite.status,
        expired: invite.expiresAt.getTime() < Date.now(),
        workspaceName: invite.organization.name,
        invitedBy: invite.inviter?.name ?? "A teammate",
      };
    }),

  /** Accept an invitation for the signed-in user. */
  acceptInvite: protectedProcedure
    .input(z.object({ invitationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.prisma.invitation.findUnique({
        where: { id: input.invitationId },
      });
      if (!invite) throw new TRPCError({ code: "NOT_FOUND" });
      if (invite.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation is no longer valid.",
        });
      }
      if (invite.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation has expired.",
        });
      }

      const userEmail = ctx.user.email.toLowerCase();
      if (invite.email.toLowerCase() !== userEmail) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invitation was sent to a different email address.",
        });
      }

      await ctx.prisma.member.upsert({
        where: {
          organizationId_userId: {
            organizationId: invite.organizationId,
            userId: ctx.user.id,
          },
        },
        update: {},
        create: {
          organizationId: invite.organizationId,
          userId: ctx.user.id,
          role: invite.role ?? "member",
        },
      });
      await ctx.prisma.invitation.update({
        where: { id: invite.id },
        data: { status: "accepted" },
      });

      return { organizationId: invite.organizationId };
    }),
});
