import { QueryClient, onlineManager } from "@tanstack/react-query";

/**
 * Android emulators often report `isInternetReachable: null`, which pauses React
 * Query fetches forever (blank lists, no spinner). Pin online + use networkMode
 * `always` so tRPC requests run against localhost via adb reverse.
 */
function forceQueryOnline() {
  onlineManager.setOnline(true);
  const original = onlineManager.setOnline.bind(onlineManager);
  onlineManager.setOnline = (_online: boolean) => {
    original(true);
  };
}

forceQueryOnline();

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "always",
        retry: 2,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        networkMode: "always",
      },
    },
  });
}
