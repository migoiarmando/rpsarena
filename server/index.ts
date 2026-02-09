// Simple Socket.IO game server for RPS Arena
// -------------------------------------------------------------
// This server is responsible ONLY for:
// - Managing rooms and players in memory
// - Running game rounds using the shared gameLogic module
// - Coordinating play-again choices between two players
//
// It does NOT render any HTML; your Next.js app remains the UI.
// You can deploy this as a separate Node service on Render.

import http from "http";
import express from "express";
import { Server as SocketIOServer } from "socket.io";

// We import game and room logic from the shared src/lib modules
// so that both the frontend and backend use exactly the same rules.
import {
  applyRound,
  createInitialState,
  GameState,
  Move,
} from "../src/lib/gameLogic";

// Basic room structures are inspired by src/lib/rooms.ts, but
// extended here to support per-round moves and play-again tracking.

type RoomStatus = "waiting" | "in_progress" | "finished" | "rematch_pending";

interface PlayerInfo {
  id: string;
  name: string;
}

interface Room {
  id: string;
  players: PlayerInfo[];
  status: RoomStatus;
  gameState: GameState;
  hostId: string; // ID of the player who created the room
}

// In-memory room store. In a production setup you would use
// a shared data store such as Redis or a database instead.
const rooms = new Map<string, Room>();

// Per-room pending moves: we wait until both players have submitted.
interface PendingMoves {
  [playerId: string]: Move;
}

const pendingMoves = new Map<string, PendingMoves>();

// Per-room play-again choices: we wait until both players have chosen.
interface PlayAgainChoices {
  [playerId: string]: "yes" | "no";
}

const playAgainChoices = new Map<string, PlayAgainChoices>();

// Track which room / player is associated with each socket so that
// we can clean up empty rooms when players disconnect.
interface SocketIdentity {
  roomId: string;
  playerId: string;
}

const socketIdentity = new Map<string, SocketIdentity>();

// Track pending room deletions with timeouts to allow reconnection.
// Key: roomId, Value: NodeJS.Timeout
const pendingRoomDeletions = new Map<string, NodeJS.Timeout>();

// Helper: cancel a pending room deletion if it exists.
function cancelPendingRoomDeletion(roomId: string) {
  const timeout = pendingRoomDeletions.get(roomId);
  if (timeout) {
    clearTimeout(timeout);
    pendingRoomDeletions.delete(roomId);
  }
}

// Helper: schedule a room deletion after a delay to allow reconnection.
function scheduleRoomDeletion(roomId: string, delayMs: number = 5000) {
  // Cancel any existing pending deletion for this room.
  cancelPendingRoomDeletion(roomId);

  const timeout = setTimeout(() => {
    const room = rooms.get(roomId);
    if (!room) {
      // Room already deleted, nothing to do.
      pendingRoomDeletions.delete(roomId);
      return;
    }

    // Check if there are active sockets in the room now.
    // If sockets exist, it means someone reconnected - don't delete.
    const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
    const hasActiveSockets = socketsInRoom && socketsInRoom.size > 0;

    if (hasActiveSockets) {
      // Sockets exist - someone reconnected. Cancel deletion.
      pendingRoomDeletions.delete(roomId);
      return;
    }

    // Check if any players in room.players have active socket identities.
    // This catches cases where a player reconnected but we haven't updated room.players yet.
    let hasActivePlayer = false;
    for (const player of room.players) {
      // Check if any socket has this playerId for this roomId.
      for (const [socketId, identity] of socketIdentity.entries()) {
        if (identity.roomId === roomId && identity.playerId === player.id) {
          hasActivePlayer = true;
          break;
        }
      }
      if (hasActivePlayer) break;
    }

    // Only delete if no active sockets AND no active player identities.
    if (!hasActiveSockets && !hasActivePlayer && room.players.length === 0) {
      rooms.delete(roomId);
      pendingMoves.delete(roomId);
      playAgainChoices.delete(roomId);
      io.emit("roomList", { rooms: serializeRooms() });
    }
    pendingRoomDeletions.delete(roomId);
  }, delayMs);

  pendingRoomDeletions.set(roomId, timeout);
}

// Helper: serialize a single room to match frontend RoomSummary format.
// Frontend expects players as string[] (player names), not PlayerInfo[].
function serializeRoom(room: Room) {
  return {
    id: room.id,
    players: room.players.map((p) => p.name),
    status: room.status,
    hostId: room.hostId,
  };
}

// Helper: list all rooms in a simple shape for the lobby.
function serializeRooms() {
  return Array.from(rooms.values()).map(serializeRoom);
}

// Helper: create a new room.
function createRoom(roomId: string, creator: PlayerInfo): Room {
  if (rooms.has(roomId)) {
    throw new Error("Room already exists");
  }
  const room: Room = {
    id: roomId,
    players: [creator],
    status: "waiting",
    gameState: createInitialState(),
    hostId: creator.id, // Track who created the room
  };
  rooms.set(roomId, room);
  return room;
}

// Helper: join an existing room.
function joinRoom(roomId: string, player: PlayerInfo): Room {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error("Room not found");
  }
  if (room.players.find((p) => p.id === player.id)) {
    // Player already in room; just return the room.
    return room;
  }
  if (room.players.length >= 2) {
    throw new Error("Room is full");
  }
  room.players.push(player);
  // Don't change status to "in_progress" yet - wait for host to start the game.
  // Keep status as "waiting" until host explicitly starts.
  return room;
}

// Helper: find opponent id for a given player in a room.
function getOpponentId(room: Room, playerId: string): string | null {
  const other = room.players.find((p) => p.id !== playerId);
  return other ? other.id : null;
}

// -------------------------------------------------------------
// Express + Socket.IO setup
// -------------------------------------------------------------

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  // Allow CORS from your frontend; adjust origin as needed in production.
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Simple health-check route so Render can verify the service.
app.get("/", (_req, res) => {
  res.send("RPS Arena Socket.IO server is running");
});

io.on("connection", (socket) => {
  // We store a minimal identity on the socket for convenience.
  let currentPlayerName: string | null = null;

  // When a new socket connects, immediately send them the current room list
  // so they can see available rooms right away.
  socket.emit("roomList", { rooms: serializeRooms() });

  // Client should send its playerName once after connection so
  // we can use it for room membership and game tracking.
  socket.on("identify", (payload: { playerName: string }) => {
    const trimmed = (payload?.playerName ?? "").trim();
    if (!trimmed) {
      socket.emit("error", { message: "Player name is required" });
      return;
    }
    currentPlayerName = trimmed;
    // After identifying, send updated room list in case anything changed.
    socket.emit("roomList", { rooms: serializeRooms() });
  });

  // List all rooms for the lobby.
  socket.on("listRooms", () => {
    socket.emit("roomList", { rooms: serializeRooms() });
  });

  // Create a new room.
  socket.on(
    "createRoom",
    (payload: { roomId: string; playerName?: string }) => {
      try {
        const roomId = (payload?.roomId ?? "").trim();
        const name = (payload?.playerName ?? currentPlayerName ?? "").trim();
        if (!roomId || !name) {
          socket.emit("error", {
            message: "roomId and playerName are required",
          });
          return;
        }

        const player: PlayerInfo = {
          id: name,
          name,
        };

        const room = createRoom(roomId, player);
        socket.join(roomId);

        // Cancel any pending deletion for this room (handles reconnection).
        cancelPendingRoomDeletion(roomId);

        // Remember where this socket lives so we can clean up on disconnect.
        socketIdentity.set(socket.id, { roomId, playerId: player.id });

        // Notify everyone in the lobby and the room.
        io.emit("roomList", { rooms: serializeRooms() });
        io.to(roomId).emit("roomUpdate", { room: serializeRoom(room) });

        // Emit roomCreated event to keep player in lobby view.
        // Game will start only when 2 players join.
        socket.emit("roomCreated", {
          roomId,
          room: { ...serializeRoom(room), gameState: room.gameState },
        });
      } catch (err: any) {
        socket.emit("error", { message: err?.message ?? "Create room failed" });
      }
    }
  );

  // Join an existing room.
  socket.on(
    "joinRoom",
    (payload: { roomId: string; playerName?: string }) => {
      try {
        const roomId = (payload?.roomId ?? "").trim();
        const name = (payload?.playerName ?? currentPlayerName ?? "").trim();
        if (!roomId || !name) {
          socket.emit("error", {
            message: "roomId and playerName are required",
          });
          return;
        }

        const player: PlayerInfo = {
          id: name,
          name,
        };

        const room = joinRoom(roomId, player);
        socket.join(roomId);

        // Cancel any pending deletion for this room (handles reconnection).
        cancelPendingRoomDeletion(roomId);

        // Remember where this socket lives so we can clean up on disconnect.
        socketIdentity.set(socket.id, { roomId, playerId: player.id });

        // Notify everyone in the lobby and the room.
        io.emit("roomList", { rooms: serializeRooms() });
        io.to(roomId).emit("roomUpdate", { room: serializeRoom(room) });

        // Emit roomCreated to keep player in lobby view.
        // Game will start only when host clicks "Start" button.
        socket.emit("roomCreated", {
          roomId,
          room: { ...serializeRoom(room), gameState: room.gameState },
        });
      } catch (err: any) {
        socket.emit("error", { message: err?.message ?? "Join room failed" });
      }
    }
  );

  // Handle host starting the game (only host can start, and only when 2 players are present).
  socket.on(
    "startGame",
    (payload: { roomId: string; playerName?: string }) => {
      try {
        const roomId = (payload?.roomId ?? "").trim();
        const name = (payload?.playerName ?? currentPlayerName ?? "").trim();
        if (!roomId || !name) {
          socket.emit("error", {
            message: "roomId and playerName are required",
          });
          return;
        }

        const room = rooms.get(roomId);
        if (!room) {
          socket.emit("error", { message: "Room not found" });
          return;
        }

        // Only the host can start the game.
        if (room.hostId !== name) {
          socket.emit("error", {
            message: "Only the room host can start the game",
          });
          return;
        }

        // Need exactly 2 players to start.
        if (room.players.length !== 2) {
          socket.emit("error", {
            message: "Need 2 players to start the game",
          });
          return;
        }

        // Start the game: set status and initialize game state.
        room.status = "in_progress";
        room.gameState = createInitialState();

        // Notify everyone in the lobby that the room status changed.
        io.emit("roomList", { rooms: serializeRooms() });

        // Start the game for both players in the room.
        io.to(roomId).emit("gameStart", {
          roomId: room.id,
          room: { ...serializeRoom(room), gameState: room.gameState },
        });

        // Send initial game state for this room.
        io.to(roomId).emit("stateUpdate", {
          roomId: room.id,
          state: room.gameState,
          roundMessage: "",
          gameOver: false,
        });
      } catch (err: any) {
        socket.emit("error", {
          message: err?.message ?? "Start game failed",
        });
      }
    }
  );

  // Handle a player's move. We accumulate moves per round and only resolve
  // when both players have submitted.
  socket.on(
    "makeMove",
    (payload: { roomId: string; playerName?: string; move: Move }) => {
      try {
        const roomId = (payload?.roomId ?? "").trim();
        const name = (payload?.playerName ?? currentPlayerName ?? "").trim();
        const move = payload?.move;

        if (!roomId || !name || !move) {
          socket.emit("error", {
            message: "roomId, playerName and move are required",
          });
          return;
        }

        const room = rooms.get(roomId);
        if (!room) {
          socket.emit("error", { message: "Room not found" });
          return;
        }
        if (room.players.length < 2) {
          socket.emit("error", {
            message: "Need two players in the room to play",
          });
          return;
        }

        const opponentId = getOpponentId(room, name);
        if (!opponentId) {
          socket.emit("error", { message: "Opponent not found" });
          return;
        }

        const pending = pendingMoves.get(roomId) ?? {};
        pending[name] = move;
        pendingMoves.set(roomId, pending);

        // Only resolve round when both players have submitted.
        if (pending[name] && pending[opponentId]) {
          const p1Id = room.players[0].id;
          const p2Id = room.players[1].id;
          const p1Move = pending[p1Id];
          const p2Move = pending[p2Id];

          if (!p1Move || !p2Move) {
            // Should not happen, but guard just in case.
            socket.emit("error", {
              message: "Both players must submit a move",
            });
            return;
          }

          const result = applyRound(room.gameState, p1Move, p2Move);
          room.gameState = result.state;

          // Clear pending moves for next round.
          pendingMoves.set(roomId, {});

          if (result.gameOver) {
            room.status = "finished";
          }

          io.to(roomId).emit("stateUpdate", {
            roomId: room.id,
            state: result.state,
            roundMessage:
              result.message +
              (result.gameOverMessage ? "\n" + result.gameOverMessage : ""),
            gameOver: result.gameOver,
          });
        }
      } catch (err: any) {
        socket.emit("error", { message: err?.message ?? "Move failed" });
      }
    }
  );

  // Handle play-again choices from both players.
  socket.on(
    "playAgainChoice",
    (payload: { roomId: string; playerName?: string; choice: "yes" | "no" }) => {
      try {
        const roomId = (payload?.roomId ?? "").trim();
        const name = (payload?.playerName ?? currentPlayerName ?? "").trim();
        const choice = payload?.choice;

        if (!roomId || !name || !choice) {
          socket.emit("error", {
            message: "roomId, playerName and choice are required",
          });
          return;
        }

        const room = rooms.get(roomId);
        if (!room) {
          socket.emit("error", { message: "Room not found" });
          return;
        }

        const choices = playAgainChoices.get(roomId) ?? {};
        choices[name] = choice;
        playAgainChoices.set(roomId, choices);

        // If any player chooses "no", end the match and return to lobby.
        const playerIds = room.players.map((p) => p.id);
        const anyNo = playerIds.some((id) => choices[id] === "no");
        if (anyNo) {
          room.status = "finished";
          io.to(roomId).emit("playAgainUpdate", {
            roomId,
            status: "ended",
          });
          io.emit("roomList", { rooms: serializeRooms() });
          return;
        }

        // If both have chosen "yes", start a rematch.
        const allYes =
          playerIds.length === 2 &&
          playerIds.every((id) => choices[id] === "yes");
        if (allYes) {
          room.status = "in_progress";
          room.gameState = createInitialState();
          playAgainChoices.set(roomId, {});

          io.to(roomId).emit("playAgainUpdate", {
            roomId,
            status: "rematch",
          });
          io.to(roomId).emit("stateUpdate", {
            roomId: room.id,
            state: room.gameState,
            roundMessage: "",
            gameOver: false,
          });
          io.emit("roomList", { rooms: serializeRooms() });
        }
      } catch (err: any) {
        socket.emit("error", {
          message: err?.message ?? "Play again choice failed",
        });
      }
    }
  );

  // When a socket disconnects, remove its player from any room
  // it was associated with. If the room becomes empty, delete it.
  socket.on("disconnect", () => {
    const identity = socketIdentity.get(socket.id);
    if (!identity) {
      // Socket wasn't associated with any room, nothing to clean up.
      return;
    }
    socketIdentity.delete(socket.id);

    const { roomId, playerId } = identity;
    const room = rooms.get(roomId);
    if (!room) {
      // Room was already deleted, nothing to do.
      return;
    }

    // Defensive check: verify the player actually exists in this room
    // before attempting to remove them (handles race conditions).
    const playerExists = room.players.some((p) => p.id === playerId);
    if (!playerExists) {
      // Player was already removed, nothing to do.
      return;
    }

    // Check if there are any active Socket.IO sockets still in this room.
    // Socket.IO automatically removes disconnected sockets from rooms, so
    // by the time we check, the disconnected socket is already gone.
    // However, we want to keep the player in the room list temporarily
    // to allow reconnection (e.g., page refresh).
    const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
    const hasActiveSockets = socketsInRoom && socketsInRoom.size > 0;

    // Don't immediately remove the player from room.players - keep them
    // in the list temporarily to allow reconnection. The scheduled deletion
    // will check if they've reconnected before actually deleting.
    // Only remove if there are other players (multi-player scenario).
    if (room.players.length > 1) {
      // Multiple players: remove this one immediately since others are still there.
      room.players = room.players.filter((p) => p.id !== playerId);
      room.status = "waiting";
      pendingMoves.set(roomId, {});
      playAgainChoices.set(roomId, {});
      io.to(roomId).emit("roomUpdate", { room: serializeRoom(room) });
    } else {
      // Single player room: keep them in the list, schedule deletion.
      // If they reconnect within the timeout, the deletion will be cancelled.
      room.status = "waiting";
      scheduleRoomDeletion(roomId, 3000);
    }

    // Always refresh the lobby list.
    io.emit("roomList", { rooms: serializeRooms() });
  });
});

// Choose port from environment or fall back to 4000 for local dev.
const PORT = Number(process.env.PORT || 4000);

server.listen(PORT, () => {
  // Simple startup log for Render / local debugging.
  // eslint-disable-next-line no-console
  console.log(`RPS Arena Socket.IO server listening on port ${PORT}`);
});

