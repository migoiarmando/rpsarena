"use client";

import { useEffect, useRef, useState } from "react";

const MUSIC_URL = "/rpsarenamusic.mp3";
const DEFAULT_VOLUME = 0.5;

export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tryPlayRef = useRef<((reason: string) => void) | null>(null);
  const hasUserGestureRef = useRef(false);
  const isPlayingRef = useRef(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasUserGesture, setHasUserGesture] = useState(false);
  const [lastPlayError, setLastPlayError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const audio = new Audio(MUSIC_URL);
    audio.loop = true;
    audio.volume = DEFAULT_VOLUME;
    audio.preload = "auto";
    audio.load();
    audioRef.current = audio;

    const tryPlay = (reason: string) => {
      if (isPlayingRef.current) return;

      if (audio.error) {
        try {
          audio.load();
        } catch {
        }
      }

      const playPromise = audio.play();
      if (!playPromise) return;

      playPromise.catch((err) => {
        const errorName =
          err instanceof Error
            ? err.name
            : err && typeof err === "object" && "name" in err
              ? String((err as { name?: unknown }).name ?? "Error")
              : "Error";
        const errorMessage =
          err instanceof Error
            ? err.message
            : err && typeof err === "object" && "message" in err
              ? String((err as { message?: unknown }).message ?? "")
              : String(err ?? "");
        const mediaErrorCode = audio.error?.code;

        const summary = `[bgm] play() rejected (${reason}) ${errorName}: ${errorMessage}${
          mediaErrorCode ? ` (mediaErrorCode=${mediaErrorCode})` : ""
        }`;

        if (isMounted) setLastPlayError(summary);
        console.warn(summary);
      });
    };
    tryPlayRef.current = tryPlay;

    tryPlay("mount");

    const onPlaying = () => {
      isPlayingRef.current = true;
      if (!isMounted) return;
      setIsPlaying(true);
      setLastPlayError(null);
    };

    const onPauseOrEnd = () => {
      isPlayingRef.current = false;
      if (!isMounted) return;
      setIsPlaying(false);
    };

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPauseOrEnd);
    audio.addEventListener("ended", onPauseOrEnd);

    const onUserGesture = () => {
      if (!hasUserGestureRef.current) {
        hasUserGestureRef.current = true;
        if (isMounted) setHasUserGesture(true);
      }
      tryPlay("userGesture");
    };

    document.addEventListener("pointerdown", onUserGesture, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", onUserGesture, { capture: true });
    document.addEventListener("touchstart", onUserGesture, {
      capture: true,
      passive: true,
    });

    return () => {
      isMounted = false;
      audio.pause();
      audioRef.current = null;
      tryPlayRef.current = null;

      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPauseOrEnd);
      audio.removeEventListener("ended", onPauseOrEnd);

      document.removeEventListener("pointerdown", onUserGesture, { capture: true });
      document.removeEventListener("keydown", onUserGesture, { capture: true });
      document.removeEventListener("touchstart", onUserGesture, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  return (
    <div className="fixed bottom-2 right-2 z-50 flex items-center gap-2 rounded border border-green-700 bg-black/80 px-2 py-1.5 text-xs sm:bottom-4 sm:right-4 sm:px-3 sm:py-2 sm:text-sm">
      <label htmlFor="music-volume" className="text-green-400">
        Music
      </label>
      {hasUserGesture && !isPlaying ? (
        <button
          type="button"
          onClick={() => {
            tryPlayRef.current?.("ui");
          }}
          className="rounded border border-green-700 px-2 py-0.5 text-green-300 hover:bg-green-900/30"
          aria-label="Enable background music"
          title={lastPlayError ?? "Enable background music"}
        >
          Enable
        </button>
      ) : null}
      <input
        id="music-volume"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        className="h-2 w-20 accent-green-500 sm:w-24"
        aria-label="Background music volume"
      />
    </div>
  );
}
