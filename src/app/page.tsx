"use client";

import { useEffect, useMemo, useState } from "react";
import { createInitialState, GameState, Move } from "@/lib/gameLogic";

type AppState = "WELCOME" | "ENTER_NAME" | "LOBBY" | "IN_GAME" | "PLAY_AGAIN";

interface RoomSummary {
  id: string;
  players: string[];
  status: "waiting" | "in_progress" | "finished";
}

interface RoundViewState {
  lastMessage: string;
  state: GameState;
}

const WELCOME_ART = String.raw`
  ____  ____   ____       _                         
 |  _ \|  _ \ / ___|_   _| | ___  _ __   __ _ _ __  
 | |_) | |_) | |  _| | | | |/ _ \| '_ \ / _\` | '_ \ 
 |  _ <|  __/| |_| | |_| | | (_) | | | | (_| | | | |
 |_| \_\_|    \____|\__,_|_|\___/|_| |_|\__,_|_| |_|

 Rock Paper Scissors Arena (web)
`;

export default function Home() {
  const [appState, setAppState] = useState<AppState>("WELCOME");
  const [playerName, setPlayerName] = useState("");
  const [tempName, setTempName] = useState("");
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  // Reserved for future use when differentiating host vs guest behavior.
  // Currently unused, so we omit state to keep things simple.
  const [roundView, setRoundView] = useState<RoundViewState | null>(null);
  const [myMove, setMyMove] = useState<Move | null>(null);
  const [opponentMove, setOpponentMove] = useState<Move | null>(null);
  const [playAgainChoice, setPlayAgainChoice] = useState<"yes" | "no" | null>(null);
  const [playAgainTimer, setPlayAgainTimer] = useState(15);

  // Fake local-only lobby for now; will be replaced by Pusher-powered lobby.
  useEffect(() => {
    if (appState === "WELCOME") {
      const timeout = setTimeout(() => {
        setAppState("ENTER_NAME");
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [appState]);

  const healthBars = useMemo(() => {
    const state = roundView?.state ?? createInitialState();
    return {
      p1: createHealthBar(state.p1Hp),
      p2: createHealthBar(state.p2Hp),
      p1Hp: state.p1Hp,
      p2Hp: state.p2Hp,
    };
  }, [roundView]);

  function handleConfirmName() {
    const trimmed = tempName.trim();
    if (!trimmed) return;
    setPlayerName(trimmed);
    refreshRooms();
    setAppState("LOBBY");
  }

  async function refreshRooms() {
    const res = await fetch("/api/rooms", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setRooms(data.rooms as RoomSummary[]);
  }

  async function handleCreateOrJoinRoom(roomId: string) {
    if (!playerName) return;
    const action = rooms.find((r) => r.id === roomId) ? "join" : "create";
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        roomId,
        playerId: playerName,
        playerName,
      }),
    });
    if (!res.ok) {
      return;
    }
    const data = await res.json();
    setCurrentRoomId(data.room.id);
    setRoundView({
      lastMessage: "",
      state: createInitialState(),
    });
    setMyMove(null);
    setOpponentMove(null);
    setAppState("IN_GAME");
    refreshRooms();
  }

  async function handleLocalMove(move: Move) {
    if (!currentRoomId || !playerName) return;
    const res = await fetch("/api/rooms/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: currentRoomId, playerId: playerName, move }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setMyMove(move);
    setOpponentMove(move);
    setRoundView({
      lastMessage: data.roundMessage ?? "",
      state: data.state,
    });
    if (data.gameOver) {
      setAppState("PLAY_AGAIN");
      setPlayAgainChoice(null);
      setPlayAgainTimer(15);
    }
  }

  // Simple countdown timer for local play-again screen
  useEffect(() => {
    if (appState !== "PLAY_AGAIN") return;
    if (playAgainTimer <= 0) {
      return;
    }
    const id = setTimeout(() => setPlayAgainTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [appState, playAgainTimer]);

  function handlePlayAgain(choice: "yes" | "no") {
    setPlayAgainChoice(choice);
    if (choice === "yes") {
      setRoundView({
        lastMessage: "",
        state: createInitialState(),
      });
      setMyMove(null);
      setOpponentMove(null);
      setAppState("IN_GAME");
      setPlayAgainTimer(15);
    } else {
      setAppState("LOBBY");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-green-400">
      {/* Outer terminal container: slightly wider and taller for better readability */}
      <div className="w-full max-w-4xl border border-green-500 bg-black/90 shadow-lg">
        <div className="relative flex items-center border-b border-green-500 px-3 py-1 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-4 rounded-full bg-red-500" />
            <span className="inline-block h-4 w-4 rounded-full bg-yellow-500" />
            <span className="inline-block h-4 w-4 rounded-full bg-green-500" />
          </span>
          <span className="absolute left-1/2 -translate-x-1/2 font-mono text-green-300 text-[20px]">
            rps_arena@web: ~
          </span>
        </div>

        {/* Main content area: height and base font size bumped up for better readability */}
        <div className="h-[620px] overflow-y-auto px-4 py-3 font-mono text-2xl leading-relaxed">
          {appState === "WELCOME" && <WelcomeScreen />}
          {appState === "ENTER_NAME" && (
            <NameScreen
              tempName={tempName}
              onTempNameChange={setTempName}
              onConfirm={handleConfirmName}
            />
          )}
          {appState === "LOBBY" && (
            <LobbyScreen
              playerName={playerName}
              rooms={rooms}
              onCreateOrJoin={handleCreateOrJoinRoom}
            />
          )}
          {appState === "IN_GAME" && roundView && (
            <GameScreen
              playerName={playerName}
              roomId={currentRoomId}
              roundView={roundView}
              healthBars={healthBars}
              myMove={myMove}
              opponentMove={opponentMove}
              onMove={handleLocalMove}
            />
          )}
          {appState === "PLAY_AGAIN" && (
            <PlayAgainScreen
              timer={playAgainTimer}
              choice={playAgainChoice}
              onChoose={handlePlayAgain}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <pre className="whitespace-pre text-[10px] leading-[10px]">
      {WELCOME_ART}
    </pre>
  );
}

interface NameScreenProps {
  tempName: string;
  onTempNameChange: (value: string) => void;
  onConfirm: () => void;
}

function NameScreen({ tempName, onTempNameChange, onConfirm }: NameScreenProps) {
  return (
    <div>
      <p>Welcome to RPS Arena!</p>
      <p>Please enter your name to continue:</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-green-500">&gt;</span>
        <input
          className="flex-1 bg-black text-green-400 outline-none border-b border-dotted border-green-500"
          value={tempName}
          onChange={(e) => onTempNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm();
          }}
          autoFocus
        />
        <button
          className="ml-4 border border-green-500 px-4 py-1 text-xl leading-none hover:bg-green-500 hover:text-black"
          onClick={onConfirm}
        >
          OK
        </button>
      </div>
    </div>
  );
}

interface LobbyScreenProps {
  playerName: string;
  rooms: RoomSummary[];
  onCreateOrJoin: (roomId: string) => void;
}

function LobbyScreen({ playerName, rooms, onCreateOrJoin }: LobbyScreenProps) {
  return (
    <div>
      {/* Slightly larger lobby headings for better emphasis at the new scale */}
      <p className="text-4xl">{`Welcome, ${playerName}.`}</p>
      <p className="mt-1 text-2xl">Lobby - available rooms:</p>
      <div className="mt-2">
        {rooms.length === 0 && <p className="text-xl">No rooms yet. Create one to start.</p>}
        {rooms.map((room) => (
          <div
            key={room.id}
            className="mt-1 flex items-center justify-between border border-green-700 bg-black/60 px-2 py-1"
          >
            <span className="text-xl">
              Room <span className="font-bold">{room.id}</span> -{" "}
              {room.players.length}/2 players - {room.status}
            </span>
            <button
              className="border border-green-500 px-3 py-1 text-base hover:bg-green-500 hover:text-black"
              onClick={() => onCreateOrJoin(room.id)}
            >
              [ JOIN / START ]
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <button
          className="border border-green-500 px-3 py-1 text-xl hover:bg-green-500 hover:text-black"
          onClick={() => onCreateOrJoin(`room-${Math.floor(Math.random() * 1000)}`)}
        >
          [ CREATE RANDOM ROOM ]
        </button>
      </div>
      <p className="mt-4 text-xl text-green-500">
        (Rooms are stored in-memory on the server for now; Pusher-based realtime updates will be added next.)
      </p>
    </div>
  );
}

interface GameScreenProps {
  playerName: string;
  roomId: string | null;
  roundView: RoundViewState;
  healthBars: { p1: string; p2: string; p1Hp: number; p2Hp: number };
  myMove: Move | null;
  opponentMove: Move | null;
  onMove: (move: Move) => void;
}

function GameScreen({
  playerName,
  roomId,
  roundView,
  healthBars,
  myMove,
  opponentMove,
  onMove,
}: GameScreenProps) {
  return (
    <div>
      <p>
        {`Room: ${roomId ?? "N/A"} | You are: ${playerName}`}
      </p>
      <p className="mt-2">Health:</p>
      <pre className="mt-1 text-xl">
{`Your HP:      [${healthBars.p1}] (${healthBars.p1Hp})
Opponent HP: [${healthBars.p2}] (${healthBars.p2Hp})`}
      </pre>

      <div className="mt-3">
        <p className="text-xl">Enter your choice (Rock [r], Paper [p], Scissors [s]):</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <AsciiButton label="ROCK" onClick={() => onMove("r")} />
          <AsciiButton label="PAPER" onClick={() => onMove("p")} />
          <AsciiButton label="SCISSORS" onClick={() => onMove("s")} />
        </div>
        <p className="mt-2 text-md text-green-500">
          You can also press r / p / s on your keyboard (to be wired with real networking).
        </p>
      </div>

      <div className="mt-3 text-md">
        <p>{`Last move: you -> ${moveLabel(myMove)}, opponent -> ${moveLabel(
          opponentMove
        )}`}</p>
      </div>

      {roundView.lastMessage && (
        <pre className="mt-3 whitespace-pre-wrap text-xl">
          {roundView.lastMessage}
        </pre>
      )}
    </div>
  );
}

interface PlayAgainScreenProps {
  timer: number;
  choice: "yes" | "no" | null;
  onChoose: (choice: "yes" | "no") => void;
}

function PlayAgainScreen({ timer, choice, onChoose }: PlayAgainScreenProps) {
  return (
    <div>
      <p className="text-xl">Game over.</p>
      <p className="mt-1 text-xl">Play again? Timer: {timer}s</p>
      <div className="mt-2 flex gap-2">
        <AsciiButton
          label="YES"
          onClick={() => onChoose("yes")}
          active={choice === "yes"}
        />
        <AsciiButton
          label="NO"
          onClick={() => onChoose("no")}
          active={choice === "no"}
        />
      </div>
      <p className="mt-2 text-sm text-green-500">
        In the full version, a rematch will only start if both players agree before the timer runs
        out; otherwise you&apos;ll return to the lobby.
      </p>
    </div>
  );
}

interface AsciiButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
}

function AsciiButton({ label, onClick, active }: AsciiButtonProps) {
  // Global ASCII buttons (game + play-again) bumped up one text step for readability
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer border border-green-500 bg-black/60 px-3 py-1 text-base hover:bg-green-500 hover:text-black ${
        active ? "bg-green-600 text-black" : ""
      }`}
    >
      {`[ ${label} ]`}
    </button>
  );
}

function createHealthBar(hp: number): string {
  const segments = Math.max(0, Math.min(10, Math.floor(hp / 10)));
  return "=".repeat(segments).padEnd(10, " ");
}

function moveLabel(move: Move | null): string {
  if (!move) return "-";
  if (move === "r") return "ROCK";
  if (move === "p") return "PAPER";
  return "SCISSORS";
}

