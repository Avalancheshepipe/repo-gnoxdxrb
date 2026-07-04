import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authClient, waitForSession } from "../src/auth";
import { t } from "../src/strings";
import { PressableScale } from "../src/ui/PressableScale";
import { Txt } from "../src/ui/Txt";
import { useTheme } from "../src/theme/ThemeProvider";
import { radius } from "../src/theme/tokens";

export default function SignInScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message ?? t("auth.failed"));
        return;
      }
      const hasSession = await waitForSession();
      if (!hasSession) {
        setError(t("auth.failed"));
        return;
      }
      router.replace("/home");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg === "NETWORK_TIMEOUT" ? t("auth.networkError") : t("auth.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.springify().damping(18)}>
        <Txt variant="title">{t("auth.welcome")}</Txt>
        <Txt variant="muted" style={{ marginTop: 6, marginBottom: 24 }}>
          {t("auth.subtitle")}
        </Txt>

        <View style={styles.field}>
          <Txt variant="label" color={theme.muted}>
            {t("auth.email")}
          </Txt>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.fg,
              },
            ]}
            placeholder="you@company.com"
            placeholderTextColor={theme.faint}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.field}>
          <Txt variant="label" color={theme.muted}>
            {t("auth.password")}
          </Txt>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.fg,
              },
            ]}
            placeholder="••••••••"
            placeholderTextColor={theme.faint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {error ? (
          <Txt variant="muted" color={theme.danger} style={{ marginTop: 4 }}>
            {error}
          </Txt>
        ) : null}

        <PressableScale
          onPress={onSubmit}
          disabled={loading}
          style={[
            styles.button,
            { backgroundColor: theme.accent, opacity: loading ? 0.7 : 1 },
          ]}
        >
          <View style={styles.buttonInner}>
            {loading ? (
              <ActivityIndicator color={theme.accentFg} />
            ) : (
              <Txt variant="label" color={theme.accentFg} style={{ fontSize: 15 }}>
                {t("auth.signIn")}
              </Txt>
            )}
          </View>
        </PressableScale>
      </Animated.View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  field: { gap: 6, marginBottom: 14 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  button: {
    borderRadius: radius.md,
    marginTop: 10,
  },
  buttonInner: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
