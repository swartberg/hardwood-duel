# Hardwood Duel

Yu-Gi-Oh style basketball card battler. Play vs the bot or online against a friend.

## Run it

```bash
npm install
npm start          # http://localhost:8080  (set PORT=xxxx to change)
```

Open the address in two browsers. One player clicks **Create room** and shares the 4-letter code, the other types it in and clicks **Join**. The game server field fills in automatically when the page is served by this server.

## Hosting

Any host that runs Node 18+ and allows WebSockets works (Render, Railway, Fly.io, a VPS).

**Render:** `render.yaml` describes the service. New service: in Render choose **New → Blueprint**, pick this repo, and apply. Existing service: make sure it deploys from `main` with build command `npm install` and start command `npm start`; with auto-deploy on, every push to `main` redeploys. Upload the folder, run `npm install` and `npm start`, and make sure the host passes the `PORT` environment variable. Behind HTTPS the page connects with `wss://` on its own.

## Files

- `public/engine.js` — rules, random decks, card names and the bot. Shared by the browser and the server.
- `public/index.html` — the game UI (vs bot runs fully in the browser).
- `server.js` — static file server + WebSocket rooms. The server owns the game state and only sends each player what they are allowed to see.

## Balancing knobs (in `engine.js`)

- Starting HP: chosen on the menu (100 / 150 / 200 / custom).
- `ARCH` — stat ranges per position (PG, SG, SF, PF, C).
- `TIER_BONUS` — boost for All-Star (2) and MVP (3) cards.
- `FIELD`, `DECK` — 5 starters picked from a 12-card deck. The starting five is locked for the whole game.
- `STAMINA`, `FATIGUE` — 5 stamina bars per card; each attack uses one and multiplies all four ratings by 0.9.
- `botStep` — bot lineup and attack choices.

## Rules in short

- Beat a defender: the difference comes off their HP and off the defender's rating for that shot type.
- A defender at 0 on that defense is wide open, so the full attack value hits HP.
- Get stopped: the difference comes off your attacker's rating for that shot type.
- If no starter on either side has stamina left, the higher HP wins (equal HP is a draw).
- Both decks come from one shared pool, so the two players never hold the same name.

At 100 HP a bot-vs-bot game lasts about 4 turns (150 HP: about 6, 200 HP: about 7).
