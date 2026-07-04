import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { AgentTaskResultEmail } from "../../../emails/agent-task-result";
import { CustomMessageEmail } from "../../../emails/custom-message";
import { ProjectInvitationEmail } from "../../../emails/project-invitation";
import { TaskAssignedEmail } from "../../../emails/task-assigned";
import { TaskUpdatedEmail } from "../../../emails/task-updated";
import type { EmailJobPayload, RenderedEmail } from "./types";

export async function renderEmailJob(payload: EmailJobPayload): Promise<RenderedEmail> {
  const locale = payload.locale ?? "ru";
  let element: ReactElement;

  switch (payload.template) {
    case "project-invitation":
      element = <ProjectInvitationEmail locale={locale} {...payload.props} />;
      break;
    case "task-assigned":
      element = <TaskAssignedEmail locale={locale} {...payload.props} />;
      break;
    case "task-updated":
      element = <TaskUpdatedEmail locale={locale} {...payload.props} />;
      break;
    case "agent-task-result":
      element = <AgentTaskResultEmail locale={locale} {...payload.props} />;
      break;
    case "custom-message":
      element = <CustomMessageEmail locale={locale} {...payload.props} />;
      break;
  }

  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text, element };
}
