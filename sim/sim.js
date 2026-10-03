'use strict';
// 自对弈：Best-Reply Search（三人博弈常用的搜索法：我走一步，再假设"所有对手中最狠的那一步"，再我走）
const X = require('./engine');
const { Game, P_, F_, VAL, K, EMPTY } = X;

const [, , variant = 'absorb', N = '20', seed = '1', depthArg = '3', plyLimit = '600'] = process.argv;
let rs = Number(seed) * 2654435761 >>> 0;
const rand = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };

const WIN = 100000;
function evalFor(g, me) {
  if (!g.alive[me]) return -WIN;
  if (g.aliveCount() === 1) return WIN;
  const mat = g.material();
  let opp = 0, n = 0;
  for (let p = 0; p < 3; p++) if (p !== me && g.alive[p]) { opp += mat[p]; n++; }
  let v = mat[me] - opp / n;
  // 计分规则下，AI 也想多吃子拿分（终局按分排名）
  if (SCORE) { let best = 0; for (let p = 0; p < 3; p++) if (p !== me && g.alive[p]) best = Math.max(best, g.score[p]); v += g.score[me] - best; }
  return v;
}
const SCORE = variant.includes('score');
const order = ms => ms.sort((a, b) => (b.cap === K ? 1000 : VAL[b.cap] * 10) - (a.cap === K ? 1000 : VAL[a.cap] * 10));
function movesFor(g, me, isMax, caps) {
  if (isMax) return g.gen(me, caps);
  let ms = [];
  for (let p = 0; p < 3; p++) if (p !== me && g.alive[p]) ms = ms.concat(g.gen(p, caps));
  return ms;
}
let nodes = 0;
function qs(g, me, a, b, isMax, d) {
  nodes++;
  const sp = evalFor(g, me);
  if (Math.abs(sp) >= WIN || d === 0) return sp;
  if (isMax) { if (sp >= b) return sp; if (sp > a) a = sp; } else { if (sp <= a) return sp; if (sp < b) b = sp; }
  let best = sp;
  for (const m of order(movesFor(g, me, isMax, true))) {
    const u = g.make(m); const v = qs(g, me, a, b, !isMax, d - 1); g.unmake(u);
    if (isMax) { if (v > best) best = v; if (v > a) a = v; } else { if (v < best) best = v; if (v < b) b = v; }
    if (a >= b) break;
  }
  return best;
}
function search(g, me, depth, a, b, isMax) {
  nodes++;
  if (!g.alive[me]) return -WIN - depth;
  if (g.aliveCount() === 1) return WIN + depth;
  if (depth === 0) return qs(g, me, a, b, isMax, 4);
  const ms = order(movesFor(g, me, isMax, false));
  if (!ms.length) return evalFor(g, me);
  let best = isMax ? -Infinity : Infinity;
  for (const m of ms) {
    const u = g.make(m); const v = search(g, me, depth - 1, a, b, !isMax); g.unmake(u);
    if (isMax) { if (v > best) best = v; if (v > a) a = v; } else { if (v < best) best = v; if (v < b) b = v; }
    if (a >= b) break;
  }
  return best;
}
function choose(g, me, depth) {
  const ms = order(g.gen(me));
  if (!ms.length) return null;
  const scored = [];
  for (const m of ms) {
    const u = g.make(m); const v = search(g, me, depth - 1, -Infinity, Infinity, false); g.unmake(u);
    scored.push([v + rand() * 0.01, m]);
  }
  scored.sort((x, y) => y[0] - x[0]);
  const margin = g.ply < 9 ? 1.0 : 0.25;
  const pool = scored.filter(s => s[0] >= scored[0][0] - margin);
  return pool[Math.floor(rand() * pool.length)][1];
}

function playGame(depth) {
  const g = new Game({ absorb: variant !== 'remove', fly: !variant.includes('nofly'), split: variant.includes('split'), freeze: variant.includes('freeze') });
  const damage = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; // damage[打人者][被打者]
  const caps = [], elims = [];
  let lastCap = 0, triCross = 0, triCrossCap = 0, flying = 0, noMove = 0;
  const t0 = Date.now();
  while (g.aliveCount() > 1 && g.ply < Number(plyLimit) && g.ply - lastCap < 150) {
    const me = g.turn;
    const m = choose(g, me, depth);
    if (!m) { noMove++; g.turn = g.nextAlive(me); g.ply++; continue; }
    const pt = g.type[m.from];
    const crossesTri = F_(m.from) === 5 && F_(m.to) === 5 && P_(m.from) !== P_(m.to);
    if (crossesTri) { triCross++; if (m.cap) triCrossCap++; }
    if (m.cap) {
      const victim = g.own[m.to];
      const val = m.cap === K ? 0 : VAL[m.cap];
      damage[me][victim] += val; lastCap = g.ply;
      caps.push([g.ply, me, victim, m.cap]);
      if (m.cap === K) { if (pt === K) flying++; elims.push({ ply: g.ply, killer: me, victim, by: X.PNAME[pt], dmg: damage.map(r => r[victim]) }); }
    }
    g.make(m);
  }
  const alive = [0, 1, 2].filter(p => g.alive[p]);
  const mat = g.material();
  const stalled = alive.length > 1 && g.ply - lastCap >= 150;
  let result = alive.length === 1 ? 'win' : 'draw', winner = alive.length === 1 ? alive[0] : -1;
  if (SCORE && alive.length > 1) {
    const top = Math.max(...alive.map(p => g.score[p]));
    const tops = alive.filter(p => g.score[p] === top);
    if (tops.length === 1) { result = 'score'; winner = tops[0]; }
  }
  return {
    stalled, score: g.score,
    variant, depth, plies: g.ply, ms: Date.now() - t0,
    result, winner,
    alive, mat, elims, damage, triCross, triCrossCap, flying, noMove, ncaps: caps.length,
    firstCapPly: caps.length ? caps[0][0] : -1,
  };
}
for (let k = 0; k < Number(N); k++) {
  nodes = 0;
  const r = playGame(Number(depthArg));
  r.nodes = nodes;
  console.log(JSON.stringify(r));
}
