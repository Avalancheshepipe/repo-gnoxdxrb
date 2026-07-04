import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { emailTheme, t, type EmailLocale } from "./theme";

export function EmailHeading({
  children,
  as = "h1",
}: {
  children: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <Heading as={as} style={as === "h1" ? styles.h1 : styles.h2}>
      {children}
    </Heading>
  );
}

export function EmailParagraph({ children }: { children: ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
}

export function EmailMuted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Section style={{ textAlign: "center", margin: "24px 0 8px" }}>
      <Button href={href} style={styles.button}>
        {children}
      </Button>
    </Section>
  );
}

export function EmailInfoBlock({
  rows,
  locale = "ru",
}: {
  rows: { label: string; value: string }[];
  locale?: EmailLocale;
}) {
  return (
    <Section style={styles.infoBlock}>
      {rows.map((row, i) => (
        <Section key={i} style={styles.infoRow}>
          <Text style={styles.infoLabel}>{row.label}</Text>
          <Text style={styles.infoValue}>{row.value}</Text>
        </Section>
      ))}
      <Hr style={styles.infoHr} />
      <Text style={styles.infoHint}>
        {t(locale, "Открыть в Julow", "Open in Julow")}
      </Text>
    </Section>
  );
}

const styles = {
  h1: {
    color: emailTheme.fg,
    fontSize: "22px",
    fontWeight: 600,
    lineHeight: "28px",
    margin: "0 0 12px",
    letterSpacing: "-0.02em",
  },
  h2: {
    color: emailTheme.fg,
    fontSize: "16px",
    fontWeight: 600,
    lineHeight: "22px",
    margin: "16px 0 8px",
  },
  p: {
    color: emailTheme.fg,
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 12px",
  },
  muted: {
    color: emailTheme.muted,
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 12px",
  },
  button: {
    backgroundColor: emailTheme.accent,
    borderRadius: "10px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    padding: "12px 28px",
  },
  infoBlock: {
    backgroundColor: emailTheme.accentLight,
    borderRadius: "12px",
    padding: "16px 18px",
    margin: "16px 0",
  },
  infoRow: {
    marginBottom: "8px",
  },
  infoLabel: {
    color: emailTheme.muted,
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    margin: "0 0 2px",
  },
  infoValue: {
    color: emailTheme.fg,
    fontSize: "14px",
    lineHeight: "20px",
    margin: 0,
  },
  infoHr: {
    borderColor: emailTheme.cardBorder,
    margin: "12px 0 8px",
  },
  infoHint: {
    color: emailTheme.muted,
    fontSize: "12px",
    margin: 0,
  },
};
