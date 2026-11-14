import { useState } from 'react';
import { Game } from './components/Game';
import { Lobby } from './components/Lobby';
import { LocalGameClient } from './game/localClient';

export interface LocalSession {
  key: number;
  client: LocalGameClient;
  players: { id: string; name: string }[];
}

async function startLocalGame(names: string[], key: number): Promise<LocalSession> {
  const client = new LocalGameClient();
  const players = names.map((name, i) => ({ id: `p${i + 1}`, name }));
  for (const p of players) await client.send({ type: 'join', playerId: p.id, name: p.name });
  await client.send({ type: 'start', playerId: players[0]!.id });
  return { key, client, players };
}

export function App() {
  const [session, setSession] = useState<LocalSession | null>(null);

  const start = async (names: string[]) => setSession(await startLocalGame(names, Date.now()));

  return (
    <div className="app">
      {session ? (
        <Game
          key={session.key}
          session={session}
          onRematch={() => start(session.players.map((p) => p.name))}
          onExit={() => setSession(null)}
        />
      ) : (
        <Lobby onStart={start} />
      )}
    </div>
  );
}
