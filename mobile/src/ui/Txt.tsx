import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

type Variant = "title" | "heading" | "body" | "label" | "muted" | "caption";

const SIZES: Record<Variant, { fontSize: number; fontWeight: TextStyle["fontWeight"] }> = {
  title: { fontSize: 26, fontWeight: "700" },
  heading: { fontSize: 18, fontWeight: "600" },
  body: { fontSize: 15, fontWeight: "400" },
  label: { fontSize: 13, fontWeight: "600" },
  muted: { fontSize: 13, fontWeight: "400" },
  caption: { fontSize: 11, fontWeight: "500" },
};

type TxtProps = TextProps & {
  variant?: Variant;
  color?: string;
};

export function Txt({ variant = "body", color, style, ...rest }: TxtProps) {
  const { theme } = useTheme();
  const base = SIZES[variant];
  const resolved =
    color ??
    (variant === "muted" || variant === "caption" ? theme.muted : theme.fg);

  return (
    <Text
      style={[
        { color: resolved, fontSize: base.fontSize, fontWeight: base.fontWeight },
        style,
      ]}
      {...rest}
    />
  );
}
