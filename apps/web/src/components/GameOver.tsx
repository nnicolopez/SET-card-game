import { type Player, winners } from '@set/engine';
import { t } from '../strings';

export function GameOver({
  players,
  elapsed,
  onRematch,
  onExit,
}: {
  players: Player[];
  elapsed: string;
  onRematch: () => void;
  onExit: () => void;
}) {
  const winnerIds = winners(players);
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const names = winnerIds.map((id) => players.find((p) => p.id === id)!.name);

  return (
    <main className="game-over">
      <p className="muted">
        {t.finished} · {elapsed}
      </p>
      <h1>{players.length > 1 ? t.winner(names) : `${players[0]!.score} SETs`}</h1>
      {players.length > 1 && (
        <ol className="final-scores">
          {ranked.map((p) => (
            <li key={p.id} data-winner={winnerIds.includes(p.id) || undefined}>
              <span>{p.name}</span>
              <span>{p.score}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="row">
        <button type="button" className="primary" onClick={onRematch}>
          {t.rematch}
        </button>
        <button type="button" className="link-button" onClick={onExit}>
          {t.newGame}
        </button>
      </div>
    </main>
  );
}
