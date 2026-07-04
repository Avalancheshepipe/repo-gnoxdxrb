import { BlurView } from "expo-blur";
import { StyleSheet, View, type ViewProps } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

type GlassSurfaceProps = ViewProps & {
  intensity?: number;
  bordered?: boolean;
  radius?: number;
  /** Override the translucent fill (defaults to none — clean native blur). */
  fill?: string;
};

/**
 * iOS frosted surface. Native UIVisualEffectView blur is clean, so we use a
 * lighter translucent fill than Android.
 */
export function GlassSurface({
  children,
  style,
  intensity = 40,
  bordered = true,
  radius = 22,
  fill,
  ...rest
}: GlassSurfaceProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[{ borderRadius: radius, overflow: "hidden" }, style]}
      {...rest}
    >
      <BlurView
        intensity={intensity}
        tint={theme.blurTint}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: fill,
            borderRadius: radius,
            borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
            borderColor: theme.border,
          },
        ]}
      />
      {children}
    </View>
  );
}
