// Hardwood Duel — online game server.
// Serves the game from ./public and runs matches over WebSocket. The server owns the game
// state, so players only ever receive what they are allowed to see (face-down cards stay hidden).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const E = require('./public/engine.js');

const PORT = Number(process.env.PORT) || 8080;
const PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const HEAD = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>';

const server = http.createServer((req, res) => {
  let u;
  try { u = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (u === '/' || u === '') u = '/index.html';
  if (u === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  const file = path.join(PUB, path.normalize(u));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(ext === '.html' ? HEAD + data.toString('utf8') + '</body></html>' : data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map();
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join(''); } while (rooms.has(c));
  return c;
}
const cleanName = n => String(n || '').replace(/[<>]/g, '').trim().slice(0, 18);
function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(room, events, fresh) {
  room.players.forEach((ws, i) => send(ws, { type: 'state', view: E.viewFor(room.state, i), events, fresh: !!fresh }));
}
function startGame(room) {
  room.state = E.createGame({ hp: room.hp, names: room.names });
  room.rematch = [false, false];
  broadcast(room, [], true);
}
function leave(ws) {
  const room = ws.room;
  if (!room) return;
  const other = room.players[1 - ws.idx];
  if (other) { send(other, { type: 'left' }); other.room = null; }
  rooms.delete(room.code);
  ws.room = null;
}

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (m.type === 'create') {
      leave(ws);
      const code = newCode();
      const room = { code, players: [ws, null], names: [cleanName(m.name) || 'Player 1', 'Player 2'], hp: E.clampHp(m.hp), state: null };
      rooms.set(code, room);
      ws.room = room; ws.idx = 0;
      send(ws, { type: 'created', code });
    } else if (m.type === 'join') {
      const room = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!room) return send(ws, { type: 'error', msg: 'No room with that code. Check it with your friend.' });
      if (room.players[1]) return send(ws, { type: 'error', msg: 'That room already has two players.' });
      if (room.players[0] === ws) return send(ws, { type: 'error', msg: 'You are already in that room.' });
      leave(ws);
      room.players[1] = ws;
      room.names[1] = cleanName(m.name) || 'Player 2';
      if (room.names[1] === room.names[0]) room.names[1] += ' 2';
      ws.room = room; ws.idx = 1;
      startGame(room);
    } else if (m.type === 'action') {
      const room = ws.room;
      if (!room || !room.state) return;
      const r = E.apply(room.state, ws.idx, m.action);
      if (!r.ok) return send(ws, { type: 'error', msg: r.error });
      broadcast(room, r.events);
    } else if (m.type === 'rematch') {
      const room = ws.room;
      if (!room || !room.state || room.state.phase !== 'over') return;
      room.rematch[ws.idx] = true;
      if (room.rematch[0] && room.rematch[1]) startGame(room);
      else send(ws, { type: 'rematch-wait' });
    }
  });
  ws.on('close', () => leave(ws));
});

// Drop dead connections so rooms don't linger.
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false; ws.ping();
  });
}, 30000);

server.listen(PORT, () => console.log(`Hardwood Duel running on http://localhost:${PORT}`));
