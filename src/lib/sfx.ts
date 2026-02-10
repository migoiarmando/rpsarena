const BUTTON_SFX_URL = "/button.wav";
const TYPE_SFX_URL = "/type.wav";

function play(url: string): void {
  try {
    const audio = new Audio(url);
    audio.play().catch(() => {
    });
  } catch {
  }
}

export function playClick(): void {
  play(BUTTON_SFX_URL);
}

export function playType(): void {
  play(TYPE_SFX_URL);
}
