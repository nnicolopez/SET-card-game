import { type GameState, applyCommand, createGame, toPublicState } from '@set/engine';
import type { ClientCommand, GameClient, SendResult } from './client';

/** Runs the authoritative engine in the browser. Used for local play and as the reference behavior. */
export class LocalGameClient implements GameClient {
  private state: GameState;
  private snapshot;
  private listeners = new Set<() => void>();

  constructor(seed?: number) {
    this.state = createGame({ gameId: crypto.randomUUID(), ...(seed === undefined ? {} : { seed }) });
    this.snapshot = toPublicState(this.state);
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  send = async (command: ClientCommand): Promise<SendResult> => {
    const result = applyCommand(this.state, { ...command, requestId: crypto.randomUUID() });
    if (result.state !== this.state) {
      this.state = result.state;
      this.snapshot = toPublicState(this.state);
      this.listeners.forEach((l) => l());
    }
    return result.ok ? { ok: true, events: result.events } : { ok: false, error: result.error };
  };
}
