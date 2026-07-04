import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";

/**
 * Android gradient background — a faithful port of the web shell's mesh glow
 * (`.julow-gradient-bg`): three soft elliptical radials (orange / purple / blue)
 * over the base color. Uses objectBoundingBox units so it always fills the whole
 * screen edge-to-edge (behind the status bar, header and tab bar) with no seam.
 */
export function GradientBackground() {
  const { theme } = useTheme();
  const { glow } = theme;

  // [id, color, cx, cy, rx, ry, coreOpacity, fadeStop] — matches the web mesh.
  const glows: [string, string, number, number, number, number, number, number][] =
    [
      ["g1", glow.orange, 0.15, 0.85, 0.8, 0.6, 0.55, 0.7],
      ["g2", glow.purple, 0.5, 0.15, 0.7, 0.55, 0.5, 0.65],
      ["g3", glow.blue, 0.88, 0.25, 0.65, 0.5, 0.45, 0.6],
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
