/** Julow brand colors for email (neutral, works in light + dark clients). */
export const emailTheme = {
  bg: "#f4f4f7",
  card: "#ffffff",
  cardBorder: "#e8e8ef",
  fg: "#1a1a22",
  muted: "#6b6b7b",
  accent: "#4f46e5",
  accentLight: "#eef2ff",
  gradientStart: "#f97316",
  gradientMid: "#a855f7",
  gradientEnd: "#3b82f6",
  footer: "#9494a8",
} as const;

export type EmailLocale = "ru" | "en";

export function t(locale: EmailLocale, ru: string, en: string): string {
  return locale === "ru" ? ru : en;
}
