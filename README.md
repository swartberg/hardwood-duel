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

- `public/engine.js` — rules, random decks, the player roster (real NBA names) and the bot. Shared by the browser and the server.
- `public/index.html` — the game UI (vs bot runs fully in the browser).
- `server.js` — static file server + WebSocket rooms. The server owns the game state and only sends each player what they are allowed to see.

## Balancing knobs (in `engine.js`)

- Starting HP: chosen on the menu (100 / 150 / 200 / custom).
- `ARCH` — stat ranges per position (PG, SG, SF, PF, C).
- `CREDITS`, `PACK` — 20 draft credits; each pack shows 5 players of one tier and costs its tier (5 Superstar … 1 Bench Warmer).
- `TIER_BONUS` — stat bonus or penalty per tier (Superstar +8 … Bench Warmer −12).
- `FIELD`, `BENCH` — 5 starters (2 FC + 3 BC) and a 3-player bench (1 FC + 2 BC), set from the 8 drafted players.
- `STAMINA`, `FATIGUE` — 5 stamina bars per card; each attack uses one and multiplies all four ratings by 0.9.
- `DEF_FLOOR` — lowest a defense can drop (20). Set it to 0 to bring back forced subs at 0 defense and wide-open hits.
- `DEF_REGEN` — share of base value a benched 0-defense recovers per turn (0.2).
- `botStep` — bot lineup, sub and attack choices.

## Rules in short

- Draft: open packs with 20 credits (5 Superstars, 4 All-Stars, 3 Starters, 2 Role Players, 1 Bench Warmers), keep 1 of the 5 players in each, until you have 8 (3 frontcourt, 5 backcourt). You must keep 1 credit per open spot, so you can always finish. Both players draft from one pool, so no player appears on both teams.
- Cards that attack or defend are face up only until the end of that turn, then flip back over. Subbed players also go face down, so the opponent can't follow who moved where.

- Beat a defender: the difference comes off their HP and off the defender's rating for that shot type.
- Subs (frontcourt for frontcourt, backcourt for backcourt) are allowed only after a successful attack (rest of that turn) or a successful defense (your next turn).
- Defense never drops below `DEF_FLOOR` (20). The rules below about 0 defense only apply if you set it to 0.
- A starter whose inside or outside defense reaches 0 must be subbed out before you can attack or end your turn. On the bench that defense recovers 20% of its base per turn, and the player can't come back in while it is 0.
- Bench players recover 1 stamina bar per turn (at the end of their owner's turn), which also undoes one 10% fatigue step.
- If no healthy bench player can replace a 0-defense starter, they stay on and are wide open: the full attack value hits HP.
- Get stopped: the difference comes off your attacker's rating for that shot type.
- If no starter on court on either side has stamina left, the higher HP wins (equal HP is a draw).
- Both decks come from one shared pool, so the two players never hold the same name.

At 100 HP a bot-vs-bot game lasts about 6 turns (150 HP: about 9–10).

## Player photos

Cards show each player's lead photo from English Wikipedia, which only uses freely licensed images there. The browser looks the photos up when the page loads and caches them for a week. The author and license of each photo come from its Wikimedia Commons page and are listed under **Photo credits** on the menu; hovering a photo shows its credit too. Players without a free photo, or any player when Wikipedia can't be reached, show the silhouette. To fix a wrong or missing photo, add the exact Wikipedia article title as the fourth value of that player's `ROSTER` entry in `engine.js`.
