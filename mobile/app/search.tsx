import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../src/api";
import { AppHeader } from "../src/components/AppHeader";
import { useOrg } from "../src/hooks/useOrg";
import { t } from "../src/strings";
import { Card } from "../src/ui/Card";
import { Icon } from "../src/ui/Icon";
import { IconButton } from "../src/ui/IconButton";
import { Icons } from "../src/ui/icons";
import { Txt } from "../src/ui/Txt";
import { useTheme } from "../src/theme/ThemeProvider";
import { radius } from "../src/theme/tokens";

type Row =
  | { kind: "header"; id: string; label: string }
  | { kind: "task"; id: string; title: string; sub?: string }
  | { kind: "agent"; id: string; title: string; sub?: string };

export default function SearchScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { organizationId } = useOrg();
  const [query, setQuery] = useState("");

  const tasks = api.task.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: Boolean(organizationId) },
  );
  const agents = api.agent.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: Boolean(organizationId) },
  );

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Row[] = [];

    const matchedTasks = (tasks.data ?? []).filter((task) =>
      task.title.toLowerCase().includes(q),
    );
    if (matchedTasks.length) {
      out.push({ kind: "header", id: "h-tasks", label: t("search.tasks") });
      for (const item of matchedTasks.slice(0, 12)) {
        out.push({ kind: "task", id: item.id, title: item.title, sub: item.status });
      }
    }

    const matchedAgents = (agents.data ?? []).filter(
      (a) =>
        a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q),
    );
    if (matchedAgents.length) {
      out.push({ kind: "header", id: "h-agents", label: t("search.agents") });
      for (const a of matchedAgents.slice(0, 12)) {
        out.push({ kind: "agent", id: a.id, title: a.name, sub: a.role });
      }
    }

    return out;
  }, [query, tasks.data, agents.data]);

  const hasQuery = query.trim().length > 0;

  return (
    <View style={styles.flex}>
      <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Icon icon={Icons.search} size={16} color={theme.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("search.placeholder")}
              placeholderTextColor={theme.faint}
              style={[styles.input, { color: theme.fg }]}
              autoFocus
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.kind}-${r.id}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 16,
            gap: 8,
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Txt variant="muted">
                {hasQuery ? t("search.empty") : t("search.hint")}
              </Txt>
            </View>
          }
          renderItem={({ item }) => {
            if (item.kind === "header") {
              return (
                <Txt variant="caption" style={styles.sectionLabel}>
                  {item.label.toUpperCase()}
                </Txt>
              );
            }
            return (
              <Animated.View entering={FadeIn.duration(140)}>
                <Card style={styles.row}>
                  <View
                    style={[styles.rowIcon, { backgroundColor: theme.inputBg }]}
                  >
                    <Icon
                      icon={item.kind === "task" ? Icons.task : Icons.agent}
                      size={16}
                      color={theme.accent}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Txt variant="body" numberOfLines={1}>
                      {item.title}
                    </Txt>
                    {item.sub ? (
                      <Txt
                        variant="caption"
                        numberOfLines={1}
                        style={{ textTransform: "capitalize" }}
                      >
                        {item.sub}
                      </Txt>
                    ) : null}
                  </View>
                </Card>
              </Animated.View>
            );
          }}
        />
      </View>

      <AppHeader
        title={t("search.title")}
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
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  searchRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  sectionLabel: { marginTop: 10, marginBottom: 2, letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, minWidth: 0 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 46,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
});
