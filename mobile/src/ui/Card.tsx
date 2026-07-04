import { type ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radius } from "../theme/tokens";

/**
 * Opaque content card. We deliberately avoid elevation/shadow on Android (the
 * native shadow renders poorly with rounded corners) and lean on a hairline
 * border + subtle surface tint instead.
 */
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
});
