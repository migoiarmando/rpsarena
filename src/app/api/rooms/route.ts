import { NextRequest, NextResponse } from "next/server";
import { createRoom, joinRoom, listRooms } from "@/lib/rooms";

export async function GET() {
  const rooms = listRooms().map((r) => ({
    id: r.id,
    players: r.players.map((p) => p.name),
    status: r.status,
  }));
  return NextResponse.json({ rooms });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, roomId, playerId, playerName } = body as {
    action: "create" | "join";
    roomId: string;
    playerId: string;
    playerName: string;
  };

  try {
    if (action === "create") {
      const room = createRoom(roomId, { id: playerId, name: playerName });
      return NextResponse.json(
        { ok: true, room: { id: room.id, players: room.players.map((p) => p.name), status: room.status } },
        { status: 201 }
      );
    }
    if (action === "join") {
      const room = joinRoom(roomId, { id: playerId, name: playerName });
      return NextResponse.json(
        { ok: true, room: { id: room.id, players: room.players.map((p) => p.name), status: room.status } },
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}

