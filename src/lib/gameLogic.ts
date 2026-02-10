export type Move = 'r' | 'p' | 's';

export const MAX_HP = 100;
export const BASE_DAMAGE = 10;
export const DOUBLE_DAMAGE = 20;
export const STREAK_THRESHOLD = 3;

export type PlayerId = 'p1' | 'p2';

export interface GameState {
  p1Hp: number;
  p2Hp: number;
  p1Streak: number;
  p2Streak: number;
  p1Damage: number;
  p2Damage: number;
}

export interface RoundResult {
  winner: 0 | 1 | 2;
  message: string;
  state: GameState;
  gameOver: boolean;
  gameOverMessage?: string;
}

export function createInitialState(): GameState {
  return {
    p1Hp: MAX_HP,
    p2Hp: MAX_HP,
    p1Streak: 0,
    p2Streak: 0,
    p1Damage: BASE_DAMAGE,
    p2Damage: BASE_DAMAGE,
  };
}

export function gameRound(p1Choice: Move, p2Choice: Move): 0 | 1 | 2 {
  if (p1Choice === p2Choice) return 0;
  if (
    (p1Choice === 'r' && p2Choice === 's') ||
    (p1Choice === 's' && p2Choice === 'p') ||
    (p1Choice === 'p' && p2Choice === 'r')
  ) {
    return 1;
  }
  return 2;
}

export function applyRound(
  prevState: GameState,
  p1Choice: Move,
  p2Choice: Move
): RoundResult {
  const state: GameState = { ...prevState };

  const result = gameRound(p1Choice, p2Choice);
  let roundWinnerMsg: string;

  if (result === 1) {
    state.p2Hp -= state.p1Damage;
    if (state.p2Hp < 0) state.p2Hp = 0;
    state.p1Streak += 1;
    state.p2Streak = 0;
    roundWinnerMsg = '\nPlayer 1 wins this round!\n';
    if (state.p1Streak >= STREAK_THRESHOLD) {
      state.p1Damage = DOUBLE_DAMAGE;
      roundWinnerMsg +=
        '\nWinstreak, Double damage activated for Player 1!\n';
    }
  } else if (result === 2) {
    state.p1Hp -= state.p2Damage;
    if (state.p1Hp < 0) state.p1Hp = 0;
    state.p2Streak += 1;
    state.p1Streak = 0;
    roundWinnerMsg = '\nPlayer 2 wins this round!\n';
    if (state.p2Streak >= STREAK_THRESHOLD) {
      state.p2Damage = DOUBLE_DAMAGE;
      roundWinnerMsg +=
        '\nWinstreak, Double damage activated for Player 2!\n';
    }
  } else {
    state.p1Streak = 0;
    state.p2Streak = 0;
    state.p1Damage = BASE_DAMAGE;
    state.p2Damage = BASE_DAMAGE;
    roundWinnerMsg = '\nThis round is a draw!\n';
  }

  roundWinnerMsg += `\nPlayer 1 Streak: ${state.p1Streak}, Player 2 Streak: ${state.p2Streak}\n`;

  let gameOver = false;
  let gameOverMessage: string | undefined;

  if (state.p1Hp <= 0) {
    gameOver = true;
    gameOverMessage = 'Game over, Player 2 Wins!\n';
  } else if (state.p2Hp <= 0) {
    gameOver = true;
    gameOverMessage = 'Game over, Player 1 Wins!\n';
  }

  return {
    winner: result,
    message: roundWinnerMsg,
    state,
    gameOver,
    gameOverMessage,
  };
}

