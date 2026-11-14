import { describe, expect, it } from 'vitest';
import {
  DECK_SIZE,
  cardFromId,
  cardToId,
  findAnySet,
  findSets,
  fullDeck,
  isSet,
  thirdCard,
} from '../src/index.js';

const id = (n: 1 | 2 | 3, shape: string, color: string, shading: string) =>
  cardToId({ number: n, shape, color, shading } as Parameters<typeof cardToId>[0]);

describe('deck', () => {
  it('has 81 unique attribute combinations', () => {
    const keys = new Set(
      fullDeck().map((i) => {
        const c = cardFromId(i);
        return `${c.number}-${c.shape}-${c.color}-${c.shading}`;
      }),
    );
    expect(keys.size).toBe(DECK_SIZE);
  });

  it('round-trips ids', () => {
    for (const i of fullDeck()) expect(cardToId(cardFromId(i))).toBe(i);
  });

  it('rejects invalid ids', () => {
    expect(() => cardFromId(81)).toThrow(RangeError);
    expect(() => cardFromId(-1)).toThrow(RangeError);
    expect(() => cardFromId(1.5)).toThrow(RangeError);
  });
});

describe('isSet', () => {
  it('accepts the rules example: same shape and shading, number and color all different', () => {
    expect(
      isSet(id(1, 'oval', 'red', 'outlined'), id(2, 'oval', 'green', 'outlined'), id(3, 'oval', 'purple', 'outlined')),
    ).toBe(true);
  });

  it('accepts all four attributes different', () => {
    expect(
      isSet(id(1, 'oval', 'red', 'solid'), id(2, 'diamond', 'green', 'striped'), id(3, 'squiggle', 'purple', 'outlined')),
    ).toBe(true);
  });

  it('rejects two-and-one on any attribute', () => {
    expect(
      isSet(id(1, 'oval', 'red', 'solid'), id(2, 'oval', 'green', 'solid'), id(3, 'oval', 'green', 'solid')),
    ).toBe(false);
  });

  it('rejects repeated cards', () => {
    expect(isSet(5, 5, 10)).toBe(false);
  });

  it('agrees with a brute-force definition on every triple', () => {
    const attrs = (i: number) => {
      const c = cardFromId(i);
      return [c.number, c.shape, c.color, c.shading] as const;
    };
    let count = 0;
    for (let a = 0; a < DECK_SIZE; a++)
      for (let b = a + 1; b < DECK_SIZE; b++)
        for (let c = b + 1; c < DECK_SIZE; c++) {
          const [x, y, z] = [attrs(a), attrs(b), attrs(c)];
          const expected = x.every((_, k) => new Set([x[k], y[k], z[k]]).size !== 2);
          expect(isSet(a, b, c)).toBe(expected);
          if (expected) count++;
        }
    expect(count).toBe(1080); // known number of SETs in the full deck
  });
});

describe('thirdCard', () => {
  it('completes a SET for every pair', () => {
    for (let a = 0; a < DECK_SIZE; a++)
      for (let b = a + 1; b < DECK_SIZE; b++) {
        const c = thirdCard(a, b);
        expect(c).not.toBe(a);
        expect(c).not.toBe(b);
        expect(isSet(a, b, c)).toBe(true);
      }
  });
});

describe('findSets', () => {
  it('finds each SET once', () => {
    expect(findSets(fullDeck())).toHaveLength(1080);
  });

  it('returns null / [] for a board without SETs', () => {
    // A known 20-card cap set would be overkill; 4 cards with no SET is enough.
    const board = [0, 1, 3, 4]; // pairwise thirds are 2, 6/8, ... none present
    expect(findSets(board)).toEqual([]);
    expect(findAnySet(board)).toBeNull();
  });

  it('findAnySet returns a valid SET when one exists', () => {
    const board = [0, 1, 3, 4, 2];
    const found = findAnySet(board);
    expect(found).not.toBeNull();
    expect(isSet(...found!)).toBe(true);
  });
});
