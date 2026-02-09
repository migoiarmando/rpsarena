"use client";

import { useEffect, useMemo, useState } from "react";
import { createInitialState, GameState, Move } from "@/lib/gameLogic";
import { createSocketClient, GameSocket } from "@/lib/socket";

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
 .----------------.  .----------------.  .----------------.                    .----------------.  .----------------.  .----------------.  .-----------------. .----------------. 
| .--------------. || .--------------. || .--------------. |                  | .--------------. || .--------------. || .--------------. || .--------------. || .--------------. |
| |  _______     | || |   ______     | || |    _______   | |                  | |      __      | || |  _______     | || |  _________   | || | ____  _____  | || |      __      | |
| | |_   __ \    | || |  |_   __ \   | || |   /  ___  |  | |                  | |     /  \     | || | |_   __ \    | || | |_   ___  |  | || ||_   \|_   _| | || |     /  \     | |
| |   | |__) |   | || |    | |__) |  | || |  |  (__ \_|  | |                  | |    / /\ \    | || |   | |__) |   | || |   | |_  \_|  | || |  |   \ | |   | || |    / /\ \    | |
| |   |  __ /    | || |    |  ___/   | || |   '.___\`-.   | |                  | |   / ____ \   | || |   |  __ /    | || |   |  _|  _   | || |  | |\ \| |   | || |   / ____ \   | |
| |  _| |  \ \_  | || |   _| |_      | || |  |\`\____) |  | |                  | | _/ /    \ \_ | || |  _| |  \ \_  | || |  _| |___/ |  | || | _| |_\   |_  | || | _/ /    \ \_ | |
| | |____| |___| | || |  |_____|     | || |  |_______.'  | |                  | ||____|  |____|| || | |____| |___| | || | |_________|  | || ||_____\____| | || ||____|  |____|| |
| |              | || |              | || |              | |                  | |              | || |              | || |              | || |              | || |              | |
| '--------------' || '--------------' || '--------------' |                  | '--------------' || '--------------' || '--------------' || '--------------' || '--------------' |
 '----------------'  '----------------'  '----------------'                    '----------------'  '----------------'  '----------------'  '----------------'  '----------------' 
                                                                                 ..   .:+*+:..              
                                                                               .*%##-..%:.:#-........       
                                                                             ..%:..+*.=%. .*=..*#+#*..      
                                                                              :%. .=#:+#. .*-.:%:..*-.      
               .....                                                          .%.  :%:**. .#-.*+. .%:       
       ..:=*###%#++*@=:....                                                   .%=. .%:**...#-.%:..+*.+*=..  
       .%=....%.   .=::=##-..                                                  +#. .*=#*  :#:+#..:#+%-.-*:. 
       -%.    +.   .=:.  .%=...                                        ......  .%. .+##*. :#:%-..+#%-..=*.  
       -%.    =-   .-:   .*###*-..                                   ..-%##*=...%-  :%#*..:#=%..:#@=..-%:.  
     ..-%...::++:.. -:  ..+:..-%-.                                    .**...=%:.+*...=*=. .*%*..=@*:..%=.   
     .:*#===-...-+-.=:  .--. .=%-.                                     .**. .+*:%.        .....*%-..+*.    
     .%-....     .:=%.  .+-...=%-.                                      .#+..:%=%..            .. .-%.     
    .=%..        ....-*.-=.  .##:.                                       :#-..-#%-:=:..           ..%-.     
    .+*.  ..:=-......+*+=+=..=**..                                       .=*.. .....:=*..         .+#.      
    .*+.  ..:..:-=--:......::.-*.          ...                           ..*=.      ...-+.        -%:       
    .*+.   .. .. .. .        .-*..        .+%#=..   ..::...             ..=%:.       ..=:.      :#=.       
     .*%-..                 ..#+.       ..%-...+*. .:*+::-#+.           ..=%:        ...      .++..       
       .-%#-..            ..=@-.         .%:  .-#. .=*:.  =*.              :%-.             ..+*.         
         ..:*@%+=-:....-=#@*:.           .%-   -%:..++.. .*+.               .+@=.............#+.          
              ....-==--....              .#=.  :%:.:#-.  .%:.                 .:+%#%%%%%%%%+..           
                                         .**.  :#:.=*.  .=#.                                        
                                          =%.  .#-.*=.  .%=.                                        
                                          :%.  .*:%:. .:@.                                         
                                          .%:  .+#**.. .**.                                         
                                          .%-   ..:.. .-##*-.                                        
                                          .#=.       .=-..:**..                                      
                                         .-%. ....  .-=.. .+=**.                                     
                                         :%*==----+=:=:. .-+..#-                                     
                                        .*+..     ..:=+-..*..:#:                                     
                                        .#-. .....   .:+.*:..*=.                                     
                                        .#- .=*--**==*=.-#:.+*..                                     
                                        .*+...   .       ..-#-.                                      
                                        .:@:..           ..*+.                                       
                                          -%=..........:-*%=..                                        
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
  const [playAgainChoice, setPlayAgainChoice] = useState<"yes" | "no" | null>(
    null,
  );
  const [playAgainTimer, setPlayAgainTimer] = useState(15);
  const [socket, setSocket] = useState<GameSocket | null>(null);

  // We keep a copy of the current room's players so that we can
  // infer the opponent's move when we receive state updates.
  const [roomPlayers, setRoomPlayers] = useState<string[]>([]);

  // Whenever the player name changes, (re)establish a Socket.IO
  // connection to the backend and wire up listeners.
  useEffect(() => {
    // Do nothing until the player has chosen a name so that
    // we can identify them to the backend.
    if (!playerName) return;

    // Create a new client connection.
    const s = createSocketClient();
    setSocket(s);

    // Identify this client to the server so it can tag events
    // and use the name as a stable player id.
    s.emit("identify", { playerName });

    // Request initial room list for the lobby.
    s.emit("listRooms");

    // Room list + updates keep the lobby in sync.
    s.on("roomList", (payload: { rooms: RoomSummary[] }) => {
      setRooms(payload.rooms ?? []);
    });
    s.on("roomUpdate", (payload: { room: RoomSummary }) => {
      setRooms((prev) => {
        const others = prev.filter((r) => r.id !== payload.room.id);
        return [...others, payload.room];
      });
      if (payload.room.id === currentRoomId) {
        setRoomPlayers(payload.room.players);
      }
    });

    // When we successfully join a room, move into IN_GAME and
    // reset local round state.
    s.on(
      "joinSuccess",
      (payload: { roomId: string; room: RoomSummary & { gameState?: GameState } }) => {
        setCurrentRoomId(payload.roomId);
        setRoomPlayers(payload.room.players);
        setRoundView({
          lastMessage: "",
          state: payload.room.gameState ?? createInitialState(),
        });
        setMyMove(null);
        setOpponentMove(null);
        setAppState("IN_GAME");
      },
    );

    // Game state updates after each resolved round.
    s.on(
      "stateUpdate",
      (payload: {
        roomId: string;
        state: GameState;
        roundMessage: string;
        gameOver: boolean;
      }) => {
        if (payload.roomId !== currentRoomId) return;

        setRoundView({
          lastMessage: payload.roundMessage ?? "",
          state: payload.state,
        });

        // For now, we simply clear last round's moves; if you want
        // to show exact moves per player, you can extend the payload
        // to include them explicitly.
        setMyMove(null);
        setOpponentMove(null);

        if (payload.gameOver) {
          setAppState("PLAY_AGAIN");
          setPlayAgainChoice(null);
          setPlayAgainTimer(15);
        }
      },
    );

    // Play-again coordination events.
    s.on(
      "playAgainUpdate",
      (payload: { roomId: string; status: "waiting" | "rematch" | "ended" }) => {
        if (payload.roomId !== currentRoomId) return;

        if (payload.status === "rematch") {
          setRoundView({
            lastMessage: "",
            state: createInitialState(),
          });
          setMyMove(null);
          setOpponentMove(null);
          setAppState("IN_GAME");
          setPlayAgainTimer(15);
          setPlayAgainChoice(null);
        } else if (payload.status === "ended") {
          setAppState("LOBBY");
          setCurrentRoomId(null);
          setRoomPlayers([]);
          // Refresh lobby room list.
          s.emit("listRooms");
        }
      },
    );

    // Surface backend errors in the console for now; you can
    // later show these in a toast or status area in the UI.
    s.on("error", (payload: { message: string }) => {
      // eslint-disable-next-line no-console
      console.error("Socket error:", payload.message);
    });

    // Clean up when the component unmounts or playerName changes.
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [playerName, currentRoomId]);

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
    setAppState("LOBBY");
  }

  // Create or join a room using Socket.IO events instead of HTTP.
  function handleCreateOrJoinRoom(roomId: string) {
    if (!playerName || !socket) return;
    const exists = rooms.find((r) => r.id === roomId);
    if (exists) {
      socket.emit("joinRoom", { roomId, playerName });
    } else {
      socket.emit("createRoom", { roomId, playerName });
    }
  }

  // Submit a local move via Socket.IO; the backend will resolve
  // the round once both players have submitted.
  function handleLocalMove(move: Move) {
    if (!currentRoomId || !playerName || !socket) return;
    setMyMove(move);
    socket.emit("makeMove", { roomId: currentRoomId, playerName, move });
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
    if (!currentRoomId || !playerName || !socket) return;
    socket.emit("playAgainChoice", {
      roomId: currentRoomId,
      playerName,
      choice,
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-green-400 px-4 py-6">
      {/* Outer terminal container: slightly wider and taller for better readability */}
      <div className="w-full max-w-6xl border border-green-500 bg-black/90 shadow-lg">
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

        {/* Main content area: let height be driven by content so we avoid an inner scrollbar */}
        <div className="px-8 py-6 font-mono text-3xl leading-relaxed">
          {appState === "WELCOME" && (
            <WelcomeScreen onStart={() => setAppState("ENTER_NAME")} />
          )}
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

interface WelcomeScreenProps {
  onStart: () => void;
}

function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <div>
      <pre className="whitespace-pre text-[14px] leading-[14px]">
        {WELCOME_ART}
      </pre>
      {/* Button to proceed from the ASCII welcome screen to the name entry step */}
      <div className="mt-4 flex justify-center">
        <button
          className="border border-green-500 px-6 py-2 text-2xl leading-none hover:bg-green-500 hover:text-black"
          onClick={onStart}
        >
          [ PLAY GAME ]
        </button>
      </div>
    </div>
  );
}

interface NameScreenProps {
  tempName: string;
  onTempNameChange: (value: string) => void;
  onConfirm: () => void;
}

function NameScreen({
  tempName,
  onTempNameChange,
  onConfirm,
}: NameScreenProps) {
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
          className="ml-4 border border-green-500 px-6 py-2 text-2xl leading-none hover:bg-green-500 hover:text-black"
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
      <p className="mt-1 text-3xl">Lobby - available rooms:</p>
      <div className="mt-2">
        {rooms.length === 0 && (
          <p className="text-2xl">No rooms yet. Create one to start.</p>
        )}
        {rooms.map((room) => (
          <div
            key={room.id}
            className="mt-1 flex items-center justify-between border border-green-700 bg-black/60 px-2 py-1"
          >
            <span className="text-2xl">
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
          className="border border-green-500 px-5 py-2 text-2xl hover:bg-green-500 hover:text-black"
          onClick={() =>
            onCreateOrJoin(`room-${Math.floor(Math.random() * 1000)}`)
          }
        >
          [ CREATE RANDOM ROOM ]
        </button>
      </div>
      <p className="mt-4 text-2xl text-green-500">
        (Rooms are stored in-memory on the Socket.IO game server; lobby and
        game state update in real time.)
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
      <p>{`Room: ${roomId ?? "N/A"} | You are: ${playerName}`}</p>
      <p className="mt-2">Health:</p>
      <pre className="mt-1 text-2xl">
        {`Your HP:      [${healthBars.p1}] (${healthBars.p1Hp})
Opponent HP: [${healthBars.p2}] (${healthBars.p2Hp})`}
      </pre>

      <div className="mt-3">
        <p className="text-2xl">
          Enter your choice (Rock [r], Paper [p], Scissors [s]):
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <AsciiButton label="ROCK" onClick={() => onMove("r")} />
          <AsciiButton label="PAPER" onClick={() => onMove("p")} />
          <AsciiButton label="SCISSORS" onClick={() => onMove("s")} />
        </div>
        <p className="mt-2 text-xl text-green-500">
          You can also press r / p / s on your keyboard (to be wired with real
          networking).
        </p>
      </div>

      <div className="mt-3 text-xl">
        <p>{`Last move: you -> ${moveLabel(myMove)}, opponent -> ${moveLabel(
          opponentMove,
        )}`}</p>
      </div>

      {roundView.lastMessage && (
        <pre className="mt-3 whitespace-pre-wrap text-2xl">
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
      <p className="text-2xl">Game over.</p>
      <p className="mt-1 text-2xl">Play again? Timer: {timer}s</p>
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
      <p className="mt-2 text-lg text-green-500">
        In the full version, a rematch will only start if both players agree
        before the timer runs out; otherwise you&apos;ll return to the lobby.
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
      className={`cursor-pointer border border-green-500 bg-black/60 px-5 py-2 text-xl hover:bg-green-500 hover:text-black ${
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
