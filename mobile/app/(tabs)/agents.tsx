import { useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../src/api";
import {
  AgentDetailContent,
  type AgentDetail,
} from "../../src/components/AgentDetailSheet";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { useScrollHeader } from "../../src/hooks/useScrollHeader";
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

type AgentItem = AgentDetail;

function useStatusColor(status: AgentItem["status"]) {
  const { theme } = useTheme();
  const map: Record<AgentItem["status"], string> = {
    online: theme.success,
    busy: theme.accent,
    idle: theme.muted,
    offline: theme.faint,
  };
  return map[status];
}

function StatusDot({ status }: { status: AgentItem["status"] }) {
  const color = useStatusColor(status);
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.stat}>
      <Txt variant="caption">{label}</Txt>
      <Txt variant="title" style={{ fontSize: 24, marginTop: 2 }}>
        {value}
      </Txt>
    </Card>
  );
}

function CapabilityChip({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.cap,
        { backgroundColor: theme.inputBg, borderColor: theme.border },
      ]}
    >
      <Icon icon={Icons.sparkles} size={11} color={theme.accent} />
      <Txt variant="caption">{label}</Txt>
    </View>
  );
}

function AgentCard({
  agent,
  index,
  onView,
}: {
  agent: AgentItem;
  index: number;
  onView: (agent: AgentItem) => void;
}) {
  const { theme } = useTheme();
  const statusColor = useStatusColor(agent.status);
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 50)
        .springify()
        .mass(0.5)
        .damping(18)}
    >
      <PressableScale haptic={false} scaleTo={0.985} onPress={() => onView(agent)}>
        <Card>
          <View style={styles.cardHead}>
            <View style={[styles.orb, { backgroundColor: theme.accentSoft }]}>
              <Icon icon={Icons.agent} size={20} color={theme.accent} />
              <View
                style={[
                  styles.orbDot,
                  { backgroundColor: statusColor, borderColor: theme.surface },
                ]}
              />
            </View>
            <View style={styles.cardTitle}>
              <Txt variant="heading" numberOfLines={1}>
                {agent.name}
              </Txt>
              <Txt variant="muted" numberOfLines={1}>
                {agent.role}
              </Txt>
            </View>
            <View style={styles.cardActions}>
              <View style={styles.statusPill}>
                <StatusDot status={agent.status} />
                <Txt variant="caption" color={statusColor}>
                  {t(`agents.status.${agent.status}` as never)}
                </Txt>
              </View>
              <View style={[styles.viewBtn, { backgroundColor: theme.inputBg }]}>
                <Icon icon={Icons.view} size={14} color={theme.muted} />
              </View>
            </View>
          </View>

          {agent.responsibility ? (
            <View style={[styles.respBox, { backgroundColor: theme.inputBg }]}>
              <Txt variant="caption" color={theme.muted}>
                {t("agents.responsibleFor")}
              </Txt>
              <Txt variant="body" style={{ marginTop: 3 }} numberOfLines={2}>
                {agent.responsibility}
              </Txt>
            </View>
          ) : null}

          {agent.capabilities.length > 0 ? (
            <View style={styles.caps}>
              {agent.capabilities.slice(0, 4).map((cap) => (
                <CapabilityChip key={cap} label={cap} />
              ))}
            </View>
          ) : null}
        </Card>
      </PressableScale>
    </Animated.View>
  );
}

export default function AgentsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const org = useOrg();
  const { organizationId } = org;
  const sheetRef = useRef<SheetRef>(null);
  const [selected, setSelected] = useState<AgentItem | null>(null);
  const { scrollY, scrollHandler } = useScrollHeader();

  const openAgent = (agent: AgentItem) => {
    setSelected(agent);
    sheetRef.current?.present();
  };

  const agentsQuery = api.agent.list.useQuery(
    { organizationId: organizationId ?? "" },
    {
      enabled: org.isReady && org.hasWorkspace,
      staleTime: 30_000,
      networkMode: "always",
      retry: 2,
    },
  );

  const agents = useMemo(
    () => (agentsQuery.data ?? []) as AgentItem[],
    [agentsQuery.data],
  );
  const phase = listScreenState(org, agentsQuery, agents.length);

  const activeCount = agents.filter(
    (a) => a.status === "online" || a.status === "busy",
  ).length;
  const totalRuns = agents.reduce((sum, a) => sum + (a.tasksCompleted ?? 0), 0);

  const topPad = insets.top + layout.topbarHeight + 8;
  const bottomPad =
    insets.bottom + layout.tabBarHeight + layout.tabBarFloatGap + 16;

  return (
    <View style={styles.flex}>
      <Animated.FlatList
        data={agents}
        keyExtractor={(item) => item.id}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={
          agents.length === 0
            ? { flexGrow: 1, paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: 16 }
            : {
                paddingTop: topPad,
                paddingBottom: bottomPad,
                paddingHorizontal: 16,
                gap: 12,
              }
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          agents.length > 0 ? (
            <View style={styles.statsRow}>
              <Stat label={t("agents.activeNow")} value={String(activeCount)} />
              <Stat label={t("agents.totalRuns")} value={String(totalRuns)} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <ListPlaceholder phase={phase} emptyLabel={t("agents.empty")} />
        }
        renderItem={({ item, index }) => (
          <AgentCard agent={item} index={index} onView={openAgent} />
        )}
      />
      <ScreenHeader title={t("agents.title")} subtitle={t("agents.roster")} scrollY={scrollY} />

      <Sheet
        ref={sheetRef}
        title={selected?.name}
        subtitle={selected?.role}
      >
        {selected ? <AgentDetailContent agent={selected} /> : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  stat: { flex: 1 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  orb: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  orbDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
  },
  cardTitle: { flex: 1, minWidth: 0 },
  cardActions: { alignItems: "flex-end", gap: 8 },
  viewBtn: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 999 },
  respBox: { marginTop: 12, borderRadius: radius.md, padding: 12 },
  caps: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  cap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
});
