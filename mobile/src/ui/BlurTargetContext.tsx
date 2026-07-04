import { createContext, useContext, type RefObject } from "react";
import type { View } from "react-native";

export type BlurTargetValue = {
  ref: RefObject<View | null>;
  ready: boolean;
};

export const BlurTargetContext = createContext<BlurTargetValue | null>(null);

export function useBlurTarget(): BlurTargetValue | null {
  return useContext(BlurTargetContext);
}
