# SET Multiplayer — Learning AWS Through Play

A proposed multiplayer web adaptation of SET, explored as a hands-on AWS learning project.

**Status: discussion and documentation only.** There is no application code, infrastructure, deployment, or playable demo. Architecture diagrams describe alternatives, not existing systems.

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

- Use a multiplayer SET web game as an AWS learning project.
- Keep project documentation in English.
- Maintain a public repository.
- Discuss the idea before writing application or infrastructure code.

**Not decided:** backend architecture, programming language, frontend framework, identity model, AWS region, budget, player limit, claim timing, deployment tooling, or implementation schedule.

## Next discussion

Choose the first learning objective and agree on the multiplayer interaction: announce SET before selecting cards, or submit three selected cards directly.

## References and attribution

This is an independent educational project, not an official SET product or an affiliation with its publisher. No official artwork is included.

- [SET — PlayMonster](https://playmonster.com/product/set/)
- [Official SET rules](https://www.playmonster.com/wp-content/uploads/2020/01/SETRules.pdf)

Documentation started on November 11, 2026. Technical references should be checked again before implementation.
