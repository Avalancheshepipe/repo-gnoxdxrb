import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authClient } from "../src/auth";
import { AppHeader } from "../src/components/AppHeader";
import { useScrollHeader } from "../src/hooks/useScrollHeader";
import { useI18n } from "../src/i18n/I18nProvider";
import { t } from "../src/strings";
import type { LocaleMode } from "../src/strings";
import { Card } from "../src/ui/Card";
import { Icon } from "../src/ui/Icon";
import { IconButton } from "../src/ui/IconButton";
import { Icons } from "../src/ui/icons";
import { PressableScale } from "../src/ui/PressableScale";
import { Txt } from "../src/ui/Txt";
import { useTheme } from "../src/theme/ThemeProvider";
import { radius } from "../src/theme/tokens";

function initials(value: string): string {
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

const MODES = [
  { id: "system", labelKey: "account.system", icon: null },
  { id: "light", labelKey: "account.light", icon: Icons.sun },
  { id: "dark", labelKey: "account.dark", icon: Icons.moon },
] as const;

const LANGS: { id: LocaleMode; label: string }[] = [
  { id: "system", label: "account.system" },
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
];

export default function AccountScreen() {
  const { theme, mode, setMode } = useTheme();
  const { mode: langMode, setMode: setLang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const { scrollY, scrollHandler } = useScrollHeader();

  const name = data?.user?.name ?? "You";
  const email = data?.user?.email ?? "";

  const signOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } finally {
      router.replace("/sign-in");
    }
  };

  return (
    <View style={styles.flex}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + 56 + 16,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
            <Txt variant="title" color={theme.accent} style={{ fontSize: 22 }}>
              {initials(name)}
            </Txt>
          </View>
          <Txt variant="heading" style={{ marginTop: 12 }}>
            {name}
          </Txt>
          {email ? <Txt variant="muted">{email}</Txt> : null}
        </View>

        <View>
          <Txt variant="caption" style={styles.sectionLabel}>
            {t("account.appearance").toUpperCase()}
          </Txt>
          <Card style={{ padding: 6, gap: 0 }}>
            <View style={styles.segment}>
              {MODES.map((m) => {
                const active = mode === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setMode(m.id)}
                    style={[
                      styles.segmentItem,
                      active && { backgroundColor: theme.accentSoft },
                    ]}
                  >
                    {m.icon ? (
                      <Icon
                        icon={m.icon}
                        size={15}
                        color={active ? theme.accent : theme.muted}
                      />
                    ) : null}
                    <Txt
                      variant="label"
                      color={active ? theme.accent : theme.muted}
                    >
                      {t(m.labelKey as never)}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </View>

        <View>
          <Txt variant="caption" style={styles.sectionLabel}>
            {t("account.language").toUpperCase()}
          </Txt>
          <Card style={{ padding: 6, gap: 0 }}>
            <View style={styles.segment}>
              {LANGS.map((l) => {
                const active = langMode === l.id;
                const text = l.label.startsWith("account.")
                  ? t(l.label as never)
                  : l.label;
                return (
                  <Pressable
                    key={l.id}
                    onPress={() => setLang(l.id)}
                    style={[
                      styles.segmentItem,
                      active && { backgroundColor: theme.accentSoft },
                    ]}
                  >
                    <Txt
                      variant="label"
                      color={active ? theme.accent : theme.muted}
                    >
                      {text}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </View>

        <PressableScale
          onPress={signOut}
          disabled={signingOut}
          style={[
            styles.signOut,
            { borderColor: theme.border, opacity: signingOut ? 0.6 : 1 },
          ]}
        >
          <Icon icon={Icons.logout} size={17} color={theme.danger} />
          <Txt variant="label" color={theme.danger}>
            {t("account.signOut")}
          </Txt>
        </PressableScale>
      </Animated.ScrollView>

      <AppHeader
        title={t("account.title")}
        scrollY={scrollY}
        left={
          <IconButton
            icon={Icons.arrowLeft}
            onPress={() => router.back()}
            accessibilityLabel={t("common.back")}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profile: { alignItems: "center", paddingVertical: 12 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: { marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 },
  segment: { flexDirection: "row", gap: 4 },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
});
