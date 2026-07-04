import { expoClient } from "@better-auth/expo/client";
import { kOnlineManager } from "better-auth/client";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { apiFetch } from "./apiFetch";
import "./queryClient";

/**
 * Resolve the API base URL for local development.
 *
 * Default to `localhost:3000`, which works on the emulator and USB devices via
 * `adb reverse tcp:3000 tcp:3000`. For a physical device on Wi-Fi without adb
 * reverse, set EXPO_PUBLIC_API_URL to your machine's LAN address.
 */
function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;
  const fromConfig = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  return fromConfig ?? "http://localhost:3000";
}

export const API_URL = resolveApiUrl();

/**
 * Force better-auth's online manager to stay online.
 *
 * @better-auth/expo derives connectivity from expo-network's
 * `isInternetReachable`, which is `false`/`null` on the Android emulator. That
 * flips the auth client "offline" and pauses the session query forever — the
 * app hangs on the loading spinner and never reaches sign-in. We pin it online
 * and neutralize further offline flips.
 */
function patchOnlineManager() {
  const store = globalThis as unknown as Record<symbol, unknown>;
  const manager = store[kOnlineManager] as
    | {
        isOnline: boolean;
        listeners: Set<(online: boolean) => void>;
        setOnline: (online: boolean) => void;
      }
    | undefined;
  if (!manager) return;
  manager.setOnline(true);
  manager.setOnline = function patchedSetOnline(online: boolean) {
    if (!online) return;
    if (!this.isOnline) {
      this.isOnline = true;
      this.listeners.forEach((listener) => listener(true));
    }
  };
}

patchOnlineManager();

export const authClient = createAuthClient({
  baseURL: API_URL,
  sessionOptions: {
    refetchWhenOffline: true,
    refetchOnWindowFocus: true,
  },
  fetchOptions: {
    customFetchImpl: apiFetch,
  },
  plugins: [
    expoClient({
      scheme: "julow",
      storagePrefix: "julow",
      storage: SecureStore,
    }),
  ],
});

patchOnlineManager();

/** Wait until SecureStore + session atom reflect a signed-in user. */
export async function waitForSession(maxAttempts = 12, delayMs = 150): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await refetchSession();
    const session = authClient.$store.atoms.session.get().data;
    if (session?.session) return true;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return Boolean(authClient.$store.atoms.session.get().data?.session);
}

export async function refetchSession() {
  const { refetch } = authClient.$store.atoms.session.get();
  await refetch();
  return authClient.$store.atoms.session.get().data;
}

/** Session cookie to forward to authenticated WebViews / fetches. */
export function getSessionCookie(): string | null {
  try {
    return authClient.getCookie() || null;
  } catch {
    return null;
  }
}
