import { type CardId, type GameEvent, findAnySet, findSets } from '@set/engine';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { LocalSession } from '../App';
import { t } from '../strings';
import { CardView } from './CardView';
import { GameOver } from './GameOver';

interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'bad' | 'info';
}

function useElapsed(running: boolean) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  const s = Math.floor((now - start) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function Game({
  session,
  onRematch,
  onExit,
}: {
  session: LocalSession;
  onRematch: () => void;
  onExit: () => void;
}) {
  const { client } = session;
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const [selected, setSelected] = useState<CardId[]>([]);
  const [wrong, setWrong] = useState<CardId[]>([]);
  const [fresh, setFresh] = useState<CardId[]>([]);
  const [hint, setHint] = useState<CardId | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [colorLetters, setColorLetters] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastSeq = useRef(0);
  const elapsed = useElapsed(state.status === 'playing');

  const multiplayer = state.players.length > 1;
  const awaitingClaimer = multiplayer && selected.length === 3;
  const nameOf = useCallback((id: string) => state.players.find((p) => p.id === id)?.name ?? id, [state.players]);
  const setsOnBoard = useMemo(() => (showHelp ? findSets(state.board).length : 0), [showHelp, state.board]);

  const notify = (text: string, tone: Toast['tone']) => setToast({ id: ++toastSeq.current, text, tone });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Drop selections/hints that refer to cards that left the board.
  useEffect(() => {
    setSelected((sel) => sel.filter((c) => state.board.includes(c)));
    setHint((h) => (h !== null && state.board.includes(h) ? h : null));
  }, [state.board]);

  const handleEvents = useCallback(
    (events: GameEvent[], before: CardId[]) => {
      for (const e of events) {
        if (e.type === 'set-found') {
          notify(t.setFound(nameOf(e.playerId)), 'good');
          setFresh(client.getSnapshot().board.filter((c) => !before.includes(c)));
          if (e.extraCardsDealt > 0) setTimeout(() => notify(t.extraDealt(e.extraCardsDealt), 'info'), 1200);
        } else if (e.type === 'set-invalid') {
          notify(t.setInvalid(nameOf(e.playerId), e.penalty), 'bad');
          setWrong([...e.cards]);
          setTimeout(() => setWrong([]), 600);
        } else if (e.type === 'game-started' && client.getSnapshot().board.length > 12) {
          notify(t.extraDealt(client.getSnapshot().board.length - 12), 'info');
        }
      }
    },
    [client, nameOf],
  );

  const claim = useCallback(
    async (playerId: string, cards: CardId[]) => {
      const before = client.getSnapshot().board;
      setSelected([]);
      setHint(null);
      const result = await client.send({ type: 'claim', playerId, cards });
      if (result.ok) handleEvents(result.events, before);
      else notify(t.error[result.error], 'bad');
    },
    [client, handleEvents],
  );

  const toggle = (id: CardId) => {
    if (awaitingClaimer && !selected.includes(id)) return;
    const next = selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id];
    setSelected(next);
    if (next.length === 3 && !multiplayer) void claim(state.players[0]!.id, next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected([]);
      const n = Number(e.key);
      if (awaitingClaimer && n >= 1 && n <= state.players.length) void claim(state.players[n - 1]!.id, selected);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [awaitingClaimer, claim, selected, state.players]);

  useEffect(() => {
    if (fresh.length === 0) return;
    const timer = setTimeout(() => setFresh([]), 700);
    return () => clearTimeout(timer);
  }, [fresh]);

  if (state.status === 'finished') {
    return <GameOver players={state.players} elapsed={elapsed} onRematch={onRematch} onExit={onExit} />;
  }

  const cardStatus = (id: CardId) =>
    wrong.includes(id) ? 'wrong' : hint === id ? 'hint' : fresh.includes(id) ? 'new' : undefined;

  return (
    <main className="game">
      <header className="game-header">
        <button type="button" className="link-button" onClick={onExit}>
          ← {t.title}
        </button>
        <div className="stats">
          <span>{t.deck(state.deckCount)}</span>
          <span aria-label="Tiempo">{elapsed}</span>
          {showHelp && <span>{t.setsOnBoard(setsOnBoard)}</span>}
        </div>
      </header>

      <ol className="scores">
        {state.players.map((p, i) => (
          <li key={p.id}>
            {multiplayer && <kbd>{i + 1}</kbd>}
            <span className="name">{p.name}</span>
            <span className="score">{p.score}</span>
          </li>
        ))}
      </ol>

      <section className="board" data-count={state.board.length} aria-label="Mesa">
        {state.board.map((id) => (
          <CardView
            key={id}
            id={id}
            selected={selected.includes(id)}
            status={cardStatus(id)}
            showColorLetter={colorLetters}
            onToggle={toggle}
          />
        ))}
      </section>

      <div className="action-bar" aria-live="polite">
        {awaitingClaimer ? (
          <div className="claimers">
            <span>{t.whoFound}</span>
            {state.players.map((p, i) => (
              <button key={p.id} type="button" className="primary" onClick={() => void claim(p.id, selected)}>
                <kbd>{i + 1}</kbd> {p.name}
              </button>
            ))}
            <button type="button" className="link-button" onClick={() => setSelected([])}>
              {t.cancel}
            </button>
          </div>
        ) : (
          <div className="tools">
            <label>
              <input type="checkbox" checked={showHelp} onChange={(e) => setShowHelp(e.target.checked)} /> {t.showHelp}
            </label>
            <label>
              <input type="checkbox" checked={colorLetters} onChange={(e) => setColorLetters(e.target.checked)} />{' '}
              {t.colorLetters}
            </label>
            {showHelp && (
              <button type="button" className="link-button" onClick={() => setHint(findAnySet(state.board)?.[0] ?? null)}>
                {t.hint}
              </button>
            )}
            <span className="muted keyboard-only">{t.keyboardHint}</span>
          </div>
        )}
      </div>

      {toast && (
        <div key={toast.id} className="toast" data-tone={toast.tone} role="status">
          {toast.text}
        </div>
      )}
    </main>
  );
}
