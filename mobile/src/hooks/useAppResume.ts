import { useEffect } from "react";
import { AppState } from "react-native";
import { api } from "../api";
import { authClient, refetchSession } from "../auth";

/** Refetch auth + workspace data when returning from background. */
export function AppResumeSync() {
  const utils = api.useUtils();

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void (async () => {
        await refetchSession();
        if (authClient.$store.atoms.session.get().data) {
          await utils.invalidate();
        }
      })();
    });
    return () => sub.remove();
  }, [utils]);

  return null;
}
