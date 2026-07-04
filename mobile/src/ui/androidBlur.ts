import type { BlurMethod, BlurTint } from "expo-blur";
import { Platform } from "react-native";
import type { BlurTargetValue } from "./BlurTargetContext";

/** Performant native blur on Android 12+; semi-transparent fallback below API 31. */
export const ANDROID_BLUR_METHOD: BlurMethod =
  Platform.OS === "android" && Platform.Version >= 31
    ? "dimezisBlurViewSdk31Plus"
    : "dimezisBlurView";

/** Tune Android blur strength vs iOS (SDK 56 default is 4). */
export const ANDROID_BLUR_REDUCTION_FACTOR = 4;

export function androidBlurViewProps(
  blurTarget: BlurTargetValue | null,
  tint: BlurTint,
  intensity: number,
) {
  return {
    blurTarget: blurTarget?.ref ?? undefined,
    blurMethod: ANDROID_BLUR_METHOD,
    blurReductionFactor: ANDROID_BLUR_REDUCTION_FACTOR,
    tint,
    intensity,
  };
}
