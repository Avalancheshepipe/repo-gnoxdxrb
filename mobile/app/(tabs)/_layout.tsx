import { Redirect, Tabs } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "../../src/api";
import { authClient } from "../../src/auth";
import { TabBar } from "../../src/components/TabBar";
import { useOrg } from "../../src/hooks/useOrg";
import { useTheme } from "../../src/theme/ThemeProvider";

function WorkspacePrefetch() {
  const org = useOrg();
  const utils = api.useUtils();

  useEffect(() => {
    if (!org.isReady || !org.organizationId) return;
    const id = org.organizationId;
    void utils.task.list.prefetch({ organizationId: id });
    void utils.agent.list.prefetch({ organizationId: id });
    void utils.automation.list.prefetch({ organizationId: id });
  }, [org.isReady, org.organizationId, utils]);

  return null;
}

export default function TabsLayout() {
  const { data: session, isPending, isRefetching } = authClient.useSession();
  const { theme } = useTheme();

  if (isPending || (isRefetching && !session)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!session) return <Redirect href="/sign-in" />;

  return (
    <>
      <WorkspacePrefetch />
      <Tabs
        initialRouteName="home"
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: "transparent" },
        }}
        tabBar={(props) => <TabBar {...props} />}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="inbox" />
        <Tabs.Screen name="agents" />
        <Tabs.Screen name="automations" />
      </Tabs>
    </>
  );
}
