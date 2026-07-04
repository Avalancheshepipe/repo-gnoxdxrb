import { activityRouter } from "@/server/trpc/routers/activity";
import { agentRouter } from "@/server/trpc/routers/agent";
import { agentActionRouter } from "@/server/trpc/routers/agent-action";
import { agentRunRouter } from "@/server/trpc/routers/agent-run";
import { approvalRouter } from "@/server/trpc/routers/approval";
import { attachmentRouter } from "@/server/trpc/routers/attachment";
import { automationRouter } from "@/server/trpc/routers/automation";
import { canvasRouter } from "@/server/trpc/routers/canvas";
import { chatRouter } from "@/server/trpc/routers/chat";
import { integrationRouter } from "@/server/trpc/routers/integration";
import { projectRouter } from "@/server/trpc/routers/project";
import { taskRouter } from "@/server/trpc/routers/task";
import { workspaceRouter } from "@/server/trpc/routers/workspace";
import { createCallerFactory, router } from "@/server/trpc/trpc";

export const appRouter = router({
  workspace: workspaceRouter,
  project: projectRouter,
  task: taskRouter,
  agent: agentRouter,
  agentAction: agentActionRouter,
  agentRun: agentRunRouter,
  approval: approvalRouter,
  attachment: attachmentRouter,
  activity: activityRouter,
  automation: automationRouter,
  integration: integrationRouter,
  canvas: canvasRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
