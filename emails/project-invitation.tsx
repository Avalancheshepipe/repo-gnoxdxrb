import { EmailLayout, t, type EmailLocale } from "./layout";
import { EmailButton, EmailHeading, EmailMuted, EmailParagraph } from "./components";

export type ProjectInvitationProps = {
  locale?: EmailLocale;
  workspaceName: string;
  invitedBy: string;
  role: string;
  inviteUrl: string;
};

export function ProjectInvitationEmail({
  locale = "ru",
  workspaceName,
  invitedBy,
  role,
  inviteUrl,
}: ProjectInvitationProps) {
  const preview = t(
    locale,
    `${invitedBy} приглашает вас в ${workspaceName}`,
    `${invitedBy} invited you to ${workspaceName}`,
  );

  return (
    <EmailLayout preview={preview} locale={locale}>
      <EmailHeading>
        {t(locale, "Приглашение в рабочее пространство", "Workspace invitation")}
      </EmailHeading>
      <EmailParagraph>
        {locale === "ru"
          ? `${invitedBy} приглашает вас присоединиться к «${workspaceName}» в Julow в роли «${role}».`
          : `${invitedBy} invited you to join ${workspaceName} on Julow as ${role}.`}
      </EmailParagraph>
      <EmailMuted>
        {t(
          locale,
          "Julow — пространство для задач, досок и ИИ-агентов вашей команды.",
          "Julow is your team's shared canvas for tasks, boards, and AI agents.",
        )}
      </EmailMuted>
      <EmailButton href={inviteUrl}>
        {t(locale, "Принять приглашение", "Accept invitation")}
      </EmailButton>
      <EmailMuted>
        {t(
          locale,
          "Ссылка действует 7 дней. Если вы не ожидали это письмо — просто проигнорируйте его.",
          "This link expires in 7 days. If you weren't expecting this, you can ignore this email.",
        )}
      </EmailMuted>
    </EmailLayout>
  );
}

export default ProjectInvitationEmail;
