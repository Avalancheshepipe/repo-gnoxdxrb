import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../strings";
import { Icon } from "../ui/Icon";
import { Icons } from "../ui/icons";
import { Txt } from "../ui/Txt";
import { useTheme } from "../theme/ThemeProvider";

/** Blue accent for voice UI — distinct from orange/purple glow. */
const VOICE_BLUE = { light: "#3B82F6", dark: "#60A5FA" };

export type VoiceOverlayMode = "permission" | "unavailable";

type VoicePermissionOverlayProps = {
  visible: boolean;
  mode: VoiceOverlayMode;
  requesting?: boolean;
  onGrant: () => void;
  onDismiss: () => void;
};

/**
 * Full-screen dim overlay (95% black) shown before voice dictation when
 * microphone access is missing or the native module is not linked.
 */
export function VoicePermissionOverlay({
  visible,
  mode,
  requesting,
  onGrant,
  onDismiss,
}: VoicePermissionOverlayProps) {
  const { theme, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const blue = scheme === "dark" ? VOICE_BLUE.dark : VOICE_BLUE.light;

  const title =
    mode === "permission" ? t("voice.permissionTitle") : t("voice.unavailableTitle");
  const body =
    mode === "permission" ? t("voice.permissionBody") : t("voice.unavailableBody");
  const actionLabel =
    mode === "permission" ? t("voice.permissionAllow") : t("voice.permissionDismiss");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View entering={FadeIn.duration(220)} style={styles.backdropFill} />
      </Pressable>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Animated.View
          entering={FadeInDown.springify().damping(20).stiffness(180)}
          style={[
            styles.panel,
            {
              paddingTop: insets.top + 48,
              paddingBottom: insets.bottom + 48,
            },
          ]}
        >
          <View style={[styles.iconRing, { borderColor: `${blue}55` }]}>
            <View style={[styles.iconCore, { backgroundColor: `${blue}22` }]}>
              <Icon icon={Icons.mic} size={32} color={blue} />
            </View>
          </View>

          <Txt variant="title" style={styles.title} color="#F4F4F5">
            {title}
          </Txt>

          <Txt variant="body" style={styles.body} color="rgba(244, 244, 245, 0.72)">
            {body}
          </Txt>

          <Pressable
            onPress={mode === "permission" ? onGrant : onDismiss}
            disabled={requesting}
            hitSlop={12}
            style={({ pressed }) => [styles.allowText, pressed && { opacity: 0.65 }]}
          >
            <Txt
              variant="label"
              color={requesting ? theme.faint : blue}
              style={styles.allowLabel}
            >
              {requesting ? t("voice.permissionRequesting") : actionLabel}
            </Txt>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  backdropFill: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  panel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  iconCore: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    maxWidth: 300,
  },
  body: {
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
    maxWidth: 320,
  },
  allowText: {
    marginTop: 32,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  allowLabel: {
    fontSize: 16,
    letterSpacing: 0.1,
    textDecorationLine: "underline",
  },
});
