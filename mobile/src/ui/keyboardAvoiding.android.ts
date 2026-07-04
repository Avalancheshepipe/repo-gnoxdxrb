import type { KeyboardAvoidingViewProps } from "react-native";

/**
 * Android resizes the app window for the keyboard automatically
 * (`softwareKeyboardLayoutMode: "resize"`), so KeyboardAvoidingView must NOT add
 * its own padding — doing so double-compensates and makes the composer jump up
 * when the keyboard dismisses. We disable its behavior and let the window resize
 * keep the composer pinned to the bottom.
 */
export const kavBehavior: KeyboardAvoidingViewProps["behavior"] = undefined;
export const kavOffset = 0;
