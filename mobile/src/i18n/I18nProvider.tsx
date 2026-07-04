import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getActiveLocale,
  getLocaleMode,
  setLocaleMode,
  type Locale,
  type LocaleMode,
} from "../strings";

const STORAGE_KEY = "julow_locale_mode";

type I18nContextValue = {
  /** User preference: system / ru / en. */
  mode: LocaleMode;
  /** Resolved active locale (after applying system detection). */
  locale: Locale;
  setMode: (mode: LocaleMode) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Holds the language preference and keeps the module-level `t()` locale in sync.
 * Persists the choice and re-renders consumers on change; the root Stack is
 * keyed by `locale` so a switch re-evaluates every `t()` in the tree.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LocaleMode>(getLocaleMode());
  const [locale, setLocaleState] = useState<Locale>(getActiveLocale());

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (stored === "system" || stored === "ru" || stored === "en") {
          setLocaleMode(stored);
          setModeState(stored);
          setLocaleState(getActiveLocale());
        }
      })
      .catch(() => {});
  }, []);

  const setMode = (next: LocaleMode) => {
    setLocaleMode(next);
    setModeState(next);
    setLocaleState(getActiveLocale());
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
  };

  const value = useMemo<I18nContextValue>(
    () => ({ mode, locale, setMode }),
    [mode, locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
