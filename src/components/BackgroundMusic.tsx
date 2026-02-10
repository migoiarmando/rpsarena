"use client";

import { useEffect, useRef } from "react";
const MUSIC_URL = "/rpsarenamusic.mp3";

export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const triedUserInteraction = useRef(false);

  useEffect(() => {
    const audio = new Audio(MUSIC_URL);
    audio.loop = true;
    audioRef.current = audio;

    const play = () => {
      audio.play().catch(() => {
      });
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

  return null;
}
