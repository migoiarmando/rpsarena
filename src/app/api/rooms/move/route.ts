import { NextRequest, NextResponse } from "next/server";
import { submitMove } from "@/lib/rooms";
import { Move } from "@/lib/gameLogic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { roomId, playerId, move } = body as {
    roomId: string;
    playerId: string;
    move: Move;
  };

  try {
    const result = submitMove(roomId, playerId, move);
    return NextResponse.json({
      ok: true,
      roundMessage: result.roundMessage,
      gameOver: result.gameOver,
      gameOverMessage: result.gameOverMessage,
      state: result.room.gameState,
    });
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

