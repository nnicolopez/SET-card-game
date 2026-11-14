import type { CommandError, CommandInput, GameEvent, PublicGameState } from '@set/engine';

/** A command as the UI sends it; the client adds requestId (and, online, playerId from the session). */
export type ClientCommand = CommandInput;

export type SendResult = { ok: true; events: GameEvent[] } | { ok: false; error: CommandError };

/**
 * The seam between UI and game authority. Today: LocalGameClient runs the engine
 * in the browser. Next: a WebSocket client talking to API Gateway + Lambda, with
 * the same interface, so the UI doesn't change.
 */
export interface GameClient {
  getSnapshot(): PublicGameState;
  subscribe(listener: () => void): () => void;
  send(command: ClientCommand): Promise<SendResult>;
}
