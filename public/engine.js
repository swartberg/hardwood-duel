/* Hardwood Duel — shared game engine (browser + Node). Server-authoritative in online mode. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HDEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // [name, position, tier, wikipediaTitle?]  tier 3 = MVP, 2 = All-Star, 1 = Starter.
  // The Wikipedia title (defaults to the name) is used to look up a freely licensed photo.
  const ROSTER = [
    ['LeBron James', 'SF', 3], ['Stephen Curry', 'PG', 3], ['Kevin Durant', 'SF', 3], ['Giannis Antetokounmpo', 'PF', 3],
    ['Nikola Jokić', 'C', 3], ['Luka Dončić', 'PG', 3], ['Joel Embiid', 'C', 3], ['Shai Gilgeous-Alexander', 'PG', 3],
    ['Victor Wembanyama', 'C', 3], ['Michael Jordan', 'SG', 3], ['Kobe Bryant', 'SG', 3], ["Shaquille O'Neal", 'C', 3],
    ['Tim Duncan', 'PF', 3], ['Magic Johnson', 'PG', 3], ['Hakeem Olajuwon', 'C', 3], ['Larry Bird', 'SF', 3],
    ['Jayson Tatum', 'SF', 2], ['Anthony Davis', 'PF', 2], ['Damian Lillard', 'PG', 2], ['Kawhi Leonard', 'SF', 2],
    ['Jimmy Butler', 'SF', 2], ['Devin Booker', 'SG', 2], ['Ja Morant', 'PG', 2], ['Zion Williamson', 'PF', 2],
    ['Kyrie Irving', 'PG', 2], ['James Harden', 'SG', 2], ['Anthony Edwards', 'SG', 2, 'Anthony Edwards (basketball)'], ['Trae Young', 'PG', 2],
    ['Donovan Mitchell', 'SG', 2], ['Jalen Brunson', 'PG', 2], ['Tyrese Haliburton', 'PG', 2], ['Paolo Banchero', 'PF', 2],
    ['Dirk Nowitzki', 'PF', 2], ['Allen Iverson', 'SG', 2], ['Dwyane Wade', 'SG', 2], ['Kevin Garnett', 'PF', 2],
    ['Arvydas Sabonis', 'C', 2], ['Domantas Sabonis', 'C', 2], ['Chris Paul', 'PG', 2], ['Russell Westbrook', 'PG', 2],
    ['Steve Nash', 'PG', 2], ['Charles Barkley', 'PF', 2], ['Scottie Pippen', 'SF', 2], ['Vince Carter', 'SG', 2],
    ['Tracy McGrady', 'SG', 2], ['Jaylen Brown', 'SG', 2], ['Bam Adebayo', 'C', 2], ['Cade Cunningham', 'PG', 2],
    ['Klay Thompson', 'SG', 1], ['Draymond Green', 'PF', 1], ['Paul George', 'SF', 1], ['Karl-Anthony Towns', 'C', 1],
    ['Rudy Gobert', 'C', 1], ["De'Aaron Fox", 'PG', 1], ['Jonas Valančiūnas', 'C', 1], ['Kristaps Porziņģis', 'C', 1],
    ['Dennis Rodman', 'PF', 1], ['Ray Allen', 'SG', 1], ['Pau Gasol', 'C', 1], ['Tony Parker', 'PG', 1],
    ['LaMelo Ball', 'PG', 1], ['Zach LaVine', 'SG', 1], ['Mikal Bridges', 'SF', 1], ['Jrue Holiday', 'PG', 1],
    ['Alperen Şengün', 'C', 1], ['Evan Mobley', 'PF', 1], ['Franz Wagner', 'SF', 1], ['Scottie Barnes', 'PF', 1],
    ['Chet Holmgren', 'C', 1], ['Brandon Ingram', 'SF', 1], ['Derrick Rose', 'PG', 1], ['Manu Ginóbili', 'SG', 1]
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
  const DECK_FC = 5; // 5 frontcourt + 7 backcourt cards per deck to pick a starting five from
  const BENCH = 3, BENCH_FC = 1; // 3 bench players: 1 frontcourt + 2 backcourt
  const STAMINA = 5, FATIGUE = 0.9; // each attack burns a bar and leaves 90% of every rating
  const DEF_FLOOR = 20; // beaten or tired defenses never drop below this (0 brings back forced subs and wide-open hits)
  const DEF_REGEN = 0.2; // a benched defense that hit 0 recovers 20% of its base value per turn
  const STATS = ['ins', 'out', 'idef', 'odef'];
  const GROUP = { PF: 'FC', C: 'FC', PG: 'BC', SG: 'BC', SF: 'BC' };
  const slotGroup = i => (i < FRONT ? 'FC' : 'BC');
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const clampStat = v => Math.max(50, Math.min(100, v));
  const uid = () => 'c' + Math.random().toString(36).slice(2, 10);
  const clampHp = h => { h = Math.round(Number(h)); return isFinite(h) ? Math.max(20, Math.min(999, h)) : 100; };

  function makeCard(excludeNames, grp) {
    const ex = excludeNames || new Set();
    const inGrp = r => !grp || GROUP[r[1]] === grp;
    let pool = ROSTER.filter(r => inGrp(r) && !ex.has(r[0]));
    if (!pool.length) pool = ROSTER.filter(inGrp);
    const [name, pos, tier] = pool[Math.floor(Math.random() * pool.length)];
    const a = ARCH[pos], b = TIER_BONUS[tier];
    const roll = k => clampStat(ri(a[k][0], a[k][1]) + b + ri(-2, 2));
    const c = { id: uid(), name, pos, tier, grp: GROUP[pos], ins: roll('ins'), out: roll('out'), idef: roll('idef'), odef: roll('odef'), sta: STAMINA, revealed: false };
    c.ins0 = c.ins; c.out0 = c.out; c.idef0 = c.idef; c.odef0 = c.odef;
    return c;
  }

  // Pass a shared name set to keep names unique across several decks.
  function makeDeck(n, names) {
    n = n || DECK; names = names || new Set();
    const deck = [];
    for (let i = 0; i < n; i++) { const c = makeCard(names, i < DECK_FC ? 'FC' : 'BC'); names.add(c.name); deck.push(c); }
    return deck;
  }

  function createGame(opts) {
    opts = opts || {};
    const hp = clampHp(opts.hp == null ? 100 : opts.hp);
    const names = opts.names || ['Player 1', 'Player 2'];
    const used = new Set(); // one player pool: no name appears in both decks
    return {
      ver: 4, hpMax: hp,
      players: [0, 1].map(i => ({ name: names[i], hp, field: Array(FIELD).fill(null), bench: makeDeck(DECK, used), ready: false })),
      phase: 'setup', turn: Math.random() < 0.5 ? 0 : 1, attacked: false, turnNo: 0, winner: null, log: []
    };
  }

  const copy = c => (c ? JSON.parse(JSON.stringify(c)) : null);
  function log(s, p, kind, text) { s.log.unshift({ p, kind, text }); if (s.log.length > 80) s.log.length = 80; }
  const canAttack = pl => pl.field.some(c => c && c.sta > 0);
  const broken = c => c.idef === 0 || c.odef === 0;
  // A starter with a 0 defense must come off when a healthy bench player of the same court group can replace them.
  const mustSub = pl => pl.field.map((c, i) => (c && broken(c) && pl.bench.some(b => b.grp === c.grp && !broken(b)) ? i : -1)).filter(i => i >= 0);

  // Bench recovery, run when the owner ends a turn: one stamina bar back (undoing one step of fatigue),
  // and a defense that hit 0 climbs back 20% of its base value.
  function rest(pl) {
    pl.bench.forEach(c => {
      c.rec = c.rec || {};
      ['idef', 'odef'].forEach(k => { if (c[k] === 0) c.rec[k] = true; });
      if (c.sta < STAMINA) {
        c.sta += 1;
        STATS.forEach(k => { if (!c.rec[k]) c[k] = Math.min(c[k + '0'], Math.round(c[k] / FATIGUE)); });
      }
      Object.keys(c.rec).forEach(k => {
        c[k] = Math.min(c[k + '0'], c[k] + Math.round(c[k + '0'] * DEF_REGEN));
        if (c[k] >= c[k + '0']) delete c.rec[k];
      });
    });
  }

  function apply(s, p, a) {
    if (p !== 0 && p !== 1) return { ok: false, error: 'Unknown player.' };
    if (!a || typeof a !== 'object') return { ok: false, error: 'Bad action.' };
    const me = s.players[p], op = s.players[1 - p];
    const ev = [];

    if (s.phase === 'over') return { ok: false, error: 'The game is over.' };

    if (a.t === 'lineup') {
      if (s.phase !== 'setup') return { ok: false, error: 'Lineups are already set.' };
      if (me.ready) return { ok: false, error: 'Your lineup is already locked.' };
      const ids = Array.isArray(a.ids) ? a.ids : [], bids = Array.isArray(a.bench) ? a.bench : [];
      if (ids.length !== FIELD || bids.length !== BENCH || new Set([...ids, ...bids]).size !== FIELD + BENCH) return { ok: false, error: 'Pick 5 different starters and 3 bench players.' };
      const picked = ids.map(id => me.bench.find(c => c.id === id)), bpicked = bids.map(id => me.bench.find(c => c.id === id));
      if (picked.some(c => !c) || bpicked.some(c => !c)) return { ok: false, error: 'Those cards are not in your deck.' };
      const fc = picked.filter(c => c.grp === 'FC'), bc = picked.filter(c => c.grp === 'BC');
      if (fc.length !== FRONT || bc.length !== FIELD - FRONT) return { ok: false, error: 'Start 2 frontcourt and 3 backcourt players.' };
      if (bpicked.filter(c => c.grp === 'FC').length !== BENCH_FC) return { ok: false, error: 'Put 1 frontcourt and 2 backcourt players on the bench.' };
      // These 8 play the whole game; the rest of the deck sits out.
      me.field = [...fc, ...bc];
      me.bench = bpicked;
      me.ready = true;
      ev.push({ e: 'ready', p });
      log(s, p, 'info', `${me.name} locked in a starting five and bench.`);
      if (op.ready) {
        s.phase = 'play'; s.turnNo = 1; s.attacked = false; s.subOk = false; s.earnedSub = false;
        ev.push({ e: 'start', first: s.turn });
        log(s, s.turn, 'info', `Tip-off. ${s.players[s.turn].name} has the ball first.`);
      }
      return { ok: true, events: ev };
    }

    if (s.phase !== 'play') return { ok: false, error: 'Wait for both lineups.' };
    if (s.turn !== p) return { ok: false, error: "It's not your turn." };

    const forced = mustSub(me);

    if (a.t === 'swap') {
      const slot = a.slot | 0;
      if (slot < 0 || slot >= FIELD || !me.field[slot]) return { ok: false, error: 'Pick a starter to sub out.' };
      const isForced = forced.includes(slot);
      if (!isForced && !s.subOk) return { ok: false, error: forced.length ? 'Sub out the player with 0 defense first.' : 'Subs open only after a successful attack or a successful defense.' };
      const bi = me.bench.findIndex(c => c.id === a.benchId);
      if (bi < 0) return { ok: false, error: 'That card is not on your bench.' };
      const inc = me.bench[bi];
      if (inc.grp !== slotGroup(slot)) return { ok: false, error: slotGroup(slot) === 'FC' ? 'Frontcourt players can only be swapped with frontcourt players.' : 'Backcourt players can only be swapped with backcourt players.' };
      if (broken(inc)) return { ok: false, error: `${inc.name} is still recovering a 0 defense.` };
      const out = me.field[slot];
      me.field[slot] = inc;
      me.bench[bi] = out;
      ev.push({ e: 'swap', p, slot, forced: isForced });
      log(s, p, 'sub', isForced ? `${out.name} has nothing left on defense and goes to the bench.` : `${me.name} made a substitution.`);
      return { ok: true, events: ev };
    }

    if (forced.length && (a.t === 'attack' || a.t === 'end')) return { ok: false, error: `${me.field[forced[0]].name} has 0 defense and must be subbed out first.` };

    if (a.t === 'attack') {
      if (s.attacked) return { ok: false, error: 'You already attacked this turn.' };
      const slot = a.slot | 0, target = a.target | 0, kind = a.kind === 'outside' ? 'outside' : 'inside';
      const atk = me.field[slot], def = op.field[target];
      if (!atk) return { ok: false, error: 'Choose one of your starters to attack with.' };
      if (!def) return { ok: false, error: 'Choose an opponent card to attack.' };
      if (atk.sta <= 0) return { ok: false, error: `${atk.name} is out of stamina.` };
      atk.revealed = true; def.revealed = true;
      const sk = kind === 'inside' ? 'ins' : 'out', dk = kind === 'inside' ? 'idef' : 'odef';
      const av = atk[sk], dv = def[dk];
      const evA = { e: 'attack', p, slot, target, kind, atkVal: av, defVal: dv, atk: copy(atk), def: copy(def) };
      s.attacked = true;
      const label = kind === 'inside' ? 'inside' : 'outside';
      if (av > dv) {
        // The difference hits HP and comes off the defender's rating for that shot type.
        // A defender already at 0 is wide open: the full attack goes to HP.
        const dmg = av - dv, open = dv === 0;
        op.hp = Math.max(0, op.hp - dmg);
        def[dk] = Math.max(Math.min(DEF_FLOOR, dv), dv - dmg);
        s.subOk = true; // successful attack opens subs for the rest of this turn
        Object.assign(evA, { result: 'score', dmg, open, hpAfter: op.hp, defAfter: def[dk] });
        log(s, p, 'score', open
          ? `${atk.name} found ${def.name} wide open ${label}. ${dmg} straight to ${op.name}'s HP.`
          : `${atk.name} scored ${label} on ${def.name} (${av} vs ${dv}). ${dmg} damage. ${def.name}'s ${label} defense drops to ${def[dk]}.`);
      } else if (av < dv) {
        const diff = dv - av;
        atk[sk] = Math.max(0, atk[sk] - diff);
        s.earnedSub = true; // successful defense opens subs on the defender's next turn
        Object.assign(evA, { result: 'blocked', diff });
        log(s, p, 'block', `${def.name} shut down ${atk.name}'s ${label} attack (${av} vs ${dv}). ${atk.name} loses ${diff} ${label} scoring.`);
      } else {
        Object.assign(evA, { result: 'tie' });
        log(s, p, 'tie', `${atk.name} and ${def.name} cancel out at ${av}.`);
      }
      atk.sta -= 1;
      STATS.forEach(k => { atk[k] = Math.round(atk[k] * FATIGUE); });
      ['idef', 'odef'].forEach(k => { atk[k] = Math.max(atk[k], Math.min(DEF_FLOOR, evA.atk[k])); });
      Object.assign(evA, { sta: atk.sta, statAfter: atk[sk] });
      ev.push(evA);
      if (op.hp <= 0) {
        s.phase = 'over'; s.winner = p;
        ev.push({ e: 'over', winner: p });
        log(s, p, 'info', `${me.name} wins.`);
      }
      return { ok: true, events: ev };
    }

    if (a.t === 'end') {
      rest(me);
      if (!canAttack(me) && !canAttack(op)) {
        // Nobody on court can attack, so nobody can earn a sub: higher HP takes it, equal HP is a draw (winner -1).
        s.phase = 'over'; s.winner = me.hp > op.hp ? p : op.hp > me.hp ? 1 - p : -1;
        ev.push({ e: 'over', winner: s.winner });
        log(s, p, 'info', s.winner < 0 ? 'Both teams are out of stamina. It ends in a draw.' : `Both teams are out of stamina. ${s.players[s.winner].name} wins on HP.`);
        return { ok: true, events: ev };
      }
      s.turn = 1 - p; s.attacked = false; s.turnNo++;
      s.subOk = !!s.earnedSub; s.earnedSub = false;
      ev.push({ e: 'turn', p: s.turn });
      return { ok: true, events: ev };
    }

    return { ok: false, error: 'Unknown action.' };
  }

  function viewFor(s, p) {
    const me = s.players[p], op = s.players[1 - p];
    const masked = c => (c.revealed ? copy(c) : { id: c.id, hidden: true, sta: c.sta });
    const mine = s.phase === 'play' && s.turn === p;
    return {
      you: p, phase: s.phase, turn: s.turn, myTurn: s.turn === p, attacked: s.attacked,
      subOk: mine && !!s.subOk, mustSub: mine ? mustSub(me) : [],
      turnNo: s.turnNo, winner: s.winner, hpMax: s.hpMax,
      me: { name: me.name, hp: me.hp, ready: me.ready, field: me.field.map(copy), bench: me.bench.map(copy) },
      opp: {
        name: op.name, hp: op.hp, ready: op.ready,
        field: op.field.map(c => (c ? masked(c) : null)),
        bench: s.phase === 'setup' ? [] : op.bench.map(masked)
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
  function autoLineup(deck) {
    const five = bestFive(deck), rest = deck.filter(c => !five.includes(c)).sort(byValue);
    const bench = [...rest.filter(c => c.grp === 'FC').slice(0, BENCH_FC), ...rest.filter(c => c.grp === 'BC').slice(0, BENCH - BENCH_FC)];
    return { ids: five.map(c => c.id), bench: bench.map(c => c.id) };
  }
  // Best healthy bench replacement for a slot.
  const benchFor = (pl, slot) => pl.bench.filter(b => b.grp === slotGroup(slot) && !broken(b)).sort((a, b) => b.sta - a.sta || byValue(a, b))[0];

  function botStep(s, p) {
    const me = s.players[p], op = s.players[1 - p];
    if (s.phase === 'setup') {
      if (me.ready) return null;
      return Object.assign({ t: 'lineup' }, autoLineup(me.bench));
    }
    if (s.phase !== 'play' || s.turn !== p) return null;
    const forced = mustSub(me);
    if (forced.length) return { t: 'swap', slot: forced[0], benchId: benchFor(me, forced[0]).id };
    if (s.subOk) {
      // Rest tired starters when a fresher bench player is available.
      for (let i = 0; i < FIELD; i++) {
        const c = me.field[i], b = benchFor(me, i);
        if (c && b && c.sta <= 2 && b.sta >= c.sta + 2) return { t: 'swap', slot: i, benchId: b.id };
      }
    }
    if (!s.attacked) {
      let best = null;
      me.field.forEach((a, i) => {
        if (!a || a.sta <= 0) return;
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

  return { ROSTER, GROUP, createGame, apply, viewFor, botStep, bestFive, autoLineup, slotGroup, makeCard, makeDeck, clampHp, FIELD, FRONT, DECK, BENCH, BENCH_FC, STAMINA, DEF_FLOOR };
});
