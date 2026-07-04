import { StyleSheet, View } from "react-native";
import { PressableScale } from "./PressableScale";
import { Icon, type IconSvgElement } from "./Icon";
import { useTheme } from "../theme/ThemeProvider";

type IconButtonProps = {
  icon: IconSvgElement;
  onPress?: () => void;
  size?: number;
  color?: string;
  tinted?: boolean;
  accessibilityLabel?: string;
};

export function IconButton({
  icon,
  onPress,
  size = 20,
  color,
  tinted = false,
  accessibilityLabel,
}: IconButtonProps) {
  const { theme } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={[styles.btn, tinted && { backgroundColor: theme.accentSoft }]}
    >
      <View>
        <Icon icon={icon} size={size} color={color ?? theme.fg} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
