import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { authClient } from "../src/auth";
import { useTheme } from "../src/theme/ThemeProvider";

export default function Index() {
  const { data: session, isPending, isRefetching, error } = authClient.useSession();
  const { theme } = useTheme();

  if (isPending || (isRefetching && !session)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!session) {
    if (error) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.accent} />
        </View>
      );
    }
    return <Redirect href="/sign-in" />;
  }
  // Default landing is a non-canvas surface (matches the web app).
  return <Redirect href="/home" />;
}
