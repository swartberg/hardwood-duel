/* Hardwood Duel — shared game engine (browser + Node). Server-authoritative in online mode. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HDEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // [name, position, tier]  tier 3 = MVP, 2 = All-Star, 1 = Starter
  const ROSTER = [
    ['LeBrandon Jones', 'SF', 3], ['Stephan Curran', 'PG', 3], ['Kevon Durrant', 'SF', 3], ['Yiannis Antetokoumbo', 'PF', 3],
    ['Nikola Jokovic', 'C', 3], ['Luka Donchich', 'PG', 3], ['Joel Embeed', 'C', 3], ['Shay Gilbert-Alexandros', 'PG', 3],
    ['Viktor Wembanyaga', 'C', 3], ['Michael Jordson', 'SG', 3], ['Koby Bryson', 'SG', 3], ["Shaquan O'Neil", 'C', 3],
    ['Tim Dunkin', 'PF', 3], ['Majik Jonson', 'PG', 3], ['Hakim Olajuwan', 'C', 3], ['Larry Byrd', 'SF', 3],
    ['Jayson Tatem', 'SF', 2], ['Anthony Davison', 'PF', 2], ['Damion Lillford', 'PG', 2], ['Kawhan Lennard', 'SF', 2],
    ['Jimmy Butlers', 'SF', 2], ['Devin Booke', 'SG', 2], ['Ja Morantez', 'PG', 2], ['Zion Williamsson', 'PF', 2],
    ['Kyrie Irvington', 'PG', 2], ['Jamal Harding', 'SG', 2], ['Anton Edwardson', 'SG', 2], ['Trey Youngs', 'PG', 2],
    ['Donavon Mitchum', 'SG', 2], ['Jalen Brunsen', 'PG', 2], ['Tyreek Halliburg', 'PG', 2], ['Paulo Bancheri', 'PF', 2],
    ['Dirk Nowinski', 'PF', 2], ['Allan Iverston', 'SG', 2], ['Dwayne Wadey', 'SG', 2], ['Kevan Garnet', 'PF', 2],
    ['Arvydas Sabonauskas', 'C', 2], ['Domantas Sabonaitis', 'C', 2], ['Kris Paulson', 'PG', 2], ['Russel Eastbrook', 'PG', 2],
    ['Steve Nashe', 'PG', 2], ['Charles Barkly', 'PF', 2], ['Scotty Pippin', 'SF', 2], ['Vince Cartier', 'SG', 2],
    ['Tracy McGravy', 'SG', 2], ['Jaylen Browne', 'SG', 2], ['Bam Adebayor', 'C', 2], ['Cade Cunninghan', 'PG', 2],
    ['Clay Thomason', 'SG', 1], ['Draymon Greene', 'PF', 1], ['Paul Georges', 'SF', 1], ['Karl-Antoine Townes', 'C', 1],
    ['Rudi Gobair', 'C', 1], ["De'Aron Foxx", 'PG', 1], ['Jonas Valančiauskas', 'C', 1], ['Kristaps Porzingeris', 'C', 1],
    ['Denis Rodmann', 'PF', 1], ['Ray Allan', 'SG', 1], ['Pau Gasolo', 'C', 1], ['Toni Parkour', 'PG', 1],
    ['LaMelo Bell', 'PG', 1], ['Zack LaVeen', 'SG', 1], ['Mikal Bridgers', 'SF', 1], ['Jrue Holliday', 'PG', 1],
    ['Alperen Sengunn', 'C', 1], ['Evan Mobly', 'PF', 1], ['Franz Wagnor', 'SF', 1], ['Scottie Barnez', 'PF', 1],
    ['Chet Holmgrin', 'C', 1], ['Brandon Ingrim', 'SF', 1], ['Derrick Rosen', 'PG', 1], ['Manu Ginobelli', 'SG', 1]
  ];

  // Stat ranges per position: inside/outside scoring, inside/outside defense
  const ARCH = {
    PG: { ins: [56, 78], out: [72, 92], idef: [50, 64], odef: [66, 88] },
    SG: { ins: [60, 82], out: [70, 92], idef: [52, 66], odef: [62, 86] },
    SF: { ins: [64, 86], out: [64, 86], idef: [60, 78], odef: [62, 82] },
    PF: { ins: [70, 90], out: [56, 78], idef: [68, 88], odef: [56, 74] },
    C:  { ins: [74, 94], out: [50, 64], idef: [74, 95], odef: [50, 64] }
  };
  const TIER_BONUS = { 1: 0, 2: 4, 3: 8 };

  const FIELD = 5, DECK = 12;
  // Court formation: slots 0-1 are frontcourt (PF, C), slots 2-4 are backcourt (PG, SG, SF).
  const FRONT = 2;
  const DECK_FC = 5; // 5 frontcourt + 7 backcourt cards per deck, kept constant through replacements
  const GROUP = { PF: 'FC', C: 'FC', PG: 'BC', SG: 'BC', SF: 'BC' };
  const slotGroup = i => (i < FRONT ? 'FC' : 'BC');
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const clampStat = v => Math.max(50, Math.min(100, v));
  const uid = () => 'c' + Math.random().toString(36).slice(2, 10);
  const clampHp = h => { h = Math.round(Number(h)); return isFinite(h) ? Math.max(20, Math.min(999, h)) : 100; };
  function jersey(name) { let h = 7; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 100; }

  function makeCard(excludeNames, grp) {
    const ex = excludeNames || new Set();
    const inGrp = r => !grp || GROUP[r[1]] === grp;
    let pool = ROSTER.filter(r => inGrp(r) && !ex.has(r[0]));
    if (!pool.length) pool = ROSTER.filter(inGrp);
    const [name, pos, tier] = pool[Math.floor(Math.random() * pool.length)];
    const a = ARCH[pos], b = TIER_BONUS[tier];
    const roll = k => clampStat(ri(a[k][0], a[k][1]) + b + ri(-2, 2));
    const c = { id: uid(), name, pos, tier, grp: GROUP[pos], num: jersey(name), ins: roll('ins'), out: roll('out'), idef: roll('idef'), odef: roll('odef'), revealed: false };
    c.ins0 = c.ins; c.out0 = c.out;
    return c;
  }

  function makeDeck(n) {
    n = n || DECK;
    const names = new Set(), deck = [];
    for (let i = 0; i < n; i++) { const c = makeCard(names, i < DECK_FC ? 'FC' : 'BC'); names.add(c.name); deck.push(c); }
    return deck;
  }

  function createGame(opts) {
    opts = opts || {};
    const hp = clampHp(opts.hp == null ? 100 : opts.hp);
    const names = opts.names || ['Player 1', 'Player 2'];
    return {
      hpMax: hp,
      players: [0, 1].map(i => ({ name: names[i], hp, field: Array(FIELD).fill(null), bench: makeDeck(DECK), ready: false })),
      phase: 'setup', turn: Math.random() < 0.5 ? 0 : 1, attacked: false, turnNo: 0, winner: null, log: []
    };
  }

  const copy = c => (c ? JSON.parse(JSON.stringify(c)) : null);
  function log(s, p, kind, text) { s.log.unshift({ p, kind, text }); if (s.log.length > 80) s.log.length = 80; }
  const deckNames = pl => new Set([...pl.field, ...pl.bench].filter(Boolean).map(c => c.name));

  function apply(s, p, a) {
    if (p !== 0 && p !== 1) return { ok: false, error: 'Unknown player.' };
    if (!a || typeof a !== 'object') return { ok: false, error: 'Bad action.' };
    const me = s.players[p], op = s.players[1 - p];
    const ev = [];

    if (s.phase === 'over') return { ok: false, error: 'The game is over.' };

    if (a.t === 'lineup') {
      if (s.phase !== 'setup') return { ok: false, error: 'Lineups are already set.' };
      if (me.ready) return { ok: false, error: 'Your lineup is already locked.' };
      const ids = Array.isArray(a.ids) ? a.ids : [];
      if (ids.length !== FIELD || new Set(ids).size !== FIELD) return { ok: false, error: 'Pick exactly 5 different players.' };
      const picked = ids.map(id => me.bench.find(c => c.id === id));
      if (picked.some(c => !c)) return { ok: false, error: 'Those cards are not in your deck.' };
      const fc = picked.filter(c => c.grp === 'FC'), bc = picked.filter(c => c.grp === 'BC');
      if (fc.length !== FRONT || bc.length !== FIELD - FRONT) return { ok: false, error: 'Start 2 frontcourt and 3 backcourt players.' };
      me.field = [...fc, ...bc];
      me.bench = me.bench.filter(c => !ids.includes(c.id));
      me.ready = true;
      ev.push({ e: 'ready', p });
      log(s, p, 'info', `${me.name} locked in a starting five.`);
      if (op.ready) {
        s.phase = 'play'; s.turnNo = 1; s.attacked = false;
        ev.push({ e: 'start', first: s.turn });
        log(s, s.turn, 'info', `Tip-off. ${s.players[s.turn].name} has the ball first.`);
      }
      return { ok: true, events: ev };
    }

    if (s.phase !== 'play') return { ok: false, error: 'Wait for both lineups.' };
    if (s.turn !== p) return { ok: false, error: "It's not your turn." };

    if (a.t === 'swap') {
      const slot = a.slot | 0;
      if (slot < 0 || slot >= FIELD || !me.field[slot]) return { ok: false, error: 'Pick a starter to sub out.' };
      const bi = me.bench.findIndex(c => c.id === a.benchId);
      if (bi < 0) return { ok: false, error: 'That card is not on your bench.' };
      if (me.bench[bi].grp !== slotGroup(slot)) return { ok: false, error: slotGroup(slot) === 'FC' ? 'Frontcourt players can only be swapped with frontcourt players.' : 'Backcourt players can only be swapped with backcourt players.' };
      const out = me.field[slot];
      me.field[slot] = me.bench[bi];
      me.bench[bi] = out;
      ev.push({ e: 'swap', p, slot });
      log(s, p, 'sub', `${me.name} made a substitution.`);
      return { ok: true, events: ev };
    }

    if (a.t === 'attack') {
      if (s.attacked) return { ok: false, error: 'You already attacked this turn.' };
      const slot = a.slot | 0, target = a.target | 0, kind = a.kind === 'outside' ? 'outside' : 'inside';
      const atk = me.field[slot], def = op.field[target];
      if (!atk) return { ok: false, error: 'Choose one of your starters to attack with.' };
      if (!def) return { ok: false, error: 'Choose an opponent card to attack.' };
      atk.revealed = true; def.revealed = true;
      const sk = kind === 'inside' ? 'ins' : 'out', dk = kind === 'inside' ? 'idef' : 'odef';
      const av = atk[sk], dv = def[dk];
      const evA = { e: 'attack', p, slot, target, kind, atkVal: av, defVal: dv, atk: copy(atk), def: copy(def) };
      s.attacked = true;
      const label = kind === 'inside' ? 'inside' : 'outside';
      if (av > dv) {
        const dmg = av - dv;
        op.hp = Math.max(0, op.hp - dmg);
        // Beaten card leaves the game; owner draws from deck into the slot and gets a fresh random card.
        // Replacement comes from the same court group so the 2-3 formation holds.
        const g = slotGroup(target);
        op.field[target] = null;
        const pool = op.bench.map((c, i) => (c.grp === g ? i : -1)).filter(i => i >= 0);
        const di = pool.length ? pool[Math.floor(Math.random() * pool.length)] : -1;
        const drawn = di >= 0 ? op.bench.splice(di, 1)[0] : makeCard(deckNames(op), g);
        op.field[target] = drawn;
        op.bench.push(makeCard(deckNames(op), g));
        Object.assign(evA, { result: 'score', dmg, hpAfter: op.hp, drawnId: drawn.id });
        log(s, p, 'score', `${atk.name} scored ${label} on ${def.name} (${av} vs ${dv}). ${dmg} damage. ${def.name} is out.`);
      } else if (av < dv) {
        const diff = dv - av;
        atk[sk] = Math.max(0, atk[sk] - diff);
        Object.assign(evA, { result: 'blocked', diff, statAfter: atk[sk] });
        log(s, p, 'block', `${def.name} shut down ${atk.name}'s ${label} attack (${av} vs ${dv}). ${atk.name} loses ${diff} ${label} scoring.`);
      } else {
        Object.assign(evA, { result: 'tie' });
        log(s, p, 'tie', `${atk.name} and ${def.name} cancel out at ${av}.`);
      }
      ev.push(evA);
      if (op.hp <= 0) {
        s.phase = 'over'; s.winner = p;
        ev.push({ e: 'over', winner: p });
        log(s, p, 'info', `${me.name} wins.`);
      }
      return { ok: true, events: ev };
    }

    if (a.t === 'end') {
      s.turn = 1 - p; s.attacked = false; s.turnNo++;
      ev.push({ e: 'turn', p: s.turn });
      return { ok: true, events: ev };
    }

    return { ok: false, error: 'Unknown action.' };
  }

  function viewFor(s, p) {
    const me = s.players[p], op = s.players[1 - p];
    return {
      you: p, phase: s.phase, turn: s.turn, myTurn: s.turn === p, attacked: s.attacked,
      turnNo: s.turnNo, winner: s.winner, hpMax: s.hpMax,
      me: { name: me.name, hp: me.hp, ready: me.ready, field: me.field.map(copy), bench: me.bench.map(copy) },
      opp: {
        name: op.name, hp: op.hp, ready: op.ready, benchCount: op.bench.length,
        field: op.field.map(c => (c ? (c.revealed ? copy(c) : { id: c.id, hidden: true }) : null))
      },
      log: s.log.slice(0, 50).map(l => ({ mine: l.p === p, kind: l.kind, text: l.text }))
    };
  }

  // ---------- Bot ----------
  const cardValue = c => 0.55 * Math.max(c.ins, c.out) + 0.45 * (c.idef + c.odef) / 2;
  const byValue = (a, b) => cardValue(b) - cardValue(a);
  const bestFive = cards => [
    ...cards.filter(c => c.grp === 'FC').sort(byValue).slice(0, FRONT),
    ...cards.filter(c => c.grp === 'BC').sort(byValue).slice(0, FIELD - FRONT)
  ];

  function botStep(s, p) {
    const me = s.players[p], op = s.players[1 - p];
    if (s.phase === 'setup') {
      if (me.ready) return null;
      return { t: 'lineup', ids: bestFive([...me.bench]).map(c => c.id) };
    }
    if (s.phase !== 'play' || s.turn !== p) return null;
    if (!s.attacked) {
      const desired = new Set(bestFive([...me.field, ...me.bench]).map(c => c.id));
      const slot = me.field.findIndex(c => c && !desired.has(c.id));
      if (slot >= 0) {
        const inc = me.bench.filter(c => desired.has(c.id) && c.grp === slotGroup(slot)).sort(byValue)[0];
        if (inc) return { t: 'swap', slot, benchId: inc.id };
      }
      let best = null;
      me.field.forEach((a, i) => {
        if (!a) return;
        op.field.forEach((t, j) => {
          if (!t) return;
          ['inside', 'outside'].forEach(k => {
            const av = k === 'inside' ? a.ins : a.out;
            const dv = t.revealed ? (k === 'inside' ? t.idef : t.odef) : 71;
            const d = av - dv;
            let sc = d > 0 ? d : d * 0.45;
            if (!t.revealed) sc -= 2;
            sc += (Math.random() - 0.5) * 6;
            if (!best || sc > best.sc) best = { sc, slot: i, target: j, kind: k };
          });
        });
      });
      if (best && best.sc > -3) return { t: 'attack', slot: best.slot, target: best.target, kind: best.kind };
    }
    return { t: 'end' };
  }

  return { ROSTER, GROUP, createGame, apply, viewFor, botStep, bestFive, slotGroup, makeCard, makeDeck, clampHp, FIELD, FRONT, DECK };
});
