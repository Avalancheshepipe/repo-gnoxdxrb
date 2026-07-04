import { useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../src/api";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { useScrollHeader } from "../../src/hooks/useScrollHeader";
import {
  TaskDetailContent,
  type TaskItem,
} from "../../src/components/TaskDetailSheet";
import { useOrg, listScreenState } from "../../src/hooks/useOrg";
import { t } from "../../src/strings";
import { Card } from "../../src/ui/Card";
import { Icon } from "../../src/ui/Icon";
import { Icons } from "../../src/ui/icons";
import { ListPlaceholder } from "../../src/ui/ListPlaceholder";
import { PressableScale } from "../../src/ui/PressableScale";
import { Sheet, type SheetRef } from "../../src/ui/Sheet";
import { Txt } from "../../src/ui/Txt";
import { useTheme } from "../../src/theme/ThemeProvider";
import { layout, radius } from "../../src/theme/tokens";

const PRIORITY_KEYS = ["urgent", "high", "medium", "low"];
const STATUS_KEYS = ["todo", "in-progress", "review", "done", "backlog", "blocked"];

function localize(value: string, keys: string[], prefix: string) {
  const key = value.toLowerCase();
  return keys.includes(key) ? t(`${prefix}.${key}` as never) : value;
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: `${color}22`, borderColor: `${color}55` },
      ]}
    >
      <Txt variant="caption" color={color}>
        {label}
      </Txt>
    </View>
  );
}

export default function InboxScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const org = useOrg();
  const { organizationId } = org;
  const [refreshing, setRefreshing] = useState(false);
  const sheetRef = useRef<SheetRef>(null);
  const [selected, setSelected] = useState<TaskItem | null>(null);
  const { scrollY, scrollHandler } = useScrollHeader();

  const priorityColors: Record<string, string> = {
    urgent: theme.danger,
    high: theme.warning,
    medium: theme.accent,
    low: theme.muted,
  };

  const tasks = api.task.list.useQuery(
    { organizationId: organizationId ?? "" },
    {
      enabled: org.isReady && org.hasWorkspace,
      staleTime: 30_000,
      networkMode: "always",
      retry: 2,
    },
  );

  const rows = (tasks.data ?? []) as TaskItem[];
  const phase = listScreenState(org, tasks, rows.length);

  const onRefresh = async () => {
    setRefreshing(true);
    await tasks.refetch();
    setRefreshing(false);
  };

  const open = (task: TaskItem) => {
    setSelected(task);
    sheetRef.current?.present();
  };

  const topPad = insets.top + layout.topbarHeight + 8;
  const bottomPad =
    insets.bottom + layout.tabBarHeight + layout.tabBarFloatGap + 16;

  return (
    <View style={styles.flex}>
      <Animated.FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={
          rows.length === 0
            ? { flexGrow: 1, paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: 16 }
            : {
                paddingTop: topPad,
                paddingBottom: bottomPad,
                paddingHorizontal: 16,
                gap: 12,
              }
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.muted}
            progressViewOffset={topPad}
          />
        }
        ListEmptyComponent={
          <ListPlaceholder phase={refreshing ? "loading" : phase} emptyLabel={t("inbox.empty")} />
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.delay(Math.min(index, 8) * 50).springify().mass(0.5).damping(18)}
          >
            <PressableScale haptic={false} scaleTo={0.985} onPress={() => open(item)}>
              <Card>
                <View style={styles.rowBetween}>
                  <Txt variant="heading" style={styles.title} numberOfLines={2}>
                    {item.title}
                  </Txt>
                  <View style={styles.headRight}>
                    <Chip
                      label={localize(item.priority, PRIORITY_KEYS, "priority")}
                      color={priorityColors[item.priority] ?? theme.muted}
                    />
                    <View
                      style={[styles.viewBtn, { backgroundColor: theme.inputBg }]}
                    >
                      <Icon icon={Icons.view} size={14} color={theme.muted} />
                    </View>
                  </View>
                </View>
                {item.description ? (
                  <Txt variant="muted" numberOfLines={2}>
                    {item.description}
                  </Txt>
                ) : null}
                <View style={styles.metaRow}>
                  <View
                    style={[
                      styles.statusChip,
                      { backgroundColor: theme.inputBg, borderColor: theme.border },
                    ]}
                  >
                    <Txt variant="caption">
                      {localize(item.status, STATUS_KEYS, "status")}
                    </Txt>
                  </View>
                  {item.dueLabel ? (
                    <Txt variant="caption">{item.dueLabel}</Txt>
                  ) : null}
                </View>
              </Card>
            </PressableScale>
          </Animated.View>
        )}
      />
      <ScreenHeader title={t("inbox.title")} scrollY={scrollY} />

      <Sheet
        ref={sheetRef}
        title={selected?.title}
        subtitle={selected?.project}
      >
        {selected ? <TaskDetailContent task={selected} /> : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  headRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1 },
  viewBtn: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusChip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
});
