import type { ReactElement } from "react";
import type { EmailLocale } from "../../../emails/theme";

export type EmailTemplateName =
  | "project-invitation"
  | "task-assigned"
  | "task-updated"
  | "agent-task-result"
  | "custom-message";

export type EmailJobPayload =
  | {
      template: "project-invitation";
      to: string;
      subject: string;
      locale?: EmailLocale;
      organizationId?: string;
      props: {
        workspaceName: string;
        invitedBy: string;
        role: string;
        inviteUrl: string;
      };
    }
  | {
      template: "task-assigned";
      to: string;
      subject: string;
      locale?: EmailLocale;
      organizationId?: string;
      props: {
        assigneeName: string;
        taskTitle: string;
        projectName: string;
        status: string;
        priority: string;
        tags: string[];
        assignees: string[];
        description?: string;
        taskUrl: string;
      };
    }
  | {
      template: "task-updated";
      to: string;
      subject: string;
      locale?: EmailLocale;
      organizationId?: string;
      props: {
        recipientName: string;
        taskTitle: string;
        projectName: string;
        changesSummary: string;
        status: string;
        priority: string;
        tags: string[];
        assignees: string[];
        description?: string;
        taskUrl: string;
      };
    }
  | {
      template: "agent-task-result";
      to: string;
      subject: string;
      locale?: EmailLocale;
      organizationId?: string;
      props: {
        recipientName: string;
        agentName: string;
        taskTitle: string;
        projectName: string;
        resultSummary: string;
        taskUrl: string;
        fileUrl?: string;
        fileName?: string;
      };
    }
  | {
      template: "custom-message";
      to: string;
      subject: string;
      locale?: EmailLocale;
      organizationId?: string;
      props: {
        organizationName: string;
        subject: string;
        bodyHtml: string;
        linkUrl?: string;
        linkLabel?: string;
      };
    };

export type RenderedEmail = {
  html: string;
  text: string;
  element: ReactElement;
};
