/**
 * Cards are encoded as integers 0..80. Each base-3 digit is one attribute:
 *   digit 0 → number, digit 1 → shape, digit 2 → color, digit 3 → shading.
 * This keeps state compact (a board is just number[]) and makes the SET rule
 * arithmetic: three values are "all same or all different" ⇔ their sum ≡ 0 (mod 3).
 */

export const NUMBERS = [1, 2, 3] as const;
export const SHAPES = ['oval', 'diamond', 'squiggle'] as const;
export const COLORS = ['red', 'green', 'purple'] as const;
export const SHADINGS = ['solid', 'striped', 'outlined'] as const;

export type CardNumber = (typeof NUMBERS)[number];
export type Shape = (typeof SHAPES)[number];
export type Color = (typeof COLORS)[number];
export type Shading = (typeof SHADINGS)[number];

export type CardId = number;
export type Triple = readonly [CardId, CardId, CardId];

export interface Card {
  id: CardId;
  number: CardNumber;
  shape: Shape;
  color: Color;
  shading: Shading;
}

export const DECK_SIZE = 81;
const ATTRIBUTES = 4;

export function isValidCardId(id: unknown): id is CardId {
  return typeof id === 'number' && Number.isInteger(id) && id >= 0 && id < DECK_SIZE;
}

function digit(id: CardId, position: number): number {
  return Math.floor(id / 3 ** position) % 3;
}

function assertCardId(id: CardId): void {
  if (!isValidCardId(id)) throw new RangeError(`Invalid card id: ${String(id)}`);
}

export function cardFromId(id: CardId): Card {
  assertCardId(id);
  return {
    id,
    number: NUMBERS[digit(id, 0)]!,
    shape: SHAPES[digit(id, 1)]!,
    color: COLORS[digit(id, 2)]!,
    shading: SHADINGS[digit(id, 3)]!,
  };
}

export function cardToId(card: Omit<Card, 'id'>): CardId {
  return (
    NUMBERS.indexOf(card.number) +
    SHAPES.indexOf(card.shape) * 3 +
    COLORS.indexOf(card.color) * 9 +
    SHADINGS.indexOf(card.shading) * 27
  );
}

export function fullDeck(): CardId[] {
  return Array.from({ length: DECK_SIZE }, (_, i) => i);
}

/** True when the three cards are distinct and every attribute is all-same or all-different. */
export function isSet(a: CardId, b: CardId, c: CardId): boolean {
  assertCardId(a);
  assertCardId(b);
  assertCardId(c);
  if (a === b || b === c || a === c) return false;
  for (let p = 0; p < ATTRIBUTES; p++) {
    if ((digit(a, p) + digit(b, p) + digit(c, p)) % 3 !== 0) return false;
  }
  return true;
}

/** Any two distinct cards determine exactly one card that completes a SET. */
export function thirdCard(a: CardId, b: CardId): CardId {
  assertCardId(a);
  assertCardId(b);
  if (a === b) throw new RangeError('thirdCard needs two different cards');
  let id = 0;
  for (let p = 0; p < ATTRIBUTES; p++) {
    id += ((6 - digit(a, p) - digit(b, p)) % 3) * 3 ** p;
  }
  return id;
}

/** All SETs on a board, each as ids sorted by board position. O(n²). */
export function findSets(board: readonly CardId[]): Triple[] {
  const position = new Map<CardId, number>();
  board.forEach((id, i) => position.set(id, i));
  const sets: Triple[] = [];
  for (let i = 0; i < board.length; i++) {
    for (let j = i + 1; j < board.length; j++) {
      const k = position.get(thirdCard(board[i]!, board[j]!));
      if (k !== undefined && k > j) sets.push([board[i]!, board[j]!, board[k]!]);
    }
  }
  return sets;
}

export function findAnySet(board: readonly CardId[]): Triple | null {
  const position = new Set(board);
  for (let i = 0; i < board.length; i++) {
    for (let j = i + 1; j < board.length; j++) {
      const third = thirdCard(board[i]!, board[j]!);
      if (position.has(third)) return [board[i]!, board[j]!, third];
    }
  }
  return null;
}
