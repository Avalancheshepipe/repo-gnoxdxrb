import { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";

/**
 * Creates a scroll-offset shared value + a workletised scroll handler that
 * updates it on the UI thread. Pass `scrollHandler` to an Animated scrollable's
 * `onScroll` and `scrollY` to `<AppHeader scrollY={scrollY} />` for scroll-driven
 * header blur / large-title collapse.
 */
export function useScrollHeader() {
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return { scrollY, scrollHandler };
}
