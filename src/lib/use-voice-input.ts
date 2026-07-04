"use client";

import { useCallback, useRef, useState } from "react";

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; [index: number]: { transcript?: string } };
  };
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function localeToSpeechLang(locale?: string): string {
  if (!locale || locale === "system") return "ru-RU";
  if (locale === "en") return "en-US";
  if (locale === "ru") return "ru-RU";
  return locale.includes("-") ? locale : `${locale}-${locale.toUpperCase()}`;
}

/**
 * Free on-device speech-to-text via the browser Web Speech API (Chrome, Edge,
 * Safari). No paid LLM / gateway transcription — same idea as expo-speech-
 * recognition on mobile.
 */
export function useVoiceInput(
  onText: (text: string) => void,
  locale?: string,
) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {}
      }
    }
    recognitionRef.current = null;
    setRecording(false);
    setBusy(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    stop();

    const recognition = new Ctor();
    recognition.lang = localeToSpeechLang(locale);
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i]?.[0]?.transcript?.trim();
        if (chunk) parts.push(chunk);
      }
      const text = parts.join(" ").trim();
      if (text) onTextRef.current(text);
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      const message =
        event.error === "not-allowed"
          ? "Microphone access denied"
          : event.error === "no-speech"
            ? "No speech detected"
            : "Voice input failed";
      setError(message);
      setRecording(false);
      setBusy(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setRecording(false);
      setBusy(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setBusy(true);
    try {
      recognition.start();
      setRecording(true);
      setBusy(false);
    } catch {
      recognitionRef.current = null;
      setRecording(false);
      setBusy(false);
      setError("Could not start voice input");
    }
  }, [locale, stop]);

  const toggle = useCallback(() => {
    if (recording) stop();
    else void start();
  }, [recording, start, stop]);

  return { recording, busy, error, toggle };
}
