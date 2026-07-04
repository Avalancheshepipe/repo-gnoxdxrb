import { layout } from "../theme/tokens";

/** Clearance for floating content above the native tab bar. */
export function tabBarBottomInset(safeBottom: number, extra = 8) {
  return safeBottom + layout.tabBarHeight + layout.tabBarFloatGap + extra;
}
