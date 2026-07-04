import "dotenv/config";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { priorityToDb, statusToDb } from "@/lib/task-mappers";
import {
  activities,
  automationRules,
  canvasNodes,
  inboxTasks,
  messengerChannels,
  teamAgents,
} from "@/lib/workspace-data";

const DEMO_EMAIL = "demo@julow.dev";
const DEMO_PASSWORD = "julow-demo-1234";

async function ensureDemoUser(): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) return existing.id;

  await auth.api.signUpEmail({
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "Demo Owner" },
  });

  const created = await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_EMAIL },
  });
  return created.id;
}

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

async function main() {
  console.log("Seeding Julow demo workspace...");
  const ownerId = await ensureDemoUser();

  const org = await prisma.organization.upsert({
    where: { slug: "q2-launch" },
    update: {},
    create: {
      name: "Q2 Product Launch",
      slug: "q2-launch",
      members: { create: { userId: ownerId, role: "owner" } },
    },
  });

  // Projects (from the distinct project names used by the mock tasks/canvas).
  const projectNames = Array.from(
    new Set([
      ...inboxTasks.map((t) => t.project),
      "Design System",
      "Platform Infra",
    ]),
  );
  const projectByName = new Map<string, string>();
  for (const name of projectNames) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const project = await prisma.project.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug } },
      update: {},
      create: {
        organizationId: org.id,
        name,
        slug,
        canvas: { create: {} },
      },
    });
    projectByName.set(name, project.id);
  }
  const primaryProjectId = projectByName.get(inboxTasks[0]!.project)!;

  // Agents
  const agentByName = new Map<string, string>();
  for (const agent of teamAgents) {
    const existing = await prisma.agent.findFirst({
      where: { organizationId: org.id, name: agent.name },
    });
    const row =
      existing ??
      (await prisma.agent.create({
        data: {
          organizationId: org.id,
          name: agent.name,
          role: agent.role,
          responsibility: agent.responsibility,
          systemPrompt: `You are ${agent.name}, ${agent.role}. ${agent.responsibility}`,
          model: process.env.AI_GATEWAY_DEFAULT_MODEL ?? "openai/gpt-4o-mini",
          tools: agent.capabilities,
          status: agent.status.toUpperCase() as
            | "ONLINE"
            | "BUSY"
            | "IDLE"
            | "OFFLINE",
        },
      }));
    agentByName.set(agent.name, row.id);
  }

  // Human teammates referenced by tasks (besides "You" -> owner).
  const humanIds = new Map<string, string>([["You", ownerId]]);
  for (const task of inboxTasks) {
    for (const a of task.assignees) {
      if (a.type !== "human" || humanIds.has(a.name)) continue;
      const email = `${a.name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@julow.dev`;
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { name: a.name, email },
      });
      await prisma.member.upsert({
        where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
        update: {},
        create: { organizationId: org.id, userId: user.id, role: "member" },
      });
      humanIds.set(a.name, user.id);
    }
  }

  // Tasks
  for (const task of inboxTasks) {
    const projectId = projectByName.get(task.project) ?? primaryProjectId;
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
          create: task.assignees.map((a) =>
            a.type === "agent"
              ? { agentId: agentByName.get(a.name)! }
              : { userId: humanIds.get(a.name)! },
          ),
        },
      },
    });
  }

  // Automations
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

  // Integrations (skip unsupported "brf" platform)
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

  // Activity log
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

  // Canvas nodes + edges on the primary project
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
          data: { projectId: primaryProjectId, sourceId, targetId, kind: "RELATES" },
        });
      }
    }
  }

  console.log(`Seed complete. Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
