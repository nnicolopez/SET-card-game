import { type FormEvent, useState } from 'react';
import { t } from '../strings';
import { CardView } from './CardView';

const STORAGE_KEY = 'set.players';
const MAX_LOCAL_PLAYERS = 4;

function loadNames(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((n) => typeof n === 'string')) {
      return parsed.slice(0, MAX_LOCAL_PLAYERS);
    }
  } catch {
    // Storage can be unavailable (private mode, sandboxed iframes); fall back to defaults.
  }
  return [''];
}

function saveNames(names: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
  } catch {
    // Non-essential convenience.
  }
}

// A sample SET for the intro: 1 red outlined oval, 2 green outlined ovals, 3 purple outlined ovals.
const EXAMPLE = [54, 64, 74];

export function Lobby({ onStart }: { onStart: (names: string[]) => void }) {
  const [names, setNames] = useState<string[]>(loadNames);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const final = names.map((n, i) => n.trim() || t.playerPlaceholder(i + 1));
    saveNames(names.map((n) => n.trim()));
    onStart(final);
  };

  return (
    <main className="lobby">
      <header className="lobby-header">
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </header>

      <div className="example" aria-hidden="true">
        {EXAMPLE.map((id) => (
          <CardView key={id} id={id} selected={false} showColorLetter={false} disabled onToggle={() => {}} />
        ))}
      </div>
      <p className="rules">{t.rules}</p>

      <form onSubmit={submit} className="players-form">
        <fieldset>
          <legend>{t.playersLabel}</legend>
          {names.map((name, i) => (
            <div className="player-row" key={i}>
              <input
                value={name}
                maxLength={24}
                placeholder={t.playerPlaceholder(i + 1)}
                aria-label={t.playerPlaceholder(i + 1)}
                onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))}
              />
              {names.length > 1 && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t.removePlayer(name || t.playerPlaceholder(i + 1))}
                  onClick={() => setNames(names.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {names.length < MAX_LOCAL_PLAYERS && (
            <button type="button" className="link-button" onClick={() => setNames([...names, ''])}>
              + {t.addPlayer}
            </button>
          )}
        </fieldset>
        <button type="submit" className="primary">
          {t.start}
        </button>
        <p className="note">{t.localNote}</p>
      </form>
    </main>
  );
}
