/**
 * Keep-alive utility for the Socket.IO backend.
 */

const PING_INTERVAL_MS = 10 * 60 * 1000;

function pingBackend(url: string): void {
  fetch(url, { method: "GET", cache: "no-store" }).catch(() => {
  });
}

/**
 * Starts periodic pings to the backend. Only runs in the browser.
 * @returns Cleanup function that stops the interval, or null if not started.
 */
export function startKeepAlive(): (() => void) | null {
  if (typeof window === "undefined") return null;

  const baseUrl = process.env.NEXT_PUBLIC_SOCKET_IO_URL;
  if (!baseUrl || baseUrl === window.location.origin) {

    return null;
  }

  const url = baseUrl.replace(/\/$/, "") + "/";

  pingBackend(url);
  const intervalId = setInterval(() => pingBackend(url), PING_INTERVAL_MS);

  return () => clearInterval(intervalId);
}
