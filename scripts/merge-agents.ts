/**
 * One-off migration: collapse every workspace's agent roster into a single
 * universal agent. For each organization:
 *   1. Pick the first agent (by createdAt) as the "main" agent.
 *   2. Update its name/role/tools to the universal defaults.
 *   3. Reassign all TaskAssignee, TaskAgentBrief, AgentRun, ChatThread,
 *      Comment, ProjectAgent rows from other agents to the main agent.
 *   4. Null out reportsToId on the main agent.
 *   5. Delete the other agents.
 *
 * Usage:  npx tsx scripts/merge-agents.ts
 */
import { prisma } from "@/server/db";

const UNIVERSAL_NAME = "Julow Agent";
const UNIVERSAL_ROLE = "Universal workspace assistant";
const UNIVERSAL_RESPONSIBILITY =
  "Manages tasks, creates documents (Word/Excel/PDF), does web research, reviews work, compiles reports, and splits large objectives into parallel sub-tasks.";
const UNIVERSAL_TOOLS = [
  "create_task",
  "update_task",
  "research",
  "create_document",
  "review",
  "test",
  "report",
  "canvas",
  "delegate",
];

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true },
  });
  console.log(`Merging agents for ${orgs.length} organization(s)...`);

  for (const org of orgs) {
    const agents = await prisma.agent.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
    if (agents.length === 0) {
      console.log(`  [${org.id}] no agents — skipping`);
      continue;
    }

    const mainId = agents[0]!.id;
    const others = agents.slice(1).map((a) => a.id);

    // 1. Reassign everything from other agents to the main agent.
    if (others.length > 0) {
      await prisma.taskAssignee.updateMany({
        where: { agentId: { in: others } },
        data: { agentId: mainId },
      });
      await prisma.taskAgentBrief.updateMany({
        where: { agentId: { in: others } },
        data: { agentId: mainId },
      });
      await prisma.agentRun.updateMany({
        where: { agentId: { in: others } },
        data: { agentId: mainId },
      });
      await prisma.chatThread.updateMany({
        where: { agentId: { in: others } },
        data: { agentId: mainId },
      });
      await prisma.comment.updateMany({
        where: { agentId: { in: others } },
        data: { agentId: mainId },
      });
      await prisma.projectAgent.updateMany({
        where: { agentId: { in: others } },
        data: { agentId: mainId },
      });
      // Delete the other agents
      await prisma.agent.deleteMany({
        where: { id: { in: others } },
      });
    }

    // 2. Update the main agent to the universal defaults.
    await prisma.agent.update({
      where: { id: mainId },
      data: {
        name: UNIVERSAL_NAME,
        role: UNIVERSAL_ROLE,
        responsibility: UNIVERSAL_RESPONSIBILITY,
        systemPrompt: `You are ${UNIVERSAL_NAME}, ${UNIVERSAL_ROLE}. ${UNIVERSAL_RESPONSIBILITY}`,
        tools: UNIVERSAL_TOOLS,
        reportsToId: null,
      },
    });

    console.log(
      `  [${org.id}] merged ${agents.length} → 1 (main: ${mainId})`,
    );
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
