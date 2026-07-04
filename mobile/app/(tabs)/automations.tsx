import { useRef, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../src/api";
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

type Automation = {
  id: string;
  name: string;
  description?: string | null;
  trigger: string;
  action: string;
  enabled: boolean;
  aiManaged: boolean;
  runsToday: number;
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

function AutomationDetail({ item }: { item: Automation }) {
  const { theme } = useTheme();
  return (
    <View style={styles.detailWrap}>
      <View style={styles.metaGrid}>
        <MetaTile
          label={t("automations.status")}
          value={item.enabled ? t("automations.enabled") : t("automations.disabled")}
        />
        <MetaTile label={t("automations.runsToday")} value={String(item.runsToday)} />
      </View>
      {item.description ? (
        <View style={styles.section}>
          <Txt variant="body">{item.description}</Txt>
        </View>
      ) : null}
      <View style={[styles.flowBox, { backgroundColor: theme.inputBg }]}>
        <Txt variant="caption" style={styles.sectionLabel}>
          {t("automations.trigger").toUpperCase()}
        </Txt>
        <Txt variant="body" style={{ marginBottom: 10 }}>
          {item.trigger}
        </Txt>
        <Txt variant="caption" style={styles.sectionLabel}>
          {t("automations.action").toUpperCase()}
        </Txt>
        <Txt variant="body">{item.action}</Txt>
      </View>
      {item.aiManaged ? (
        <View style={[styles.aiPill, { backgroundColor: theme.accentSoft }]}>
          <Icon icon={Icons.sparkles} size={12} color={theme.accent} />
          <Txt variant="caption" color={theme.accent}>
            {t("automations.aiManaged")}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

export default function AutomationsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const org = useOrg();
  const { organizationId } = org;
  const utils = api.useUtils();
  const sheetRef = useRef<SheetRef>(null);
  const [selected, setSelected] = useState<Automation | null>(null);
  const { scrollY, scrollHandler } = useScrollHeader();

  const automations = api.automation.list.useQuery(
    { organizationId: organizationId ?? "" },
    {
      enabled: org.isReady && org.hasWorkspace,
      staleTime: 30_000,
      networkMode: "always",
      retry: 2,
    },
  );

  const rows = (automations.data ?? []) as Automation[];
  const phase = listScreenState(org, automations, rows.length);

  const toggle = api.automation.toggle.useMutation({
    onSettled: () => utils.automation.list.invalidate(),
  });

  const open = (item: Automation) => {
    setSelected(item);
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
        ListEmptyComponent={
          <ListPlaceholder phase={phase} emptyLabel={t("automations.empty")} />
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.delay(Math.min(index, 8) * 50).springify().mass(0.5).damping(18)}
          >
            <PressableScale haptic={false} scaleTo={0.985} onPress={() => open(item)}>
              <Card>
                <View style={styles.rowBetween}>
                  <View style={styles.titleCol}>
                    <Txt variant="heading" numberOfLines={1}>
                      {item.name}
                    </Txt>
                    {item.description ? (
                      <Txt variant="muted" numberOfLines={2}>
                        {item.description}
                      </Txt>
                    ) : null}
                  </View>
                  <Switch
                    value={item.enabled}
                    onValueChange={(enabled) =>
                      toggle.mutate({ id: item.id, enabled })
                    }
                    trackColor={{ true: theme.accent, false: theme.inputBorder }}
                    thumbColor="#fff"
                  />
                </View>
                <View style={styles.metaRow}>
                  <Txt variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                    {item.trigger} → {item.action}
                  </Txt>
                  {item.aiManaged ? (
                    <View style={[styles.aiPill, { backgroundColor: theme.accentSoft }]}>
                      <Txt variant="caption" color={theme.accent}>
                        AI
                      </Txt>
                    </View>
                  ) : null}
                  <View style={[styles.viewBtn, { backgroundColor: theme.inputBg }]}>
                    <Icon icon={Icons.view} size={14} color={theme.muted} />
                  </View>
                </View>
              </Card>
            </PressableScale>
          </Animated.View>
        )}
      />
      <ScreenHeader title={t("automations.title")} scrollY={scrollY} />

      <Sheet
        ref={sheetRef}
        title={selected?.name}
        subtitle={selected?.enabled ? t("automations.enabled") : t("automations.disabled")}
      >
        {selected ? <AutomationDetail item={selected} /> : null}
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
    gap: 12,
  },
  titleCol: { flex: 1, gap: 4 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  aiPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  viewBtn: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  detailWrap: { gap: 16 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: "46%",
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  section: { gap: 8 },
  sectionLabel: { letterSpacing: 0.5 },
  flowBox: { borderRadius: radius.md, padding: 14 },
});
