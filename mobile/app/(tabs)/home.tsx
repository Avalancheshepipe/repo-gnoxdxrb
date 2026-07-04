import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../src/api";
import { authClient } from "../../src/auth";
import { useOrg } from "../../src/hooks/useOrg";
import { t } from "../../src/strings";
import { Card } from "../../src/ui/Card";
import { GlassSurface } from "../../src/ui/GlassSurface";
import { Icon, type IconSvgElement } from "../../src/ui/Icon";
import { IconButton } from "../../src/ui/IconButton";
import { Icons } from "../../src/ui/icons";
import { PressableScale } from "../../src/ui/PressableScale";
import { Txt } from "../../src/ui/Txt";
import { useTheme } from "../../src/theme/ThemeProvider";
import { layout, radius, spacing } from "../../src/theme/tokens";

type QuickAction = {
  id: string;
  labelKey: "nav.canvas" | "nav.inbox" | "nav.agents" | "nav.automations" | "search.title";
  icon: IconSvgElement;
  tint?: boolean;
  href: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "canvas", labelKey: "nav.canvas", icon: Icons.canvas, href: "/board" },
  { id: "inbox", labelKey: "nav.inbox", icon: Icons.inbox, href: "/inbox" },
  { id: "agents", labelKey: "nav.agents", icon: Icons.agent, tint: true, href: "/agents" },
  {
    id: "automations",
    labelKey: "nav.automations",
    icon: Icons.automations,
    href: "/automations",
  },
  { id: "search", labelKey: "search.title", icon: Icons.search, href: "/search" },
];

function initials(value: string): string {
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

function QuickActionButton({ action }: { action: QuickAction }) {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <PressableScale
      style={styles.quickItem}
      onPress={() => router.push(action.href as never)}
      accessibilityLabel={t(action.labelKey)}
    >
      <View
        style={[
          styles.quickOrb,
          {
            backgroundColor: action.tint ? theme.accentSoft : theme.inputBg,
            borderColor: theme.border,
          },
        ]}
      >
        <Icon
          icon={action.icon}
          size={20}
          color={action.tint ? theme.accent : theme.fg}
        />
      </View>
      <Txt variant="caption" numberOfLines={1} style={styles.quickLabel}>
        {t(action.labelKey)}
      </Txt>
    </PressableScale>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  const { theme } = useTheme();
  return (
    <GlassSurface radius={radius.lg} style={styles.statTile}>
      <Txt variant="caption">{label}</Txt>
      <Txt variant="title" style={{ fontSize: 28, marginTop: 4 }} color={accent}>
        {value}
      </Txt>
      {sub ? (
        <Txt variant="muted" numberOfLines={1}>
          {sub}
        </Txt>
      ) : null}
    </GlassSurface>
  );
}

function ShortcutCard({
  title,
  body,
  icon,
  onPress,
  delay,
}: {
  title: string;
  body: string;
  icon: IconSvgElement;
  onPress: () => void;
  delay: number;
}) {
  const { theme } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.shortcutWrap}>
      <PressableScale onPress={onPress} scaleTo={0.98}>
        <Card style={styles.shortcutCard}>
          <View style={[styles.shortcutIcon, { backgroundColor: theme.accentSoft }]}>
            <Icon icon={icon} size={18} color={theme.accent} />
          </View>
          <Txt variant="heading" numberOfLines={1}>
            {title}
          </Txt>
          <Txt variant="muted" numberOfLines={2}>
            {body}
          </Txt>
          <View style={styles.shortcutArrow}>
            <Icon icon={Icons.arrowRight} size={14} color={theme.muted} />
          </View>
        </Card>
      </PressableScale>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const org = useOrg();
  const { data: session } = authClient.useSession();
  const [refreshing, setRefreshing] = useState(false);

  const organizationId = org.organizationId;
  const enabled = org.isReady && org.hasWorkspace;

  const tasks = api.task.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled, staleTime: 30_000 },
  );
  const agents = api.agent.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled, staleTime: 30_000 },
  );
  const automations = api.automation.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled, staleTime: 30_000 },
  );
  const activity = api.activity.list.useQuery(
    { organizationId: organizationId ?? "", limit: 5 },
    { enabled, staleTime: 30_000 },
  );

  const stats = useMemo(() => {
    const rows = tasks.data ?? [];
    const open = rows.filter((t) => t.status !== "done").length;
    const done = rows.filter((t) => t.status === "done").length;
    const inProgress = rows.filter((t) => t.status === "in-progress").length;
    const agentRows = agents.data ?? [];
    const activeAgents = agentRows.filter(
      (a) => a.status === "online" || a.status === "busy",
    ).length;
    const autoRows = automations.data ?? [];
    const enabledAuto = autoRows.filter((a) => a.enabled).length;
    const totalRuns = agentRows.reduce((sum, a) => sum + (a.tasksCompleted ?? 0), 0);
    return { open, done, inProgress, activeAgents, enabledAuto, totalRuns, agentCount: agentRows.length };
  }, [tasks.data, agents.data, automations.data]);

  const loading = !org.isReady || (enabled && tasks.isPending);
  const userName = session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "You";
  const bottomPad = insets.bottom + layout.tabBarHeight + layout.tabBarFloatGap + 24;
  const topPad = insets.top + layout.topbarHeight + 12;

  return (
    <View style={[styles.flex, { backgroundColor: "transparent" }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await Promise.all([
                  tasks.refetch(),
                  agents.refetch(),
                  automations.refetch(),
                  activity.refetch(),
                ]);
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={theme.accent}
            progressViewOffset={topPad}
          />
        }
      >
        <View style={styles.greetRow}>
          <PressableScale onPress={() => router.push("/account")} style={styles.greetLeft}>
            <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
              <Txt variant="caption" color={theme.accent} style={styles.avatarText}>
                {initials(userName)}
              </Txt>
            </View>
            <View style={styles.greetText}>
              <Txt variant="muted">{t("home.greeting")}</Txt>
              <Txt variant="heading" numberOfLines={1}>
                {userName}
              </Txt>
            </View>
          </PressableScale>
          <View style={styles.greetActions}>
            <IconButton
              icon={Icons.search}
              onPress={() => router.push("/search")}
              accessibilityLabel={t("search.title")}
            />
            <IconButton
              icon={Icons.agent}
              color={theme.accent}
              tinted
              onPress={() => router.push("/agent-chat")}
              accessibilityLabel={t("agents.chatTitle")}
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : !org.hasWorkspace ? (
          <Card>
            <Txt variant="muted">{t("workspace.empty")}</Txt>
          </Card>
        ) : (
          <>
            <GlassSurface radius={radius.xl} style={styles.hero}>
              <Txt variant="caption">{org.workspaceName ?? t("home.workspace")}</Txt>
              <Txt variant="title" style={styles.heroValue}>
                {stats.open}
              </Txt>
              <View style={styles.heroMeta}>
                <Txt variant="muted">{t("home.openTasks")}</Txt>
                <View style={[styles.delta, { backgroundColor: `${theme.success}22` }]}>
                  <Txt variant="caption" color={theme.success}>
                    +{stats.done} {t("home.done")}
                  </Txt>
                </View>
              </View>
              <PressableScale
                onPress={() => router.push("/board")}
                style={[styles.heroCta, { backgroundColor: theme.accent }]}
              >
                <Icon icon={Icons.canvas} size={16} color={theme.accentFg} />
                <Txt variant="label" color={theme.accentFg}>
                  {t("home.openCanvas")}
                </Txt>
              </PressableScale>
            </GlassSurface>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickRow}
            >
              {QUICK_ACTIONS.map((action) => (
                <QuickActionButton key={action.id} action={action} />
              ))}
            </ScrollView>

            <View style={styles.statGrid}>
              <StatTile
                label={t("home.inProgress")}
                value={String(stats.inProgress)}
                sub={t("home.tasksActive")}
              />
              <StatTile
                label={t("agents.activeNow")}
                value={String(stats.activeAgents)}
                sub={`${stats.agentCount} ${t("home.total")}`}
                accent={theme.accent}
              />
              <StatTile
                label={t("automations.title")}
                value={String(stats.enabledAuto)}
                sub={t("home.enabled")}
              />
              <StatTile
                label={t("agents.totalRuns")}
                value={String(stats.totalRuns)}
                sub={t("home.agentRuns")}
              />
            </View>

            <View style={styles.sectionHead}>
              <Txt variant="heading">{t("home.shortcuts")}</Txt>
              <PressableScale onPress={() => router.push("/inbox")}>
                <Txt variant="label" color={theme.accent}>
                  {t("home.viewAll")}
                </Txt>
              </PressableScale>
            </View>

            <View style={styles.shortcutGrid}>
              <ShortcutCard
                title={t("nav.canvas")}
                body={t("home.canvasHint")}
                icon={Icons.canvas}
                onPress={() => router.push("/board")}
                delay={0}
              />
              <ShortcutCard
                title={t("nav.inbox")}
                body={t("home.inboxHint")}
                icon={Icons.inbox}
                onPress={() => router.push("/inbox")}
                delay={60}
              />
              <ShortcutCard
                title={t("nav.agents")}
                body={t("home.agentsHint")}
                icon={Icons.agent}
                onPress={() => router.push("/agents")}
                delay={120}
              />
              <ShortcutCard
                title={t("nav.automations")}
                body={t("home.automationsHint")}
                icon={Icons.automations}
                onPress={() => router.push("/automations")}
                delay={180}
              />
            </View>

            {(activity.data?.length ?? 0) > 0 ? (
              <>
                <View style={[styles.sectionHead, { marginTop: spacing.lg }]}>
                  <Txt variant="heading">{t("home.recentActivity")}</Txt>
                </View>
                <Card style={{ gap: 12 }}>
                  {(activity.data ?? []).map((item) => (
                    <View key={item.id} style={styles.activityRow}>
                      <View style={[styles.activityDot, { backgroundColor: theme.accentSoft }]}>
                        <Icon
                          icon={
                            item.type === "agent"
                              ? Icons.agent
                              : item.type === "automation"
                                ? Icons.automations
                                : Icons.task
                          }
                          size={13}
                          color={theme.accent}
                        />
                      </View>
                      <View style={styles.activityText}>
                        <Txt variant="body" numberOfLines={1}>
                          {item.actor} · {item.action}
                        </Txt>
                        {item.target ? (
                          <Txt variant="muted" numberOfLines={1}>
                            {item.target}
                          </Txt>
                        ) : null}
                      </View>
                      <Txt variant="caption">{item.time}</Txt>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  center: { paddingVertical: 48, alignItems: "center" },
  greetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  greetLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  greetText: { flex: 1, minWidth: 0, gap: 2 },
  greetActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "700", fontSize: 14 },
  hero: { padding: 18, gap: 6 },
  heroValue: { fontSize: 42, lineHeight: 48 },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 8,
  },
  delta: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    paddingVertical: 12,
    marginTop: 4,
  },
  quickRow: { gap: 14, paddingVertical: 2 },
  quickItem: { width: 64, alignItems: "center", gap: 6 },
  quickOrb: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickLabel: { textAlign: "center" },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statTile: {
    width: "48%",
    flexGrow: 1,
    minWidth: "46%",
    padding: 14,
    gap: 2,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  shortcutWrap: { width: "48%", flexGrow: 1, minWidth: "46%" },
  shortcutCard: { minHeight: 132, paddingBottom: 12 },
  shortcutIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutArrow: { position: "absolute", top: 14, right: 14 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  activityDot: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activityText: { flex: 1, minWidth: 0, gap: 1 },
});
