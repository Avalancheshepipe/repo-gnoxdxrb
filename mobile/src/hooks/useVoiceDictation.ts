import { requireOptionalNativeModule } from "expo-modules-core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceOverlayMode } from "../components/VoicePermissionOverlay";

/**
 * Voice dictation backed by expo-speech-recognition. Shows a premium permission
 * overlay before requesting native mic access; re-shows it when access is denied.
 */
type SpeechModule = {
  ExpoSpeechRecognitionModule: {
    getPermissionsAsync: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
    requestPermissionsAsync: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
    start: (opts: Record<string, unknown>) => void;
    stop: () => void;
    addListener: (
      event: string,
      listener: (payload: unknown) => void,
    ) => { remove: () => void };
  };
};

const NATIVE_PRESENT = Boolean(requireOptionalNativeModule("ExpoSpeechRecognition"));

let cached: SpeechModule | null | undefined;
function loadSpeech(): SpeechModule | null {
  if (!NATIVE_PRESENT) return null;
  if (cached !== undefined) return cached ?? null;
  try {
    cached = require("expo-speech-recognition") as SpeechModule;
  } catch {
    cached = null;
  }
  return cached ?? null;
}

type ResultPayload = { results?: { transcript?: string }[] };

export function useVoiceDictation(onText: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayMode, setOverlayMode] = useState<VoiceOverlayMode>("permission");
  const [requesting, setRequesting] = useState(false);
  const subs = useRef<{ remove: () => void }[]>([]);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const cleanup = useCallback(() => {
    subs.current.forEach((s) => {
      try {
        s.remove();
      } catch {}
    });
    subs.current = [];
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    const m = loadSpeech();
    try {
      m?.ExpoSpeechRecognitionModule.stop();
    } catch {}
    setRecording(false);
    cleanup();
  }, [cleanup]);

  const startRecognition = useCallback(async () => {
    const m = loadSpeech();
    if (!m) return false;
    const Mod = m.ExpoSpeechRecognitionModule;
    try {
      cleanup();
      subs.current.push(
        Mod.addListener("result", (payload) => {
          const transcript = (payload as ResultPayload).results?.[0]?.transcript;
          if (transcript) onTextRef.current(transcript);
        }),
        Mod.addListener("end", () => {
          setRecording(false);
          cleanup();
        }),
        Mod.addListener("error", () => {
          setRecording(false);
          cleanup();
        }),
      );
      Mod.start({ lang: "ru-RU", interimResults: true, continuous: false });
      setRecording(true);
      return true;
    } catch {
      setRecording(false);
      cleanup();
      return false;
    }
  }, [cleanup]);

  const hasMicPermission = useCallback(async () => {
    const m = loadSpeech();
    if (!m) return false;
    try {
      const perm = await m.ExpoSpeechRecognitionModule.getPermissionsAsync();
      return perm.granted;
    } catch {
      return false;
    }
  }, []);

  const requestMicPermission = useCallback(async () => {
    const m = loadSpeech();
    if (!m) return false;
    setRequesting(true);
    try {
      const perm = await m.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return perm.granted;
    } catch {
      return false;
    } finally {
      setRequesting(false);
    }
  }, []);

  const dismissOverlay = useCallback(() => {
    setOverlayVisible(false);
  }, []);

  const showOverlay = useCallback((mode: VoiceOverlayMode) => {
    setOverlayMode(mode);
    setOverlayVisible(true);
  }, []);

  const onMicPress = useCallback(async () => {
    if (recording) {
      stop();
      return;
    }

    if (!NATIVE_PRESENT) {
      showOverlay("unavailable");
      return;
    }

    const granted = await hasMicPermission();
    if (granted) {
      setOverlayVisible(false);
      await startRecognition();
      return;
    }

    showOverlay("permission");
  }, [recording, stop, hasMicPermission, showOverlay, startRecognition]);

  const grantAccess = useCallback(async () => {
    if (overlayMode === "unavailable") {
      dismissOverlay();
      return;
    }

    const granted = await requestMicPermission();
    if (granted) {
      setOverlayVisible(false);
      await startRecognition();
      return;
    }

    // Keep overlay open so the user can retry or open system settings.
    showOverlay("permission");
  }, [
    overlayMode,
    dismissOverlay,
    requestMicPermission,
    startRecognition,
    showOverlay,
  ]);

  return {
    recording,
    overlayVisible,
    overlayMode,
    requesting,
    onMicPress,
    grantAccess,
    dismissOverlay,
  };
}
