import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetModal as BottomSheetModalType,
} from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, useMemo, type ReactNode, type Ref } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layout } from "../theme/tokens";
import { tabBarBottomInset } from "./tabBarInset";
import { Icon } from "./Icon";
import { Icons } from "./icons";
import { Txt } from "./Txt";
import { useTheme } from "../theme/ThemeProvider";

export type SheetRef = BottomSheetModalType;

type SheetProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Fixed snap points; omit for content-height sheet floating above the tab bar. */
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
};

/**
 * Content-height bottom sheet that floats above the tab bar with side insets —
 * not full-width / 80%+ height unless content needs it.
 */
export const Sheet = forwardRef(function Sheet(
  { title, subtitle, children, snapPoints, onDismiss }: SheetProps,
  ref: Ref<BottomSheetModalType>,
) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const useDynamicSizing = snapPoints == null;
  const bottomInset = tabBarBottomInset(insets.bottom);
  const maxDynamicContentSize = useMemo(
    () => Math.round(windowHeight * 0.72),
    [windowHeight],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );

  const dismiss = () =>
    (ref as React.RefObject<BottomSheetModalType>)?.current?.dismiss();

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing={useDynamicSizing}
      snapPoints={useDynamicSizing ? undefined : snapPoints}
      maxDynamicContentSize={useDynamicSizing ? maxDynamicContentSize : undefined}
      detached
      bottomInset={bottomInset}
      style={{ marginHorizontal: layout.tabBarSideGap }}
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: theme.faint }}
      backgroundStyle={{
        backgroundColor: theme.surfaceElevated,
        borderRadius: 28,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.borderStrong,
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {title ? (
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerText}>
              <Txt variant="heading" numberOfLines={1}>
                {title}
              </Txt>
              {subtitle ? (
                <Txt variant="muted" numberOfLines={1}>
                  {subtitle}
                </Txt>
              ) : null}
            </View>
            <Pressable
              onPress={dismiss}
              hitSlop={10}
              style={[styles.close, { backgroundColor: theme.inputBg }]}
            >
              <Icon icon={Icons.arrowDown} size={16} color={theme.muted} />
            </Pressable>
          </View>
        ) : null}
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
    marginBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, minWidth: 0 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: 18, paddingTop: 4 },
});
