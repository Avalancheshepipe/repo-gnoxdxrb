// Per-user workspace provisioning. Runs on first authenticated visit to /app so
// every account lands in a REAL, populated workspace (no mock data in the UI).
// Idempotent: if the user already belongs to a workspace, this is a no-op.

import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { priorityToDb, statusToDb } from "@/lib/task-mappers";
import {
  activities,
  automationRules,
  canvasNodes,
  inboxTasks,
  messengerChannels,
  teamAgents,
} from "@/lib/workspace-data";

const integrationTypeMap: Record<string, "TELEGRAM" | "DISCORD" | "SLACK" | null> =
  {
    telegram: "TELEGRAM",
    discord: "DISCORD",
    slack: "SLACK",
    brf: null,
  };

const activityTypeMap: Record<string, "AGENT" | "TASK" | "AUTOMATION"> = {
  agent: "AGENT",
  task: "TASK",
  automation: "AUTOMATION",
};

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  );
}

async function uniqueOrgSlug(base: string): Promise<string> {
  let slug = base;
  for (
    let i = 1;
    await prisma.organization.findUnique({ where: { slug } });
    i++
  ) {
    slug = `${base}-${i}`;
  }
  return slug;
}

/**
 * Ensure the user has at least one workspace. Returns the id of their first
 * (or newly created) workspace. Safe to call on every request — it returns
 * early when a membership already exists.
 */
export async function ensureWorkspaceForUser(
  userId: string,
  displayName?: string | null,
): Promise<string> {
  const existing = await prisma.member.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (existing) return existing.organizationId;

  const firstName = (displayName ?? "").trim().split(/\s+/)[0];
  const workspaceName = firstName ? `${firstName}'s Workspace` : "My Workspace";
  const slug = await uniqueOrgSlug(slugify(workspaceName));

  const org = await prisma.organization.create({
    data: {
      name: workspaceName,
      slug,
      members: { create: { userId, role: "owner" } },
    },
  });

  // Projects referenced by the starter tasks (+ a couple of extras).
  const projectNames = Array.from(
    new Set([
      ...inboxTasks.map((t) => t.project),
      "Design System",
      "Platform Infra",
    ]),
  );
  const projectByName = new Map<string, string>();
  for (const name of projectNames) {
    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name,
        slug: slugify(name),
        canvas: { create: {} },
      },
    });
    projectByName.set(name, project.id);
  }
  const primaryProjectId = projectByName.get(inboxTasks[0]!.project)!;

  // Agent — the workspace's single universal assistant.
  const agentByName = new Map<string, string>();
  for (const agent of teamAgents) {
    const created = await prisma.agent.create({
      data: {
        organizationId: org.id,
        name: agent.name,
        role: agent.role,
        responsibility: agent.responsibility,
        systemPrompt: `You are ${agent.name}, ${agent.role}. ${agent.responsibility}`,
        model: env.AI_GATEWAY_DEFAULT_MODEL,
        tools: agent.capabilities,
        status: agent.status.toUpperCase() as
          | "ONLINE"
          | "BUSY"
          | "IDLE"
          | "OFFLINE",
      },
    });
    agentByName.set(agent.name, created.id);
  }

  // Tasks. Human assignees collapse onto the owner (no fake teammates); agent
  // assignees map to the roster created above.
  for (const task of inboxTasks) {
    const projectId = projectByName.get(task.project) ?? primaryProjectId;
    const agentIds = Array.from(
      new Set(
        task.assignees
          .filter((a) => a.type === "agent")
          .map((a) => agentByName.get(a.name))
          .filter((v): v is string => Boolean(v)),
      ),
    );
    const hasHuman = task.assignees.some((a) => a.type === "human");

    await prisma.task.create({
      data: {
        projectId,
        title: task.title,
        description: task.description,
        status: statusToDb(task.status),
        priority: priorityToDb(task.priority),
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        tags: task.tags,
        assignees: {
          create: [
            ...(hasHuman ? [{ userId }] : []),
            ...agentIds.map((agentId) => ({ agentId })),
          ],
        },
      },
    });
  }

  // Automations.
  for (const rule of automationRules) {
    await prisma.automation.create({
      data: {
        organizationId: org.id,
        name: rule.name,
        description: rule.description,
        trigger: { type: "custom", label: rule.trigger },
        action: { type: "custom", label: rule.action },
        enabled: rule.enabled,
        aiManaged: rule.aiManaged,
        runsToday: rule.runsToday,
      },
    });
  }

  // Integrations (skip unsupported "brf" platform).
  for (const channel of messengerChannels) {
    const type = integrationTypeMap[channel.platform];
    if (!type) continue;
    await prisma.integration.create({
      data: {
        organizationId: org.id,
        type,
        name: channel.name,
        handle: channel.handle,
        connected: channel.connected,
        lastMessage: channel.lastMessage,
        config: {},
      },
    });
  }

  // Activity log.
  for (const item of [...activities].reverse()) {
    await prisma.activityLog.create({
      data: {
        organizationId: org.id,
        type: activityTypeMap[item.type] ?? "TASK",
        actor: item.actor,
        action: item.action,
        target: item.target,
      },
    });
  }

  // Canvas (nodes + edges) on the primary project.
  const nodeIdMap = new Map<string, string>();
  for (const node of canvasNodes) {
    const created = await prisma.canvasNode.create({
      data: {
        projectId: primaryProjectId,
        type: node.type.toUpperCase() as "TASK" | "NOTE" | "AGENT" | "MILESTONE",
        title: node.title,
        subtitle: node.subtitle,
        status: node.status,
        x: node.x,
        y: node.y,
        width: node.width,
      },
    });
    nodeIdMap.set(node.id, created.id);
  }
  for (const node of canvasNodes) {
    for (const target of node.connections ?? []) {
      const sourceId = nodeIdMap.get(node.id);
      const targetId = nodeIdMap.get(target);
      if (sourceId && targetId) {
        await prisma.canvasEdge.create({
          data: {
            projectId: primaryProjectId,
            sourceId,
            targetId,
            kind: "RELATES",
          },
        });
      }
    }
  }

  return org.id;
}
