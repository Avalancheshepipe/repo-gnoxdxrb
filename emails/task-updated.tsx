import { EmailLayout, t, type EmailLocale } from "./layout";
import {
  EmailButton,
  EmailHeading,
  EmailInfoBlock,
  EmailMuted,
  EmailParagraph,
} from "./components";

export type TaskUpdatedProps = {
  locale?: EmailLocale;
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

export function TaskUpdatedEmail({
  locale = "ru",
  recipientName,
  taskTitle,
  projectName,
  changesSummary,
  status,
  priority,
  tags,
  assignees,
  description,
  taskUrl,
}: TaskUpdatedProps) {
  const preview = t(
    locale,
    `Задача обновлена: ${taskTitle}`,
    `Task updated: ${taskTitle}`,
  );

  const snippet =
    description && description.length > 280
      ? `${description.slice(0, 277)}…`
      : description;

  return (
    <EmailLayout preview={preview} locale={locale}>
      <EmailHeading>
        {t(locale, "Задача обновлена", "Task updated")}
      </EmailHeading>
      <EmailParagraph>
        {locale === "ru"
          ? `Здравствуйте, ${recipientName}! Задача, за которой вы следите, была изменена.`
          : `Hi ${recipientName}! A task you're assigned to was updated.`}
      </EmailParagraph>
      <EmailMuted>
        {t(locale, "Изменения", "Changes")}: {changesSummary}
      </EmailMuted>
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

export default TaskUpdatedEmail;
