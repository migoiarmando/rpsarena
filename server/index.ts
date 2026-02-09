import http from "http";
import express from "express";
import { Server as SocketIOServer } from "socket.io";

import {
  applyRound,
  createInitialState,
  GameState,
  Move,
} from "../src/lib/gameLogic";

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
  hostId: string; 
}

const rooms = new Map<string, Room>();

interface PendingMoves {
  [playerId: string]: Move;
}

const pendingMoves = new Map<string, PendingMoves>();

interface PlayAgainChoices {
  [playerId: string]: "yes" | "no";
}

const playAgainChoices = new Map<string, PlayAgainChoices>();

interface SocketIdentity {
  roomId: string;
  playerId: string;
}

const socketIdentity = new Map<string, SocketIdentity>();

const pendingRoomDeletions = new Map<string, NodeJS.Timeout>();

function cancelPendingRoomDeletion(roomId: string) {
  const timeout = pendingRoomDeletions.get(roomId);
  if (timeout) {
    clearTimeout(timeout);
    pendingRoomDeletions.delete(roomId);
  }
}

function scheduleRoomDeletion(roomId: string, delayMs: number = 5000) {
  cancelPendingRoomDeletion(roomId);

  const timeout = setTimeout(() => {
    const room = rooms.get(roomId);
    if (!room) {
      pendingRoomDeletions.delete(roomId);
      return;
    }

    const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
    const hasActiveSockets = socketsInRoom && socketsInRoom.size > 0;

    if (hasActiveSockets) {
      pendingRoomDeletions.delete(roomId);
      return;
    }

    let hasActivePlayer = false;
    for (const player of room.players) {
      for (const [socketId, identity] of socketIdentity.entries()) {
        if (identity.roomId === roomId && identity.playerId === player.id) {
          hasActivePlayer = true;
          break;
        }
      }
      if (hasActivePlayer) break;
    }

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

function serializeRoom(room: Room) {
  return {
    id: room.id,
    players: room.players.map((p) => p.name),
    status: room.status,
    hostId: room.hostId,
  };
}

function serializeRooms() {
  return Array.from(rooms.values()).map(serializeRoom);
}

function createRoom(roomId: string, creator: PlayerInfo): Room {
  if (rooms.has(roomId)) {
    throw new Error("Room already exists");
  }
  const room: Room = {
    id: roomId,
    players: [creator],
    status: "waiting",
    gameState: createInitialState(),
    hostId: creator.id, 
  };
  rooms.set(roomId, room);
  return room;
}

function joinRoom(roomId: string, player: PlayerInfo): Room {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error("Room not found");
  }
  if (room.players.find((p) => p.id === player.id)) {
    return room;
  }
  if (room.players.length >= 2) {
    throw new Error("Room is full");
  }
  room.players.push(player);
  return room;
}

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
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.get("/", (_req, res) => {
  res.send("RPS Arena Socket.IO server is running");
});

io.on("connection", (socket) => {
  let currentPlayerName: string | null = null;

  socket.emit("roomList", { rooms: serializeRooms() });

  socket.on("identify", (payload: { playerName: string }) => {
    const trimmed = (payload?.playerName ?? "").trim();
    if (!trimmed) {
      socket.emit("error", { message: "Player name is required" });
      return;
    }
    currentPlayerName = trimmed;
    socket.emit("roomList", { rooms: serializeRooms() });
  });

  socket.on("listRooms", () => {
    socket.emit("roomList", { rooms: serializeRooms() });
  });

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

        cancelPendingRoomDeletion(roomId);

        socketIdentity.set(socket.id, { roomId, playerId: player.id });

        io.emit("roomList", { rooms: serializeRooms() });
        io.to(roomId).emit("roomUpdate", { room: serializeRoom(room) });

        socket.emit("roomCreated", {
          roomId,
          room: { ...serializeRoom(room), gameState: room.gameState },
        });
      } catch (err: any) {
        socket.emit("error", { message: err?.message ?? "Create room failed" });
      }
    },
  );

  socket.on("joinRoom", (payload: { roomId: string; playerName?: string }) => {
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

      cancelPendingRoomDeletion(roomId);

      socketIdentity.set(socket.id, { roomId, playerId: player.id });

      io.emit("roomList", { rooms: serializeRooms() });
      io.to(roomId).emit("roomUpdate", { room: serializeRoom(room) });

      socket.emit("roomCreated", {
        roomId,
        room: { ...serializeRoom(room), gameState: room.gameState },
      });
    } catch (err: any) {
      socket.emit("error", { message: err?.message ?? "Join room failed" });
    }
  });

  socket.on("startGame", (payload: { roomId: string; playerName?: string }) => {
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

      if (room.hostId !== name) {
        socket.emit("error", {
          message: "Only the room host can start the game",
        });
        return;
      }

      if (room.players.length !== 2) {
        socket.emit("error", {
          message: "Need 2 players to start the game",
        });
        return;
      }

      room.status = "in_progress";
      room.gameState = createInitialState();

      io.emit("roomList", { rooms: serializeRooms() });

      io.to(roomId).emit("gameStart", {
        roomId: room.id,
        room: { ...serializeRoom(room), gameState: room.gameState },
      });

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
  });

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

        if (pending[name] && pending[opponentId]) {
          const p1Id = room.players[0].id;
          const p2Id = room.players[1].id;
          const p1Move = pending[p1Id];
          const p2Move = pending[p2Id];

          if (!p1Move || !p2Move) {
            socket.emit("error", {
              message: "Both players must submit a move",
            });
            return;
          }

          const result = applyRound(room.gameState, p1Move, p2Move);
          room.gameState = result.state;

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
            p1Move: p1Move,
            p2Move: p2Move,
          });
        }
      } catch (err: any) {
        socket.emit("error", { message: err?.message ?? "Move failed" });
      }
    },
  );

  socket.on(
    "playAgainChoice",
    (payload: {
      roomId: string;
      playerName?: string;
      choice: "yes" | "no";
    }) => {
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
    },
  );

  socket.on("disconnect", () => {
    const identity = socketIdentity.get(socket.id);
    if (!identity) {
      return;
    }
    socketIdentity.delete(socket.id);

    const { roomId, playerId } = identity;
    const room = rooms.get(roomId);
    if (!room) {
      return;
    }

    const playerExists = room.players.some((p) => p.id === playerId);
    if (!playerExists) {
      return;
    }

    const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
    const hasActiveSockets = socketsInRoom && socketsInRoom.size > 0;

    if (room.players.length > 1) {
      room.players = room.players.filter((p) => p.id !== playerId);
      room.status = "waiting";
      pendingMoves.set(roomId, {});
      playAgainChoices.set(roomId, {});
      io.to(roomId).emit("roomUpdate", { room: serializeRoom(room) });
    } else {
      room.status = "waiting";
      scheduleRoomDeletion(roomId, 3000);
    }

    io.emit("roomList", { rooms: serializeRooms() });
  });
});

const PORT = Number(process.env.PORT || 4000);

server.listen(PORT, () => {
  console.log(`RPS Arena Socket.IO server listening on port ${PORT}`);
});
