import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { emailTheme, t, type EmailLocale } from "./theme";

type LayoutProps = {
  preview: string;
  locale?: EmailLocale;
  children: ReactNode;
};

export function EmailLayout({ preview, locale = "ru", children }: LayoutProps) {
  const year = new Date().getFullYear();
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.outer}>
          <Section style={styles.header}>
            <Text style={styles.logo}>Julow</Text>
            <Section style={styles.accentBar} />
          </Section>
          <Section style={styles.card}>{children}</Section>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            {t(locale, "Julow — рабочее пространство команды с ИИ", "Julow — AI-native team workspace")}
            {" · "}
            <Link href="https://julow.app" style={styles.footerLink}>
              julow.app
            </Link>
            {" · © "}
            {year}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: emailTheme.bg,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    margin: 0,
    padding: "32px 16px",
  },
  outer: {
    maxWidth: "560px",
    margin: "0 auto",
  },
  header: {
    textAlign: "center" as const,
    marginBottom: "16px",
  },
  logo: {
    fontSize: "22px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: emailTheme.fg,
    margin: "0 0 12px",
  },
  accentBar: {
    height: "3px",
    borderRadius: "999px",
    background: `linear-gradient(90deg, ${emailTheme.gradientStart}, ${emailTheme.gradientMid}, ${emailTheme.gradientEnd})`,
    margin: "0 auto",
    width: "64px",
  },
  card: {
    backgroundColor: emailTheme.card,
    border: `1px solid ${emailTheme.cardBorder}`,
    borderRadius: "16px",
    padding: "28px 32px",
    boxShadow: "0 4px 24px rgba(26, 26, 34, 0.06)",
  },
  hr: {
    borderColor: emailTheme.cardBorder,
    margin: "24px 0 16px",
  },
  footer: {
    fontSize: "12px",
    lineHeight: "18px",
    color: emailTheme.footer,
    textAlign: "center" as const,
    margin: 0,
  },
  footerLink: {
    color: emailTheme.accent,
    textDecoration: "none",
  },
};

export { emailTheme, t };
export type { EmailLocale };
