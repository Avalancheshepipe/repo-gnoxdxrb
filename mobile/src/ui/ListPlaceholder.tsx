import { ActivityIndicator, StyleSheet, View } from "react-native";
import { t } from "../strings";
import { Txt } from "../ui/Txt";
import { useTheme } from "../theme/ThemeProvider";

type Phase = "loading" | "empty" | "no-workspace" | "error" | "ready";

export function ListPlaceholder({
  phase,
  emptyLabel,
}: {
  phase: Phase;
  emptyLabel: string;
}) {
  const { theme } = useTheme();

  if (phase === "ready") return null;

  return (
    <View style={styles.center}>
      {phase === "loading" ? (
        <ActivityIndicator color={theme.accent} size="large" />
      ) : (
        <Txt
          variant="muted"
          style={styles.text}
          color={phase === "error" ? theme.danger : theme.muted}
        >
          {phase === "error"
            ? t("common.error")
            : phase === "no-workspace"
              ? t("workspace.empty")
              : emptyLabel}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  text: { textAlign: "center", maxWidth: 300, paddingHorizontal: 8 },
});
