import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { t } from "../strings";
import { Icon } from "../ui/Icon";
import { Icons } from "../ui/icons";
import { PressableScale } from "../ui/PressableScale";
import { Txt } from "../ui/Txt";
import { useTheme } from "../theme/ThemeProvider";
import { radius } from "../theme/tokens";

export type AgentDetail = {
  id: string;
  name: string;
  role: string;
  responsibility: string;
  status: "online" | "busy" | "idle" | "offline";
  model: string;
  tasksCompleted: number;
  capabilities: string[];
};

function MetaTile({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.inputBg }]}>
      <Txt variant="caption">{label}</Txt>
      <Txt variant="label" numberOfLines={1} style={{ marginTop: 2 }}>
        {value}
      </Txt>
    </View>
  );
}

export function AgentDetailContent({ agent }: { agent: AgentDetail }) {
  const { theme } = useTheme();
  const router = useRouter();
  const statusColors: Record<AgentDetail["status"], string> = {
    online: theme.success,
    busy: theme.accent,
    idle: theme.muted,
    offline: theme.faint,
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={[styles.orb, { backgroundColor: theme.accentSoft }]}>
          <Icon icon={Icons.agent} size={24} color={theme.accent} />
        </View>
        <View style={styles.headText}>
          <Txt variant="heading" numberOfLines={1}>
            {agent.name}
          </Txt>
          <Txt variant="muted" numberOfLines={1}>
            {agent.role}
          </Txt>
        </View>
      </View>

      <View style={styles.metaGrid}>
        <MetaTile
          label={t("agents.status")}
          value={t(`agents.status.${agent.status}` as never)}
        />
        <MetaTile label={t("agents.runs")} value={String(agent.tasksCompleted)} />
        <View style={[styles.tile, styles.tileWide, { backgroundColor: theme.inputBg }]}>
          <Txt variant="caption">{t("agents.model")}</Txt>
          <Txt variant="label" numberOfLines={1} style={{ marginTop: 2 }}>
            {agent.model}
          </Txt>
        </View>
      </View>

      <View
        style={[styles.statusRow, { borderColor: theme.border }]}
        pointerEvents="none"
      >
        <View style={[styles.dot, { backgroundColor: statusColors[agent.status] }]} />
        <Txt variant="caption" color={statusColors[agent.status]}>
          {t(`agents.status.${agent.status}` as never)}
        </Txt>
      </View>

      {agent.responsibility ? (
        <View style={styles.section}>
          <Txt variant="caption" style={styles.sectionLabel}>
            {t("agents.responsibleFor").toUpperCase()}
          </Txt>
          <Txt variant="body">{agent.responsibility}</Txt>
        </View>
      ) : null}

      {agent.capabilities.length > 0 ? (
        <View style={styles.section}>
          <Txt variant="caption" style={styles.sectionLabel}>
            {t("agents.canDo").toUpperCase()}
          </Txt>
          <View style={styles.chips}>
            {agent.capabilities.map((cap) => (
              <View
                key={cap}
                style={[
                  styles.chip,
                  { backgroundColor: theme.inputBg, borderColor: theme.border },
                ]}
              >
                <Icon icon={Icons.sparkles} size={11} color={theme.accent} />
                <Txt variant="caption">{cap}</Txt>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <PressableScale
        onPress={() =>
          router.push({ pathname: "/agent-chat", params: { agentId: agent.id } })
        }
        style={[styles.chatBtn, { backgroundColor: theme.accent }]}
      >
        <Icon icon={Icons.send} size={16} color={theme.accentFg} />
        <Txt variant="label" color={theme.accentFg}>
          {t("agents.openChat")}
        </Txt>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  orb: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: { flex: 1, minWidth: 0 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: "46%",
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tileWide: { flexBasis: "100%" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 999 },
  section: { gap: 8 },
  sectionLabel: { letterSpacing: 0.5 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    paddingVertical: 12,
    marginTop: 4,
  },
});
