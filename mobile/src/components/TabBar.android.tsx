import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassSurface } from "../ui/GlassSurface";
import { Icon, type IconSvgElement } from "../ui/Icon";
import { Icons } from "../ui/icons";
import { Txt } from "../ui/Txt";
import { useTheme } from "../theme/ThemeProvider";
import { layout } from "../theme/tokens";
import { t } from "../strings";

const ICONS: Record<string, IconSvgElement> = {
  home: Icons.home,
  inbox: Icons.inbox,
  agents: Icons.agent,
  automations: Icons.automations,
};

const LABEL_KEYS: Record<string, string> = {
  home: "nav.home",
  inbox: "nav.inbox",
  agents: "nav.agents",
  automations: "nav.automations",
};

// Reanimated 4 duration-based springs — slightly underdamped for a lively
// tab transition that settles quickly.
const TAB_SPRING = { duration: 420, dampingRatio: 0.8, mass: 0.8 } as const;
const ICON_BOUNCE = { duration: 500, dampingRatio: 0.62, mass: 0.7 } as const;

function TabItem({
  focused,
  icon,
  label,
  onPress,
}: {
  focused: boolean;
  icon: IconSvgElement;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const active = useSharedValue(focused ? 1 : 0);
  const iconScale = useSharedValue(focused ? 1 : 0.9);

  useEffect(() => {
    active.value = withSpring(focused ? 1 : 0, TAB_SPRING);
    if (focused) {
      iconScale.value = withSpring(1.12, ICON_BOUNCE, () => {
        iconScale.value = withSpring(1, TAB_SPRING);
      });
    }
  }, [focused, active, iconScale]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: active.value * 0.9,
    transform: [{ scale: 0.8 + active.value * 0.2 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -active.value * 1.5 },
      { scale: iconScale.value },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + active.value * 0.5,
    transform: [{ translateY: active.value * 0.5 }],
  }));

  return (
    <Pressable style={styles.item} onPress={onPress} hitSlop={8}>
      <Animated.View style={[styles.pill, { backgroundColor: theme.accentSoft }, pillStyle]} />
      <Animated.View style={iconStyle}>
        <Icon
          icon={icon}
          size={23}
          color={focused ? theme.accent : theme.muted}
        />
      </Animated.View>
      <Animated.View style={labelStyle}>
        <Txt
          variant="caption"
          color={focused ? theme.accent : theme.muted}
          numberOfLines={1}
        >
          {label}
        </Txt>
      </Animated.View>
    </Pressable>
  );
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          paddingBottom: insets.bottom + layout.tabBarFloatGap,
          paddingHorizontal: layout.tabBarSideGap,
        },
      ]}
    >
      <GlassSurface radius={22} fill={theme.barFillSolid} style={styles.dock}>
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const { options } = descriptors[route.key];
            if (options.tabBarButton === null) return null;

            const onPress = () => {
              Haptics.selectionAsync().catch(() => {});
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name as never);
              }
            };

            const key = LABEL_KEYS[route.name];
            return (
              <TabItem
                key={route.key}
                focused={focused}
                icon={ICONS[route.name] ?? Icons.home}
                label={key ? t(key as never) : route.name}
                onPress={onPress}
              />
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  dock: {
    height: layout.tabBarHeight,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    height: "100%",
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  pill: {
    position: "absolute",
    top: 6,
    width: 48,
    height: 32,
    borderRadius: 999,
  },
});
