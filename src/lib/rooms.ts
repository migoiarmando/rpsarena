// Very simple in-memory room and game state management.
// In a production deployment, you would back this with a shared store
// like Redis or a database.

import { applyRound, createInitialState, GameState, Move } from "./gameLogic";

export type RoomStatus = "waiting" | "in_progress" | "finished" | "rematch_pending";

export interface PlayerInfo {
  id: string;
  name: string;
}

export interface Room {
  id: string;
  players: PlayerInfo[];
  status: RoomStatus;
  gameState: GameState;
}

const rooms = new Map<string, Room>();

export function listRooms(): Room[] {
  return Array.from(rooms.values());
}

export function createRoom(roomId: string, creator: PlayerInfo): Room {
  if (rooms.has(roomId)) {
    throw new Error("Room already exists");
  }
  const room: Room = {
    id: roomId,
    players: [creator],
    status: "waiting",
    gameState: createInitialState(),
  };
  rooms.set(roomId, room);
  return room;
}

export function joinRoom(roomId: string, player: PlayerInfo): Room {
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
  room.status = "in_progress";
  return room;
}

export interface SubmitMoveResult {
  room: Room;
  roundResolved: boolean;
  roundMessage?: string;
  gameOver?: boolean;
  gameOverMessage?: string;
}

// For now, this function assumes both players have submitted the same move
// and immediately resolves a round to exercise game logic and UI.
export function submitMove(
  roomId: string,
  playerId: string,
  move: Move
): SubmitMoveResult {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error("Room not found");
  }
  if (room.players.length < 2) {
    throw new Error("Need two players to start");
  }

  const result = applyRound(room.gameState, move, move);
  room.gameState = result.state;

  if (result.gameOver) {
    room.status = "finished";
  }

  return {
    room,
    roundResolved: true,
    roundMessage: result.message,
    gameOver: result.gameOver,
    gameOverMessage: result.gameOverMessage,
  };
}

