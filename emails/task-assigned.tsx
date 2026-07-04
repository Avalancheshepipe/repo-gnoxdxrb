import { EmailLayout, t, type EmailLocale } from "./layout";
import {
  EmailButton,
  EmailHeading,
  EmailInfoBlock,
  EmailMuted,
  EmailParagraph,
} from "./components";

export type TaskAssignedProps = {
  locale?: EmailLocale;
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

export function TaskAssignedEmail({
  locale = "ru",
  assigneeName,
  taskTitle,
  projectName,
  status,
  priority,
  tags,
  assignees,
  description,
  taskUrl,
}: TaskAssignedProps) {
  const preview = t(
    locale,
    `Вам назначена задача: ${taskTitle}`,
    `You were assigned: ${taskTitle}`,
  );

  const snippet =
    description && description.length > 280
      ? `${description.slice(0, 277)}…`
      : description;

  return (
    <EmailLayout preview={preview} locale={locale}>
      <EmailHeading>
        {t(locale, "Новая задача для вас", "New task assigned to you")}
      </EmailHeading>
      <EmailParagraph>
        {locale === "ru"
          ? `Здравствуйте, ${assigneeName}! Вам назначена задача в проекте «${projectName}».`
          : `Hi ${assigneeName}! You were assigned a task in ${projectName}.`}
      </EmailParagraph>
      <EmailInfoBlock
        locale={locale}
        rows={[
          { label: t(locale, "Задача", "Task"), value: taskTitle },
          { label: t(locale, "Проект", "Project"), value: projectName },
          { label: t(locale, "Статус", "Status"), value: status },
          { label: t(locale, "Приоритет", "Priority"), value: priority },
          ...(tags.length
            ? [{ label: t(locale, "Теги", "Tags"), value: tags.map((x) => `#${x}`).join(" ") }]
            : []),
          ...(assignees.length
            ? [{ label: t(locale, "Исполнители", "Assignees"), value: assignees.join(", ") }]
            : []),
        ]}
      />
      {snippet && (
        <>
          <EmailMuted>{t(locale, "Описание", "Description")}</EmailMuted>
          <EmailParagraph>{snippet}</EmailParagraph>
        </>
      )}
      <EmailButton href={taskUrl}>
        {t(locale, "Открыть задачу", "Open task")}
      </EmailButton>
    </EmailLayout>
  );
}

export default TaskAssignedEmail;
