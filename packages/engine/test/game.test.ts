import { describe, expect, it } from 'vitest';
import {
  type Command,
  type CommandInput,
  type GameState,
  applyCommand,
  createGame,
  findAnySet,
  findSets,
  isSet,
  mulberry32,
  toPublicState,
} from '../src/index.js';

let counter = 0;
const rid = () => `req-${++counter}`;

function apply(state: GameState, command: CommandInput) {
  return applyCommand(state, { requestId: rid(), ...command });
}

function startedGame(seed = 42, players = ['ana', 'beto']): GameState {
  let state = createGame({ gameId: 'g1', seed });
  for (const p of players) state = apply(state, { type: 'join', playerId: p, name: p }).state;
  return apply(state, { type: 'start', playerId: players[0]! }).state;
}

function nonSet(board: number[]): [number, number, number] {
  for (let i = 0; i < board.length; i++)
    for (let j = i + 1; j < board.length; j++)
      for (let k = j + 1; k < board.length; k++)
        if (!isSet(board[i]!, board[j]!, board[k]!)) return [board[i]!, board[j]!, board[k]!];
  throw new Error('no non-set triple');
}

describe('lobby', () => {
  it('starts in lobby with a full shuffled deck and nothing visible', () => {
    const g = createGame({ gameId: 'g', seed: 1 });
    expect(g.status).toBe('lobby');
    expect(g.deck).toHaveLength(81);
    expect(new Set(g.deck).size).toBe(81);
    expect(g.board).toEqual([]);
  });

  it('is deterministic for a given seed', () => {
    expect(createGame({ gameId: 'a', seed: 7 }).deck).toEqual(createGame({ gameId: 'b', seed: 7 }).deck);
    expect(createGame({ gameId: 'a', seed: 7 }).deck).not.toEqual(createGame({ gameId: 'a', seed: 8 }).deck);
  });

  it('joins players and rejects duplicates, empty names and overflow', () => {
    let g = createGame({ gameId: 'g', seed: 1, settings: { maxPlayers: 2 } });
    g = apply(g, { type: 'join', playerId: 'a', name: '  Ana  ' }).state;
    expect(g.players).toEqual([{ id: 'a', name: 'Ana', score: 0 }]);
    expect(apply(g, { type: 'join', playerId: 'a', name: 'Ana' })).toMatchObject({ ok: false, error: 'ALREADY_JOINED' });
    expect(apply(g, { type: 'join', playerId: 'b', name: '   ' })).toMatchObject({ ok: false, error: 'INVALID_NAME' });
    g = apply(g, { type: 'join', playerId: 'b', name: 'Beto' }).state;
    expect(apply(g, { type: 'join', playerId: 'c', name: 'Caro' })).toMatchObject({ ok: false, error: 'GAME_FULL' });
  });

  it('only a joined player can start, and only once', () => {
    let g = createGame({ gameId: 'g', seed: 1 });
    expect(apply(g, { type: 'start', playerId: 'x' })).toMatchObject({ ok: false, error: 'UNKNOWN_PLAYER' });
    g = apply(g, { type: 'join', playerId: 'a', name: 'Ana' }).state;
    g = apply(g, { type: 'start', playerId: 'a' }).state;
    expect(g.status).toBe('playing');
    expect(apply(g, { type: 'start', playerId: 'a' })).toMatchObject({ ok: false, error: 'GAME_NOT_IN_LOBBY' });
  });

  it('deals at least 12 cards and guarantees a SET on the board', () => {
    for (let seed = 0; seed < 50; seed++) {
      const g = startedGame(seed);
      expect(g.board.length).toBeGreaterThanOrEqual(12);
      expect(g.board.length % 3).toBe(0);
      expect(findAnySet(g.board)).not.toBeNull();
      expect(g.deck.length + g.board.length).toBe(81);
    }
  });
});

describe('claims', () => {
  it('a valid SET scores, keeps positions stable and refills to 12', () => {
    const g = startedGame();
    const set = findAnySet(g.board)!;
    const positions = set.map((c) => g.board.indexOf(c));
    const r = apply(g, { type: 'claim', playerId: 'ana', cards: [...set] });

    expect(r.ok).toBe(true);
    expect(r.state.version).toBe(g.version + 1);
    expect(r.state.players.find((p) => p.id === 'ana')!.score).toBe(1);
    expect(r.state.board.some((c) => set.includes(c))).toBe(false);
    expect(r.state.board.length).toBeGreaterThanOrEqual(12);
    // Untouched cards keep their positions.
    g.board.forEach((c, i) => {
      if (!positions.includes(i) && i < 12) expect(r.state.board[i]).toBe(c);
    });
    expect(r.ok && r.events[0]).toMatchObject({ type: 'set-found', playerId: 'ana' });
  });

  it('an invalid SET costs a point and leaves the board as is', () => {
    const g = startedGame();
    const wrong = nonSet(g.board);
    const r = apply(g, { type: 'claim', playerId: 'beto', cards: wrong });
    expect(r).toMatchObject({ ok: true, events: [{ type: 'set-invalid', playerId: 'beto', penalty: 1 }] });
    expect(r.state.players.find((p) => p.id === 'beto')!.score).toBe(-1);
    expect(r.state.board).toEqual(g.board);
  });

  it('when two players claim the same SET, the second gets CARDS_NOT_ON_BOARD and no penalty', () => {
    const g = startedGame();
    const set = [...findAnySet(g.board)!];
    const first = apply(g, { type: 'claim', playerId: 'ana', cards: set });
    const second = apply(first.state, { type: 'claim', playerId: 'beto', cards: set });
    expect(second).toMatchObject({ ok: false, error: 'CARDS_NOT_ON_BOARD' });
    expect(second.state).toBe(first.state);
    expect(second.state.players.find((p) => p.id === 'beto')!.score).toBe(0);
  });

  it('an unrelated change does not invalidate a still-valid claim', () => {
    const g = startedGame();
    const set = [...findAnySet(g.board)!];
    const afterMistake = apply(g, { type: 'claim', playerId: 'beto', cards: nonSet(g.board) }).state;
    expect(apply(afterMistake, { type: 'claim', playerId: 'ana', cards: set }).ok).toBe(true);
  });

  it('rejects malformed selections without changing state', () => {
    const g = startedGame();
    const [a, b] = g.board as [number, number];
    for (const cards of [[a, b], [a, a, b], [a, b, 99], [a, b, 1.5]]) {
      const r = apply(g, { type: 'claim', playerId: 'ana', cards });
      expect(r).toMatchObject({ ok: false, error: 'INVALID_SELECTION' });
      expect(r.state).toBe(g);
    }
    expect(apply(g, { type: 'claim', playerId: 'nadie', cards: [...findAnySet(g.board)!] })).toMatchObject({
      ok: false,
      error: 'UNKNOWN_PLAYER',
    });
  });

  it('a retried requestId is not applied twice', () => {
    const g = startedGame();
    const cmd: Command = { requestId: 'same', type: 'claim', playerId: 'ana', cards: [...findAnySet(g.board)!] };
    const first = applyCommand(g, cmd);
    const retry = applyCommand(first.state, cmd);
    expect(retry.duplicate).toBe(true);
    expect(retry.ok).toBe(true);
    expect(retry.state).toBe(first.state);
    expect(retry.state.players.find((p) => p.id === 'ana')!.score).toBe(1);
  });

  it('never mutates the input state', () => {
    const g = startedGame();
    const snapshot = structuredClone(g);
    apply(g, { type: 'claim', playerId: 'ana', cards: [...findAnySet(g.board)!] });
    apply(g, { type: 'claim', playerId: 'ana', cards: nonSet(g.board) });
    expect(g).toEqual(snapshot);
  });
});

describe('full games', () => {
  it('play to the end: deck exhausted, no SET left, consistent bookkeeping', () => {
    for (let seed = 0; seed < 200; seed++) {
      const random = mulberry32(seed + 1000);
      let g = startedGame(seed, ['a', 'b', 'c']);
      let found = 0;
      let guard = 0;
      while (g.status === 'playing') {
        if (++guard > 200) throw new Error('game did not finish');
        const sets = findSets(g.board);
        expect(sets.length).toBeGreaterThan(0);
        const set = sets[Math.floor(random() * sets.length)]!;
        const player = ['a', 'b', 'c'][Math.floor(random() * 3)]!;
        const r = apply(g, { type: 'claim', playerId: player, cards: [...set] });
        expect(r.ok).toBe(true);
        g = r.state;
        found++;
        // Card conservation: board + deck + removed = 81, no duplicates.
        expect(new Set([...g.board, ...g.deck]).size).toBe(g.board.length + g.deck.length);
        expect(g.board.length + g.deck.length + found * 3).toBe(81);
      }
      expect(g.deck).toEqual([]);
      expect(findAnySet(g.board)).toBeNull();
      expect(g.players.reduce((s, p) => s + p.score, 0)).toBe(found);
      const finished = g.lastEvents.find((e) => e.type === 'game-finished');
      expect(finished).toBeDefined();
      expect(apply(g, { type: 'claim', playerId: 'a', cards: g.board.slice(0, 3) })).toMatchObject({
        ok: false,
        error: 'GAME_NOT_PLAYING',
      });
    }
  });
});

describe('toPublicState', () => {
  it('hides the deck order and request history', () => {
    const g = startedGame();
    const pub = toPublicState(g);
    expect(pub).not.toHaveProperty('deck');
    expect(pub).not.toHaveProperty('recentRequests');
    expect(pub.deckCount).toBe(g.deck.length);
    expect(JSON.stringify(pub)).not.toContain(JSON.stringify(g.deck));
  });
});
