"use client";

import { useEffect, useRef, useState } from "react";

const MUSIC_URL = "/rpsarenamusic.mp3";
const DEFAULT_VOLUME = 0.5;

export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const triedUserInteraction = useRef(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  useEffect(() => {
    const audio = new Audio(MUSIC_URL);
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;

    const play = () => {
      audio.play().catch(() => {});
    };

    play();

    const onInteraction = () => {
      if (triedUserInteraction.current) return;
      triedUserInteraction.current = true;
      play();
      document.removeEventListener("click", onInteraction);
      document.removeEventListener("keydown", onInteraction);
      document.removeEventListener("touchstart", onInteraction);
    };

    document.addEventListener("click", onInteraction, { once: true });
    document.addEventListener("keydown", onInteraction, { once: true });
    document.addEventListener("touchstart", onInteraction, { once: true });

    return () => {
      audio.pause();
      audioRef.current = null;
      document.removeEventListener("click", onInteraction);
      document.removeEventListener("keydown", onInteraction);
      document.removeEventListener("touchstart", onInteraction);
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
