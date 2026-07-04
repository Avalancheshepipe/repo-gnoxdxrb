import { useRouter } from "expo-router";
import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { type SharedValue } from "react-native-reanimated";
import { authClient } from "../auth";
import { t } from "../strings";
import { IconButton } from "../ui/IconButton";
import { Icons } from "../ui/icons";
import { PressableScale } from "../ui/PressableScale";
import { Txt } from "../ui/Txt";
import { useTheme } from "../theme/ThemeProvider";
import { AppHeader } from "./AppHeader";

function initials(value: string): string {
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

function Avatar({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  const { data } = authClient.useSession();
  const label = data?.user?.name ?? data?.user?.email ?? "You";

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("account.title")}
      style={[styles.avatar, { backgroundColor: theme.accentSoft }]}
    >
      <Txt variant="caption" color={theme.accent} style={styles.avatarText}>
        {initials(label)}
      </Txt>
    </PressableScale>
  );
}

/**
 * Standard tab header: a search affordance on the left, the screen title, and
 * the AI agent shortcut + account avatar on the right — mirroring the web shell.
 */
export function ScreenHeader({
  title,
  subtitle,
  rightExtra,
  scrollY,
}: {
  title: string;
  subtitle?: string;
  rightExtra?: ReactNode;
  scrollY?: SharedValue<number>;
}) {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <AppHeader
      title={title}
      subtitle={subtitle}
      scrollY={scrollY}
      left={
        <IconButton
          icon={Icons.search}
          onPress={() => router.push("/search")}
          accessibilityLabel={t("search.title")}
        />
      }
      right={
        <View style={styles.right}>
          {rightExtra}
          <IconButton
            icon={Icons.agent}
            color={theme.accent}
            tinted
            onPress={() => router.push("/agent-chat")}
            accessibilityLabel={t("nav.agents")}
          />
          <Avatar onPress={() => router.push("/account")} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "700" },
});
