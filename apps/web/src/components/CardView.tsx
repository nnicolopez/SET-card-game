import { type Card, type CardId, type Color, type Shape, cardFromId } from '@set/engine';
import { useId } from 'react';
import { t } from '../strings';

export const COLOR_HEX: Record<Color, string> = {
  red: '#d62f4b',
  green: '#16875a',
  purple: '#6a3fa0',
};

// Original geometric shapes in a 70×30 box (no official artwork).
const SHAPE_PATH: Record<Shape, string> = {
  oval: 'M15,1 H55 A14,14 0 0 1 55,29 H15 A14,14 0 0 1 15,1 Z',
  diamond: 'M2,15 L35,1 L68,15 L35,29 Z',
  squiggle:
    'M4,21 C2,9 13,2 24,6 C32,9 38,12 46,7 C54,2 66,3 67,11 C68,22 58,28 47,24 C39,21 33,19 25,24 C16,29 6,30 4,21 Z',
};

export function cardLabel(card: Card): string {
  return `${card.number} ${t.shape[card.shape](card.number)}, ${t.color[card.color]}, ${t.shading[card.shading]}`;
}

interface Props {
  id: CardId;
  selected: boolean;
  status?: 'hint' | 'wrong' | 'new' | undefined;
  showColorLetter: boolean;
  disabled?: boolean;
  onToggle: (id: CardId) => void;
}

export function CardView({ id, selected, status, showColorLetter, disabled, onToggle }: Props) {
  const card = cardFromId(id);
  const patternId = `stripes${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const hex = COLOR_HEX[card.color];
  const fill = card.shading === 'solid' ? hex : card.shading === 'striped' ? `url(#${patternId})` : 'none';

  const height = 30;
  const gap = 10;
  const total = card.number * height + (card.number - 1) * gap;
  const top = (150 - total) / 2;

  return (
    <button
      type="button"
      className="card"
      data-selected={selected || undefined}
      data-status={status}
      aria-pressed={selected}
      aria-label={cardLabel(card)}
      disabled={disabled}
      onClick={() => onToggle(id)}
    >
      <svg viewBox="0 0 100 150" aria-hidden="true">
        <defs>
          <pattern id={patternId} width="5" height="30" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="1.6" height="30" fill={hex} />
          </pattern>
        </defs>
        {Array.from({ length: card.number }, (_, i) => (
          <path
            key={i}
            d={SHAPE_PATH[card.shape]}
            transform={`translate(15 ${top + i * (height + gap)})`}
            fill={fill}
            stroke={hex}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
        ))}
        {showColorLetter && (
          <text x="90" y="16" textAnchor="end" className="color-letter" fill={hex}>
            {t.colorLetter[card.color]}
          </text>
        )}
      </svg>
    </button>
  );
}
