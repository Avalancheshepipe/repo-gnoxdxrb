import * as Haptics from "expo-haptics";
import { type ReactNode } from "react";
import { Pressable, type PressableProps, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Reanimated 4 duration-based spring — iOS gets a slightly lighter, faster
// press response to match Apple's native UIKit feel.
const PRESS_IN = { duration: 180, dampingRatio: 1, mass: 0.5 } as const;
const PRESS_OUT = { duration: 340, dampingRatio: 0.85, mass: 0.5 } as const;

type PressableScaleProps = PressableProps & {
  children: ReactNode;
  scaleTo?: number;
  haptic?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export function PressableScale({
  children,
  scaleTo = 0.97,
  haptic = true,
  style,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: PressableScaleProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: 1 - pressed.value * 0.06,
  }));

  return (
    <AnimatedPressable
      onPressIn={(e) => {
        pressed.value = withSpring(1, PRESS_IN);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, PRESS_OUT);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPress?.(e);
      }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
