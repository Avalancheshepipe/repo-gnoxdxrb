/**
 * Native design tokens — a hand-tuned port of the web app's oklch palette
 * (see src/app/globals.css). Values are approximated to sRGB so they read the
 * same on device: cool off-white light theme, near-black glass dark theme, and
 * the signature orange / purple / blue glow trio.
 */

export type ThemeName = "light" | "dark";

export type Theme = {
  name: ThemeName;
  /** Page background base color (behind the glow). */
  bg: string;
  /** Primary text. */
  fg: string;
  /** Secondary / muted text. */
  muted: string;
  /** Faint text (timestamps, hints). */
  faint: string;
  /** Accent (indigo). */
  accent: string;
  accentFg: string;
  accentSoft: string;
  /** Opaque elevated surface (sheets, dropdowns, cards that must not bleed). */
  surface: string;
  surfaceElevated: string;
  /** Hairline borders. */
  border: string;
  borderStrong: string;
  /** Translucent glass fill used under BlurView. */
  glass: string;
  glassStrong: string;
  /** Frosted fill for the top bar / tab bar (more opaque so the glow behind
   * reads as a clean frosted panel rather than bleeding through). */
  barFill: string;
  /** Chrome fill on Android without native blur — matches iOS frosted bar read. */
  barFillSolid: string;
  /** Input fields. */
  inputBg: string;
  inputBorder: string;
  /** Status colors. */
  success: string;
  warning: string;
  danger: string;
  /** BlurView tint ("light" | "dark" | "default"). */
  blurTint: "light" | "dark";
  /** Glow trio for the gradient background. */
  glow: {
    orange: string;
    purple: string;
    blue: string;
    /** Opacity multiplier for the whole glow layer. */
    intensity: number;
  };
};

export const lightTheme: Theme = {
  name: "light",
  bg: "#F6F6F8",
  fg: "#2A2A30",
  muted: "#71717A",
  faint: "#A1A1AA",
  accent: "#5B61E6",
  accentFg: "#FFFFFF",
  accentSoft: "rgba(91, 97, 230, 0.12)",
  surface: "#FDFDFF",
  surfaceElevated: "#FFFFFF",
  border: "rgba(42, 42, 48, 0.10)",
  borderStrong: "rgba(42, 42, 48, 0.16)",
  glass: "rgba(255, 255, 255, 0.65)",
  glassStrong: "rgba(255, 255, 255, 0.80)",
  barFill: "rgba(250, 250, 252, 0.70)",
  barFillSolid: "rgba(252, 252, 254, 0.94)",
  inputBg: "#F1F1F4",
  inputBorder: "rgba(42, 42, 48, 0.14)",
  success: "#1FA971",
  warning: "#E0A52E",
  danger: "#E0533C",
  blurTint: "light",
  // Matched to the web mesh (--julow-gradient-1/2/3, light).
  glow: {
    orange: "#EEAB6E",
    purple: "#C4A8E0",
    blue: "#A7C7E9",
    intensity: 1,
  },
};

export const darkTheme: Theme = {
  name: "dark",
  bg: "#07070A",
  fg: "#EBEBEE",
  muted: "#85858D",
  faint: "#5C5C66",
  accent: "#7C84F0",
  accentFg: "#0B0B0E",
  accentSoft: "rgba(124, 132, 240, 0.16)",
  surface: "#16161A",
  surfaceElevated: "#1E1E22",
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.14)",
  glass: "rgba(255, 255, 255, 0.08)",
  glassStrong: "rgba(255, 255, 255, 0.12)",
  barFill: "rgba(10, 10, 14, 0.65)",
  barFillSolid: "rgba(18, 18, 22, 0.92)",
  inputBg: "rgba(255, 255, 255, 0.05)",
  inputBorder: "rgba(255, 255, 255, 0.10)",
  success: "#37C98B",
  warning: "#E9B65C",
  danger: "#F0654A",
  blurTint: "dark",
  // Matched to the web mesh (--julow-gradient-1/2/3, dark).
  glow: {
    orange: "#773A00",
    purple: "#49317A",
    blue: "#014B79",
    intensity: 1.15,
  },
};

export const themes: Record<ThemeName, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};

/** Shared geometry tokens (match the web shell). */
export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const layout = {
  topbarHeight: 56,
  tabBarHeight: 64,
  tabBarFloatGap: 12,
  tabBarSideGap: 12,
};
