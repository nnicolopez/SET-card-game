import { type CardId, type Triple, findAnySet, fullDeck, isSet, isValidCardId } from './cards.js';
import { mulberry32, randomSeed, shuffle } from './random.js';

/**
 * Authoritative game state. Designed to be stored as ONE DynamoDB item and updated
 * with a conditional write on `version` (read → applyCommand → put if version unchanged).
 * `deck` is secret: never send it to clients — use toPublicState().
 */
export interface GameState {
  gameId: string;
  version: number;
  status: GameStatus;
  /** Remaining cards, next card to deal first. Secret. */
  deck: CardId[];
  /** Visible cards in display order. */
  board: CardId[];
  players: Player[];
  settings: GameSettings;
  /** Events produced by the last state-changing command (for late joiners / snapshots). */
  lastEvents: GameEvent[];
  /** Outcomes of recent accepted commands, so a retried requestId isn't applied twice. */
  recentRequests: RequestRecord[];
}

export type GameStatus = 'lobby' | 'playing' | 'finished';

export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface GameSettings {
  boardSize: number;
  invalidSetPenalty: number;
  maxPlayers: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  boardSize: 12,
  invalidSetPenalty: 1,
  maxPlayers: 8,
};

const RECENT_REQUESTS_LIMIT = 64;

// ---------------------------------------------------------------------------
// Commands, events, errors
// ---------------------------------------------------------------------------

interface CommandBase {
  /** Client-generated unique id (e.g. crypto.randomUUID()). Makes retries safe. */
  requestId: string;
  playerId: string;
}

export type Command =
  | (CommandBase & { type: 'join'; name: string })
  | (CommandBase & { type: 'start' })
  | (CommandBase & { type: 'claim'; cards: CardId[] });

/** A command without its requestId, distributed over the union (plain Omit would collapse it). */
export type CommandInput = Command extends infer C ? (C extends Command ? Omit<C, 'requestId'> : never) : never;

export type GameEvent =
  | { type: 'player-joined'; playerId: string; name: string }
  | { type: 'game-started' }
  | { type: 'set-found'; playerId: string; cards: Triple; extraCardsDealt: number }
  | { type: 'set-invalid'; playerId: string; cards: Triple; penalty: number }
  | { type: 'game-finished'; winners: string[] };

export type CommandError =
  | 'UNKNOWN_PLAYER'
  | 'ALREADY_JOINED'
  | 'GAME_FULL'
  | 'INVALID_NAME'
  | 'GAME_NOT_IN_LOBBY'
  | 'GAME_NOT_PLAYING'
  | 'INVALID_SELECTION'
  /** At least one card is no longer on the board: someone else got there first. No penalty. */
  | 'CARDS_NOT_ON_BOARD';

export type CommandOutcome = { ok: true; events: GameEvent[] } | { ok: false; error: CommandError };

export type CommandResult = CommandOutcome & {
  /** New state on success; the same input object on error or duplicate (nothing to persist). */
  state: GameState;
  /** True when this requestId was already processed; nothing was applied again. */
  duplicate: boolean;
};

interface RequestRecord {
  requestId: string;
  outcome: CommandOutcome;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CreateGameOptions {
  gameId: string;
  seed?: number;
  settings?: Partial<GameSettings>;
}

export function createGame({ gameId, seed = randomSeed(), settings }: CreateGameOptions): GameState {
  return {
    gameId,
    version: 0,
    status: 'lobby',
    deck: shuffle(fullDeck(), mulberry32(seed)),
    board: [],
    players: [],
    settings: { ...DEFAULT_SETTINGS, ...settings },
    lastEvents: [],
    recentRequests: [],
  };
}

/**
 * Pure reducer: never mutates `state`. Every accepted command bumps `version` by 1.
 * Rejected commands (ok: false) leave state and version untouched but are still
 * remembered by requestId so retries are answered consistently.
 */
export function applyCommand(state: GameState, command: Command): CommandResult {
  const previous = state.recentRequests.find((r) => r.requestId === command.requestId);
  if (previous) return { ...previous.outcome, state, duplicate: true };

  const next = structuredClone(state);
  const outcome = execute(next, command);

  // Rejections change nothing, so there is nothing to persist: a retry is simply
  // evaluated again. Only accepted commands are remembered for idempotency.
  if (!outcome.ok) return { ...outcome, state, duplicate: false };

  next.version += 1;
  next.lastEvents = outcome.events;
  next.recentRequests = remember(next.recentRequests, { requestId: command.requestId, outcome });
  return { ...outcome, state: next, duplicate: false };
}

export interface PublicGameState {
  gameId: string;
  version: number;
  status: GameStatus;
  board: CardId[];
  deckCount: number;
  players: Player[];
  lastEvents: GameEvent[];
}

/** What every client may see. Strips the hidden deck order and request bookkeeping. */
export function toPublicState(state: GameState): PublicGameState {
  return {
    gameId: state.gameId,
    version: state.version,
    status: state.status,
    board: [...state.board],
    deckCount: state.deck.length,
    players: state.players.map((p) => ({ ...p })),
    lastEvents: state.lastEvents,
  };
}

export function winners(players: readonly Player[]): string[] {
  if (players.length === 0) return [];
  const best = Math.max(...players.map((p) => p.score));
  return players.filter((p) => p.score === best).map((p) => p.id);
}

// ---------------------------------------------------------------------------
// Internals (operate on a private clone)
// ---------------------------------------------------------------------------

function remember(records: RequestRecord[], record: RequestRecord): RequestRecord[] {
  return [...records, record].slice(-RECENT_REQUESTS_LIMIT);
}

function fail(error: CommandError): CommandOutcome {
  return { ok: false, error };
}

function execute(state: GameState, command: Command): CommandOutcome {
  switch (command.type) {
    case 'join':
      return join(state, command.playerId, command.name);
    case 'start':
      return start(state, command.playerId);
    case 'claim':
      return claim(state, command.playerId, command.cards);
  }
}

function join(state: GameState, playerId: string, rawName: string): CommandOutcome {
  if (state.status === 'finished') return fail('GAME_NOT_PLAYING');
  if (state.players.some((p) => p.id === playerId)) return fail('ALREADY_JOINED');
  if (state.players.length >= state.settings.maxPlayers) return fail('GAME_FULL');
  const name = rawName.trim().slice(0, 24);
  if (!name || !playerId) return fail('INVALID_NAME');

  state.players.push({ id: playerId, name, score: 0 });
  return { ok: true, events: [{ type: 'player-joined', playerId, name }] };
}

function start(state: GameState, playerId: string): CommandOutcome {
  if (!state.players.some((p) => p.id === playerId)) return fail('UNKNOWN_PLAYER');
  if (state.status !== 'lobby') return fail('GAME_NOT_IN_LOBBY');

  state.status = 'playing';
  state.board = state.deck.splice(0, state.settings.boardSize);
  const events: GameEvent[] = [{ type: 'game-started' }];
  ensurePlayable(state, events);
  return { ok: true, events };
}

function claim(state: GameState, playerId: string, cards: CardId[]): CommandOutcome {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return fail('UNKNOWN_PLAYER');
  if (state.status !== 'playing') return fail('GAME_NOT_PLAYING');
  if (!Array.isArray(cards) || cards.length !== 3 || !cards.every(isValidCardId) || new Set(cards).size !== 3) {
    return fail('INVALID_SELECTION');
  }
  // Checked against the cards, not against a client-sent version: an unrelated change
  // (e.g. someone else's wrong claim changing scores) must not invalidate a good claim.
  if (!cards.every((c) => state.board.includes(c))) return fail('CARDS_NOT_ON_BOARD');

  const triple = [cards[0]!, cards[1]!, cards[2]!] as const;
  if (!isSet(...triple)) {
    const penalty = state.settings.invalidSetPenalty;
    player.score -= penalty;
    return { ok: true, events: [{ type: 'set-invalid', playerId, cards: triple, penalty }] };
  }

  player.score += 1;
  removeAndReplenish(state, triple);
  const events: GameEvent[] = [];
  const extra = ensurePlayable(state, events);
  events.unshift({ type: 'set-found', playerId, cards: triple, extraCardsDealt: extra });
  return { ok: true, events };
}

/**
 * Official rule: after a SET, refill to the board size only if the board dropped
 * below it. New cards take the freed positions so the layout doesn't jump.
 */
function removeAndReplenish(state: GameState, cards: Triple): void {
  const { boardSize } = state.settings;
  const refill = state.board.length - cards.length < boardSize && state.deck.length > 0;
  if (refill) {
    state.board = state.board.map((id) => (cards.includes(id) ? (state.deck.shift() ?? -1) : id));
    state.board = state.board.filter((id) => id !== -1);
  } else {
    state.board = state.board.filter((id) => !cards.includes(id));
  }
}

/**
 * The server, not a player vote, decides there is no SET: deal 3 more until one
 * exists. If the deck is empty and no SET remains, the game ends.
 * Returns how many extra cards were dealt.
 */
function ensurePlayable(state: GameState, events: GameEvent[]): number {
  let dealt = 0;
  while (!findAnySet(state.board) && state.deck.length > 0) {
    const extra = state.deck.splice(0, 3);
    state.board.push(...extra);
    dealt += extra.length;
  }
  if (!findAnySet(state.board)) {
    state.status = 'finished';
    events.push({ type: 'game-finished', winners: winners(state.players) });
  }
  return dealt;
}
