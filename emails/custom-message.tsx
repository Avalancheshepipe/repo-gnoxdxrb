import { EmailLayout, t, type EmailLocale } from "./layout";
import { EmailHeading, EmailParagraph } from "./components";

export type CustomMessageProps = {
  locale?: EmailLocale;
  organizationName: string;
  subject: string;
  bodyHtml: string;
  linkUrl?: string;
  linkLabel?: string;
};

/** Agent-proposed outbound email (human-approved). */
export function CustomMessageEmail({
  locale = "ru",
  organizationName,
  subject,
  bodyHtml,
  linkUrl,
  linkLabel,
}: CustomMessageProps) {
  const preview = subject;

  const bodyWithLink =
    linkUrl && linkLabel
      ? `${bodyHtml}<p style="margin:16px 0 0"><a href="${linkUrl}" style="color:#4f46e5;font-weight:600">${linkLabel}</a></p>`
      : bodyHtml;

  return (
    <EmailLayout preview={preview} locale={locale}>
      <EmailMutedOrg name={organizationName} locale={locale} />
      <EmailHeading as="h1">{subject}</EmailHeading>
      <div
        style={{
          color: "#1a1a22",
          fontSize: "15px",
          lineHeight: "24px",
        }}
        dangerouslySetInnerHTML={{ __html: bodyWithLink }}
      />
    </EmailLayout>
  );
}

function EmailMutedOrg({ name, locale }: { name: string; locale: EmailLocale }) {
  return (
    <EmailParagraph>
      {t(locale, `От ${name}`, `From ${name}`)}
    </EmailParagraph>
  );
}

export default CustomMessageEmail;
