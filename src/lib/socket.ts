// Thin Socket.IO client wrapper for the RPS Arena frontend.
// ---------------------------------------------------------
// This module centralizes how we connect to the backend Socket.IO
// server so that:
// - we have a single place to read SOCKET_IO_URL from the environment
// - we avoid sprinkling connection logic throughout the React code
//
// The actual React components should import `createSocketClient` and
// manage the connection lifecycle inside useEffect hooks.

import { io, Socket } from "socket.io-client";

// Small type alias for our socket instance. We keep it generic so
// we can evolve event typings later without touching all imports.
export type GameSocket = Socket;

// Helper to construct a new Socket.IO client connection.
// Call this in React on the client side only.
export function createSocketClient(): GameSocket {
  // We read the backend URL from an environment variable so that
  // you can point the frontend at:
  // - http://localhost:4000 during local development
  // - your Render backend URL in production
  //
  // If the env var is not set, we fall back to same-origin, which
  // is useful if you later decide to proxy the backend through Next.
  const url =
    process.env.NEXT_PUBLIC_SOCKET_IO_URL || window.location.origin;

  return io(url, {
    // Allow automatic reconnection to make the experience smoother
    // if the backend restarts or the network blips.
    autoConnect: true,
    transports: ["websocket", "polling"],
  });
}

