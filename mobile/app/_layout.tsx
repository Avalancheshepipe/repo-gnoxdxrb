import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import superjson from "superjson";
import { api } from "../src/api";
import { apiFetch } from "../src/apiFetch";
import { API_URL, authClient } from "../src/auth";
import { I18nProvider, useI18n } from "../src/i18n/I18nProvider";
import { createQueryClient } from "../src/queryClient";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { GradientBackground } from "../src/ui/GradientBackground";
import { BlurTargetProvider } from "../src/ui/BlurTargetProvider";
import { AppResumeSync } from "../src/hooks/useAppResume";

function ThemedRoot() {
  const { scheme } = useTheme();
  const { locale } = useI18n();
  return (
    <BlurTargetProvider>
      <GradientBackground />
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        key={locale}
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="sign-in"
          options={{ animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="board"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="agent-chat"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="account"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="search"
          options={{ animation: "slide_from_right" }}
        />
      </Stack>
    </BlurTargetProvider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => createQueryClient());
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: `${API_URL}/api/trpc`,
          transformer: superjson,
          fetch: apiFetch,
          headers() {
            const cookie = authClient.getCookie();
            return cookie ? { Cookie: cookie } : {};
          },
        }),
      ],
    }),
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <api.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <I18nProvider>
                <BottomSheetModalProvider>
                  <AppResumeSync />
                  <ThemedRoot />
                </BottomSheetModalProvider>
              </I18nProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </api.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
