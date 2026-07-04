"use client";

import {
  useCallback,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";

const storeListeners = new Map<string, Set<() => void>>();

function subscribeKey(key: string, listener: () => void) {
  if (!storeListeners.has(key)) storeListeners.set(key, new Set());
  storeListeners.get(key)!.add(listener);
  return () => {
    storeListeners.get(key)?.delete(listener);
  };
}

function emitKey(key: string) {
  storeListeners.get(key)?.forEach((l) => l());
}

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw) as T;
  } catch {
    /* ignore corrupt/unavailable storage */
  }
  return fallback;
}

/** Synchronous localStorage read for client-only bootstrapping UI. */
export function readStoredState<T>(key: string, fallback: T): T {
  return readStored(key, fallback);
}

function writeStored<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    emitKey(key);
  } catch {
    /* ignore quota/unavailable storage */
  }
}

/**
 * useState backed by localStorage. Uses useSyncExternalStore so the persisted
 * value is read synchronously on the client (no one-frame default flash).
 * Server render always uses `initial`; React reconciles on hydration.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const getSnapshot = useCallback(
    () => readStored(key, initial),
    [key, initial],
  );
  const getServerSnapshot = useCallback(() => initial, [initial]);

  const state = useSyncExternalStore(
    (onStoreChange) => subscribeKey(key, onStoreChange),
    getSnapshot,
    getServerSnapshot,
  );

  const setState = useCallback<Dispatch<SetStateAction<T>>>(
    (value) => {
      const current = readStored(key, initial);
      const next =
        typeof value === "function"
          ? (value as (prev: T) => T)(current)
          : value;
      writeStored(key, next);
    },
    [key, initial],
  );

  return [state, setState];
}
