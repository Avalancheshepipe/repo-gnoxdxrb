import { BlurView } from "expo-blur";
import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Txt } from "../ui/Txt";
import { useTheme } from "../theme/ThemeProvider";
import { layout } from "../theme/tokens";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  scrollY?: SharedValue<number>;
};

const FADE = 30;

export function AppHeader({ title, subtitle, left, right, scrollY }: AppHeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const overlayStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 1 };
    return {
      opacity: interpolate(scrollY.value, [0, FADE], [0, 1], Extrapolation.CLAMP),
    };
  });

  return (
    <View style={[styles.host, { paddingTop: insets.top }]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, overlayStyle]}
      >
        <BlurView
          intensity={40}
          tint={theme.blurTint}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.barFill,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.border,
            },
          ]}
        />
      </Animated.View>
      <View style={[styles.bar, { height: layout.topbarHeight }]}>
        {left}
        <View style={styles.titleWrap}>
          <Txt variant="heading" numberOfLines={1}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="caption" numberOfLines={1}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
  },
  titleWrap: { flex: 1, minWidth: 0 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
});
