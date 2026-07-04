import { EmailLayout, t, type EmailLocale } from "./layout";
import {
  EmailButton,
  EmailHeading,
  EmailMuted,
  EmailParagraph,
} from "./components";

export type AgentTaskResultProps = {
  locale?: EmailLocale;
  recipientName: string;
  agentName: string;
  taskTitle: string;
  projectName: string;
  resultSummary: string;
  taskUrl: string;
  fileUrl?: string;
  fileName?: string;
};

export function AgentTaskResultEmail({
  locale = "ru",
  recipientName,
  agentName,
  taskTitle,
  projectName,
  resultSummary,
  taskUrl,
  fileUrl,
  fileName,
}: AgentTaskResultProps) {
  const preview = t(
    locale,
    `${agentName} завершил работу над «${taskTitle}»`,
    `${agentName} finished work on "${taskTitle}"`,
  );

  const summary =
    resultSummary.length > 600 ? `${resultSummary.slice(0, 597)}…` : resultSummary;

  return (
    <EmailLayout preview={preview} locale={locale}>
      <EmailHeading>
        {t(locale, "Агент завершил задачу", "Agent completed task work")}
      </EmailHeading>
      <EmailParagraph>
        {locale === "ru"
          ? `Здравствуйте, ${recipientName}! Агент «${agentName}» завершил автономную работу над задачей «${taskTitle}» в проекте «${projectName}».`
          : `Hi ${recipientName}! Agent "${agentName}" finished autonomous work on "${taskTitle}" in ${projectName}.`}
      </EmailParagraph>
      <EmailMuted>{t(locale, "Результат", "Result")}</EmailMuted>
      <EmailParagraph>{summary}</EmailParagraph>
      {fileUrl && (
        <EmailButton href={fileUrl}>
          {fileName
            ? t(locale, `Скачать ${fileName}`, `Download ${fileName}`)
            : t(locale, "Скачать файл", "Download file")}
        </EmailButton>
      )}
      <EmailButton href={taskUrl}>
        {t(locale, "Открыть задачу", "Open task")}
      </EmailButton>
    </EmailLayout>
  );
}

export default AgentTaskResultEmail;
