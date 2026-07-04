import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceLayoutClient } from "@/components/workspace/workspace-layout-client";
import { auth } from "@/server/auth";
import { ensureWorkspaceForUser } from "@/server/bootstrap";

export const metadata: Metadata = {
  title: "Workspace — Julow",
  description: "Team workspace with agents, tasks, and automation.",
};

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in?redirect=/app");

  // Guarantee the user always lands in a real, populated workspace.
  await ensureWorkspaceForUser(session.user.id, session.user.name);

  return <WorkspaceLayoutClient>{children}</WorkspaceLayoutClient>;
}
