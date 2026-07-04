import { TRPCError } from "@trpc/server";
import { prisma } from "@/server/db";

export type WorkspaceRole = "owner" | "admin" | "member";

/**
 * Ensure the user belongs to the workspace (organization). Optionally enforce a
 * minimum set of roles. Returns the membership record.
 */
export async function assertMember(
  userId: string,
  organizationId: string,
  roles?: WorkspaceRole[],
) {
  const member = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });

  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this workspace.",
    });
  }

  if (roles && !roles.includes(member.role as WorkspaceRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Insufficient role for this action.",
    });
  }

  return member;
}

/** Resolve the workspace that owns a project and assert membership. */
export async function assertProjectAccess(
  userId: string,
  projectId: string,
  roles?: WorkspaceRole[],
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, organizationId: true },
  });

  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
  }

  await assertMember(userId, project.organizationId, roles);
  return project;
}
