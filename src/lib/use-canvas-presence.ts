"use client";

// Live multiplayer presence (cursors) for the canvas, over the existing
// Hocuspocus/Yjs WS server (services/ws). documentName === projectId. Cursor
// positions are shared in FLOW coordinates so they map correctly for every
// peer regardless of their pan/zoom. Awareness is ephemeral (not persisted).

import { HocuspocusProvider } from "@hocuspocus/provider";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";

export type RemoteCursor = {
  clientId: number;
  name: string;
  color: string;
  x: number;
  y: number;
};

type PresenceUser = { id: string; name: string };

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 55%)`;
}

export function useCanvasPresence(opts: {
  projectId: string | null;
  wsUrl: string | null | undefined;
  token: string | null | undefined;
  user: PresenceUser | null;
}): {
  cursors: RemoteCursor[];
  setCursor: (pos: { x: number; y: number } | null) => void;
} {
  const { projectId, wsUrl, token, user } = opts;
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);

  const userId = user?.id ?? null;
  const userName = user?.name ?? null;

  useEffect(() => {
    if (!projectId || !wsUrl || !token || !userId || !userName) return;

    const color = colorFor(userId);
    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: projectId,
      token,
      document: doc,
      onAwarenessChange: ({ states }) => {
        const localId = provider.awareness?.clientID;
        const next: RemoteCursor[] = [];
        for (const state of states) {
          if (state.clientId === localId) continue;
          const u = state.user as { name?: string; color?: string } | undefined;
          const c = state.cursor as { x?: number; y?: number } | undefined;
          if (
            u?.name &&
            c &&
            typeof c.x === "number" &&
            typeof c.y === "number"
          ) {
            next.push({
              clientId: state.clientId,
              name: u.name,
              color: u.color ?? "var(--accent)",
              x: c.x,
              y: c.y,
            });
          }
        }
        setCursors(next);
      },
    });
    providerRef.current = provider;
    provider.setAwarenessField("user", { id: userId, name: userName, color });

    return () => {
      provider.destroy();
      doc.destroy();
      providerRef.current = null;
      setCursors([]);
    };
  }, [projectId, wsUrl, token, userId, userName]);

  const setCursor = useCallback((pos: { x: number; y: number } | null) => {
    providerRef.current?.setAwarenessField("cursor", pos);
  }, []);

  return { cursors, setCursor };
}
