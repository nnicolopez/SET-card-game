# SET Multiplayer — Learning AWS Through Play

A proposed multiplayer web adaptation of SET, explored as a hands-on AWS learning project.

**Status: playable locally.** The rules engine and a local (same-screen) web client are implemented. No AWS infrastructure exists yet; the online version is the next step.

## Run it

```bash
npm install
npm run dev      # web client at http://localhost:5173
npm test         # engine tests
npm run build    # static bundle in apps/web/dist
```

## Repository layout

| Path | Contents |
| --- | --- |
| `packages/engine` | Pure TypeScript rules and game state: cards, SET detection, `applyCommand` reducer, public view. No browser or AWS dependencies, so the future Lambda handlers reuse it as is. |
| `apps/web` | React + Vite client. Talks to the game through a `GameClient` interface; today `LocalGameClient` runs the engine in the browser, later a WebSocket client will talk to AWS. |
| `docs/` | Design notes and decisions. |

## Why this project?

A small card game offers concrete reasons to learn cloud fundamentals: connecting players, storing shared state, validating simultaneous actions, recovering from disconnects, and understanding operational costs.

The goal is to understand the decisions and their tradeoffs before implementing them.

## The game

Players search a shared board for three cards that form a SET. Each card has four attributes: number, shape, color, and shading. For each attribute independently, the three values must be either all identical or all different.

The full deck contains 81 unique cards. Everyone searches simultaneously; there are no player turns.

## Documentation

| Guide | Contents |
| --- | --- |
| [Game and cards](docs/game/README.md) | Deck composition, official rules, and possible web adaptations |
| [Architecture alternatives](docs/architecture/README.md) | API Gateway WebSocket and AppSync Events diagrams and tradeoffs |
| [Real-time coordination](docs/realtime/README.md) | Competing claims, authoritative state, retries, and reconnection |
| [Learning roadmap](docs/learning/README.md) | Concepts to learn, discussion milestones, and open decisions |

## Candidate experience

These are discussion proposals, not approved requirements:

- Create a room and invite friends with a link or room code.
- Join from a desktop or mobile browser.
- See the same cards and scores across players.
- Announce SET, briefly reserve the board, and submit three cards.
- Reconnect without losing the current game state.

Public matchmaking, rankings, chat, and accounts are outside the initial proposal. Their inclusion remains open for discussion.

## Current decisions

- Multiplayer SET web game as an AWS learning project; public repo, English docs, MIT license.
- **Backend:** Option A — API Gateway WebSocket + Lambda + DynamoDB.
- **Claims (MVP):** submit three cards directly; no announce/reservation step. The first committed claim wins.
- **State:** one DynamoDB item per game, updated with a conditional write on `version`.
- **No SET on the board:** the server detects it and deals three more cards automatically.
- **Identity (MVP):** guest players with a token stored in the browser; accounts later.
- **Stack:** TypeScript everywhere; React + Vite frontend; AWS CDK (TypeScript) for infrastructure.

**Still open:** AWS region (`sa-east-1` latency vs. `us-east-1` cost), budget, room size limit, reservation flow for a later version.

## Next step

Build one online room on AWS. See [Learning roadmap](docs/learning/README.md).

## References and attribution

This is an independent educational project, not an official SET product or an affiliation with its publisher. No official artwork is included.

- [SET — PlayMonster](https://playmonster.com/product/set/)
- [Official SET rules](https://www.playmonster.com/wp-content/uploads/2020/01/SETRules.pdf)

Documentation started on November 11, 2026. Technical references should be checked again before implementation.
