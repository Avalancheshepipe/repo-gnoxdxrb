import { Bot } from "grammy";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { enqueueAgentRun } from "@/server/queue/enqueue";

let botRef: Bot | undefined;

/** Lazily create the shared grammY bot with handlers registered once. */
export function getBot(): Bot {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }
  if (botRef) return botRef;

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  registerHandlers(bot);
  botRef = bot;
  return bot;
}

async function findIntegrationByChat(chatId: string) {
  return prisma.integration.findFirst({
    where: {
      type: "TELEGRAM",
      connected: true,
      config: { path: ["chatId"], equals: chatId },
    },
  });
}

function registerHandlers(bot: Bot) {
  bot.command("start", async (ctx) => {
    await ctx.reply(
      [
        "Julow bot connected.",
        "",
        `This chat ID is: <code>${ctx.chat.id}</code>`,
        "",
        "In Julow → Integrations, connect this chat to your workspace, then mention an agent like:",
        "<i>@Research summarize this week's competitor moves</i>",
      ].join("\n"),
      { parse_mode: "HTML" },
    );
  });

  bot.command("id", async (ctx) => {
    await ctx.reply(`Chat ID: <code>${ctx.chat.id}</code>`, {
      parse_mode: "HTML",
    });
  });

  // @mention relay: "@AgentName do something" → create task + dispatch agent.
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const mention = text.match(/@([A-Za-z][\w-]*)/);
    if (!mention) return;

    const integration = await findIntegrationByChat(String(ctx.chat.id));
    if (!integration) return;

    const agentName = mention[1];
    const agent = await prisma.agent.findFirst({
      where: {
        organizationId: integration.organizationId,
        name: { contains: agentName, mode: "insensitive" },
      },
    });
    if (!agent) {
      await ctx.reply(`No agent matching "${agentName}".`);
      return;
    }

    const project = await prisma.project.findFirst({
      where: { organizationId: integration.organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!project) return;

    const title =
      text.replace(/@[A-Za-z][\w-]*/, "").trim().slice(0, 200) ||
      "Task from Telegram";

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title,
        assignees: { create: { agentId: agent.id } },
      },
    });
    const run = await prisma.agentRun.create({
      data: {
        agentId: agent.id,
        taskId: task.id,
        status: "QUEUED",
        input: { prompt: `From Telegram: ${text}` },
      },
    });
    await enqueueAgentRun(run.id);
    await prisma.activityLog.create({
      data: {
        organizationId: integration.organizationId,
        type: "AGENT",
        actor: agent.name,
        action: "started task from Telegram",
        target: title,
      },
    });

    await ctx.reply(`✅ Created “${title}” and dispatched ${agent.name}.`);
  });
}
