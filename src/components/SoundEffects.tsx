"use client";

import { useEffect } from "react";
import { playClick, playType } from "@/lib/sfx";

export function SoundEffects() {
  useEffect(() => {
    const onDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (target && "closest" in target && (target as Element).closest("button")) {
        playClick();
      }
    };

    const onDocumentKeydown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const isInput = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      const isCharacter = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      const isDelete = e.key === "Backspace" || e.key === "Delete";
      if (isInput && (isCharacter || isDelete)) {
        playType();
      } else if (isInput && e.key === "Enter") {
        playClick();
      }
    };

    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeydown);

    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onDocumentKeydown);
    };
  }, []);

  return null;
}
