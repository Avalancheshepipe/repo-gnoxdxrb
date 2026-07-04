import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import * as SystemUI from "expo-system-ui";
import { darkTheme, lightTheme, type Theme, type ThemeName } from "./tokens";

type ThemeMode = "system" | ThemeName;

type ThemeContextValue = {
  theme: Theme;
  scheme: ThemeName;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>("system");

  const scheme: ThemeName =
    mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
  const theme = scheme === "dark" ? darkTheme : lightTheme;

  useEffect(() => {
    // Keep the native root background in sync so there is no white/black flash
    // behind the gradient during transitions and overscroll.
    SystemUI.setBackgroundColorAsync(theme.bg).catch(() => {});
  }, [theme.bg]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      scheme,
      mode,
      setMode,
      toggle: () => setMode(scheme === "dark" ? "light" : "dark"),
    }),
    [theme, scheme, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
