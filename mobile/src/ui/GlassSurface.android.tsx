import { StyleSheet, View, type ViewProps } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

type GlassSurfaceProps = ViewProps & {
  intensity?: number;
  bordered?: boolean;
  radius?: number;
  fill?: string;
};

/** Translucent glass on Android — native expo-blur crashes on some OEM GPUs. */
export function GlassSurface({
  children,
  style,
  bordered = true,
  radius = 22,
  fill,
  ...rest
}: GlassSurfaceProps) {
  const { theme } = useTheme();
  const backgroundColor = fill ?? theme.glass;

  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: "hidden",
          backgroundColor,
          borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
          borderColor: fill ? theme.borderStrong : theme.border,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
