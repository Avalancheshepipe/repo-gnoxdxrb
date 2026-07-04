import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { AppHeader } from "../src/components/AppHeader";
import { API_URL, getSessionCookie } from "../src/auth";
import { t } from "../src/strings";
import { IconButton } from "../src/ui/IconButton";
import { Icons } from "../src/ui/icons";
import { Txt } from "../src/ui/Txt";
import { useTheme } from "../src/theme/ThemeProvider";
import { layout } from "../src/theme/tokens";

/**
 * Full-screen canvas (not in the tab bar). Loads `/embed/board` in a WebView.
 * Standalone — no native tab bar overlay, so bottom nav CSS vars are zeroed.
 */
export default function BoardScreen() {
  const router = useRouter();
  const { theme, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);

  const cookie = getSessionCookie();
  const uri = `${API_URL}/embed/board?theme=${scheme}`;
  const topPad = insets.top + layout.topbarHeight;

  const injectedJS = useMemo(() => {
    const parts: string[] = [];
    if (cookie) {
      for (const c of cookie.split(";").map((x) => x.trim()).filter(Boolean)) {
        parts.push(`try{document.cookie=${JSON.stringify(`${c}; path=/`)};}catch(e){}`);
      }
    }
    parts.push(`try{localStorage.setItem('theme',${JSON.stringify(scheme)});}catch(e){}`);
    parts.push(
      `try{var d=document.documentElement;d.classList.remove('light','dark');d.classList.add(${JSON.stringify(scheme)});d.style.colorScheme=${JSON.stringify(scheme)};d.style.setProperty('--safe-bottom',${JSON.stringify(`${insets.bottom}px`)});d.style.setProperty('--bottom-nav-height','0px');d.style.setProperty('--bottom-nav-float-gap','0px');d.classList.add('julow-native-embed');}catch(e){}`,
    );
    return `${parts.join("")}true;`;
  }, [cookie, scheme, insets.bottom]);

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <View style={{ flex: 1, marginTop: topPad }}>
        {cookie ? (
          <WebView
            key={scheme}
            ref={ref}
            source={{ uri, headers: { Cookie: cookie } }}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            injectedJavaScriptBeforeContentLoaded={injectedJS}
            style={{ backgroundColor: "transparent" }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
            onHttpError={() => setLoading(false)}
            allowsBackForwardNavigationGestures
            decelerationRate={0.998}
          />
        ) : null}
        {loading ? (
          <View style={[styles.loader, { backgroundColor: theme.bg }]}>
            <ActivityIndicator color={theme.accent} />
            <Txt variant="muted" style={{ marginTop: 10 }}>
              {t("canvas.loading")}
            </Txt>
          </View>
        ) : null}
      </View>
      <AppHeader
        title={t("canvas.title")}
        left={
          <IconButton
            icon={Icons.arrowLeft}
            onPress={() => router.back()}
            accessibilityLabel={t("common.back")}
          />
        }
        right={
          <IconButton
            icon={Icons.refresh}
            onPress={() => ref.current?.reload()}
            accessibilityLabel={t("common.retry")}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
