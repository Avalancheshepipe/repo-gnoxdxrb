import type { KeyboardAvoidingViewProps } from "react-native";

/**
 * iOS has no automatic window resize for the keyboard, so KeyboardAvoidingView
 * must pad the content. `padding` keeps the composer pinned just above the
 * keyboard and flush to the bottom when it dismisses.
 */
export const kavBehavior: KeyboardAvoidingViewProps["behavior"] = "padding";
export const kavOffset = 0;
