import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";

/**
 * iOS gradient background — same mesh-glow language as the web shell
 * (`.julow-gradient-bg`), tuned a touch softer to match Apple's preference for
 * low-contrast ambient color. objectBoundingBox units fill the screen edge to
 * edge with no seam behind the status bar / header / tab bar.
 */
export function GradientBackground() {
  const { theme } = useTheme();
  const { glow } = theme;

  // [id, color, cx, cy, rx, ry, coreOpacity, fadeStop].
  const glows: [string, string, number, number, number, number, number, number][] =
    [
      ["g1", glow.orange, 0.15, 0.85, 0.85, 0.62, 0.5, 0.72],
      ["g2", glow.purple, 0.5, 0.12, 0.72, 0.56, 0.46, 0.66],
      ["g3", glow.blue, 0.9, 0.22, 0.66, 0.5, 0.42, 0.62],
    ];

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]}
    >
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          {glows.map(([id, color, cx, cy, rx, ry, core, fade]) => (
            <RadialGradient key={id} id={id} cx={cx} cy={cy} rx={rx} ry={ry}>
              <Stop
                offset="0"
                stopColor={color}
                stopOpacity={core * glow.intensity}
              />
              <Stop offset={String(fade)} stopColor={color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {glows.map(([id]) => (
          <Rect key={id} x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
        ))}
      </Svg>
    </View>
  );
}
