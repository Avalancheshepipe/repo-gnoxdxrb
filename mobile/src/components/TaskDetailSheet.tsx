import { StyleSheet, View } from "react-native";
import { t } from "../strings";
import { Icon } from "../ui/Icon";
import { Icons } from "../ui/icons";
import { Txt } from "../ui/Txt";
import { useTheme } from "../theme/ThemeProvider";
import { radius } from "../theme/tokens";

export type TaskItem = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueLabel?: string | null;
  tags?: string[];
  project?: string;
  assignees?: { id?: string; name: string; type: "agent" | "human" }[];
};

const PRIORITY_KEYS = ["urgent", "high", "medium", "low"];
const STATUS_KEYS = ["todo", "in-progress", "review", "done", "backlog", "blocked"];

function label(value: string, keys: string[], prefix: string) {
  const key = value.toLowerCase();
  return keys.includes(key) ? t(`${prefix}.${key}` as never) : value;
}

function MetaTile({ label: l, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.inputBg }]}>
      <Txt variant="caption">{l}</Txt>
      <Txt variant="label" numberOfLines={1} style={{ marginTop: 2 }}>
        {value}
      </Txt>
    </View>
  );
}

export function TaskDetailContent({ task }: { task: TaskItem }) {
  const { theme } = useTheme();
  const priorityColor: Record<string, string> = {
    urgent: theme.danger,
    high: theme.warning,
    medium: theme.accent,
    low: theme.muted,
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.metaGrid}>
        <MetaTile
          label={t("task.status")}
          value={label(task.status, STATUS_KEYS, "status")}
        />
        <MetaTile
          label={t("task.priority")}
          value={label(task.priority, PRIORITY_KEYS, "priority")}
        />
        {task.dueLabel ? (
          <MetaTile label={t("task.due")} value={task.dueLabel} />
        ) : null}
        {task.project ? (
          <MetaTile label={t("task.project")} value={task.project} />
        ) : null}
      </View>

      <View
        style={[styles.priorityRow, { borderColor: theme.border }]}
        pointerEvents="none"
      >
        <View
          style={[
            styles.dot,
            { backgroundColor: priorityColor[task.priority] ?? theme.muted },
          ]}
        />
        <Txt variant="caption" color={priorityColor[task.priority] ?? theme.muted}>
          {label(task.priority, PRIORITY_KEYS, "priority")}
        </Txt>
      </View>

      <View style={styles.section}>
        <Txt variant="caption" style={styles.sectionLabel}>
          {t("task.description").toUpperCase()}
        </Txt>
        <Txt variant="body" color={task.description ? theme.fg : theme.muted}>
          {task.description?.trim() || t("task.noDescription")}
        </Txt>
      </View>

      <View style={styles.section}>
        <Txt variant="caption" style={styles.sectionLabel}>
          {t("task.assignees").toUpperCase()}
        </Txt>
        {task.assignees && task.assignees.length > 0 ? (
          <View style={styles.chips}>
            {task.assignees.map((a, i) => (
              <View
                key={a.id ?? `${a.name}-${i}`}
                style={[
                  styles.chip,
                  { backgroundColor: theme.inputBg, borderColor: theme.border },
                ]}
              >
                <Icon
                  icon={a.type === "agent" ? Icons.agent : Icons.task}
                  size={12}
                  color={a.type === "agent" ? theme.accent : theme.muted}
                />
                <Txt variant="caption">{a.name}</Txt>
              </View>
            ))}
          </View>
        ) : (
          <Txt variant="muted">{t("task.noAssignees")}</Txt>
        )}
      </View>

      {task.tags && task.tags.length > 0 ? (
        <View style={styles.section}>
          <Txt variant="caption" style={styles.sectionLabel}>
            {t("task.tags").toUpperCase()}
          </Txt>
          <View style={styles.chips}>
            {task.tags.map((tag) => (
              <View
                key={tag}
                style={[styles.tag, { backgroundColor: theme.accentSoft }]}
              >
                <Txt variant="caption" color={theme.accent}>
                  #{tag}
                </Txt>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: "46%",
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  priorityRow: {
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
  tag: {
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
