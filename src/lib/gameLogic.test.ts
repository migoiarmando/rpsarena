import {
  applyRound,
  createInitialState,
  gameRound,
  MAX_HP,
  BASE_DAMAGE,
  DOUBLE_DAMAGE,
  STREAK_THRESHOLD,
} from './gameLogic';

// Basic unit tests for the core game logic.
// This uses simple assertions so we don't depend on a specific test runner yet.

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

export function runGameLogicTests() {
  // gameRound correctness
  assert(gameRound('r', 's') === 1, 'Rock should beat Scissors (p1)');
  assert(gameRound('s', 'p') === 1, 'Scissors should beat Paper (p1)');
  assert(gameRound('p', 'r') === 1, 'Paper should beat Rock (p1)');
  assert(gameRound('s', 'r') === 2, 'Rock should beat Scissors (p2)');
  assert(gameRound('p', 's') === 2, 'Scissors should beat Paper (p2)');
  assert(gameRound('r', 'p') === 2, 'Paper should beat Rock (p2)');
  assert(gameRound('r', 'r') === 0, 'Rock vs Rock should be draw');

  // Initial state
  const initial = createInitialState();
  assert(initial.p1Hp === MAX_HP && initial.p2Hp === MAX_HP, 'HP should start at MAX_HP');
  assert(initial.p1Damage === BASE_DAMAGE && initial.p2Damage === BASE_DAMAGE, 'Damage should start at BASE_DAMAGE');

  // Single round win updates HP and streaks correctly
  let state = createInitialState();
  let result = applyRound(state, 'r', 's');
  assert(result.state.p2Hp === MAX_HP - BASE_DAMAGE, 'Player 2 HP should decrease by BASE_DAMAGE');
  assert(result.state.p1Streak === 1 && result.state.p2Streak === 0, 'Player 1 streak should increment');

  // Streak triggers double damage
  state = createInitialState();
  let current = state;
  for (let i = 0; i < STREAK_THRESHOLD; i++) {
    const r = applyRound(current, 'r', 's');
    current = r.state;
  }
  assert(
    current.p1Damage === DOUBLE_DAMAGE,
    'Player 1 damage should become DOUBLE_DAMAGE after reaching streak threshold'
  );

  // Draw resets streaks and damage
  state = {
    ...createInitialState(),
    p1Streak: 2,
    p2Streak: 1,
    p1Damage: DOUBLE_DAMAGE,
    p2Damage: DOUBLE_DAMAGE,
  };
  result = applyRound(state, 'r', 'r');
  assert(
    result.state.p1Streak === 0 &&
      result.state.p2Streak === 0 &&
      result.state.p1Damage === BASE_DAMAGE &&
      result.state.p2Damage === BASE_DAMAGE,
    'Draw should reset streaks and damage to base'
  );

  // Game over messages
  state = {
    ...createInitialState(),
    p2Hp: 5,
  };
  result = applyRound(state, 'r', 's');
  assert(result.gameOver, 'Game should be over when HP <= 0');
  assert(result.gameOverMessage === 'Game over, Player 2 Wins!\\n', 'Game over message should match C server behavior when p2 HP <= 0');

  state = {
    ...createInitialState(),
    p1Hp: 5,
  };
  result = applyRound(state, 's', 'r');
  assert(result.gameOver, 'Game should be over when HP <= 0 (p1)');
  assert(result.gameOverMessage === 'Game over, Player 1 Wins!\\n', 'Game over message should match C server behavior when p1 HP <= 0');
}

