// 三国象棋（三叶六边形盘）规则引擎
// 点编号: id = p*45 + r*9 + (f-1)，p=国家(0魏 1吴 2蜀)，f=路 1..9，r=行 0..4（0=底线，4=河口）
'use strict';

const NAMES = ['魏', '吴', '蜀'];
const id = (p, f, r) => p * 45 + r * 9 + (f - 1);
const P_ = i => Math.floor(i / 45);
const R_ = i => Math.floor((i % 45) / 9);
const F_ = i => (i % 9) + 1;
const Lp = p => (p + 1) % 3; // 左翼对面的国家
const Rp = p => (p + 2) % 3; // 右翼对面的国家
const DIRS = [[1, 0], [-1, 0], [0, -1], [0, 1]]; // 前 后 左 右 (dr, df)，以该点所属国家的视角
const NEG = [1, 0, 3, 2];
const PERP = [[2, 3], [2, 3], [0, 1], [0, 1]];
const EMPTY = 0, K = 1, A = 2, E = 3, H = 4, R = 5, C = 6, P = 7;
const PNAME = ['', '帅', '仕', '象', '马', '车', '炮', '兵'];
const VAL = [0, 0, 2, 2, 4, 9, 4.5, 1];
const inPalace = i => { const f = F_(i), r = R_(i); return f >= 4 && f <= 6 && r <= 2; };

// 正交一步：返回 [[目标点, 到达后的方向]]，在中原河口向前有两个分支
function step(i, d) {
  const p = P_(i), f = F_(i), r = R_(i);
  const nf = f + DIRS[d][1], nr = r + DIRS[d][0];
  if (nf < 1 || nf > 9 || nr < 0) return [];
  if (nr <= 4) return [[id(p, nf, nr), d]];
  if (f < 5) return [[id(Lp(p), 10 - f, 4), NEG[d]]];
  if (f > 5) return [[id(Rp(p), 10 - f, 4), NEG[d]]];
  return [[id(Lp(p), 5, 4), NEG[d]], [id(Rp(p), 5, 4), NEG[d]]];
}
const xf = (from, to, d) => (P_(from) !== P_(to) ? NEG[d] : d);

function walk(i, d) {
  const nx = step(i, d);
  if (!nx.length) return [[]];
  const res = [];
  for (const [t, nd] of nx) for (const rest of walk(t, nd)) res.push([t, ...rest]);
  return res;
}

// 预计算
const STEP = [], RAYS = [], HORSE = [], ELE = [], ADV = [], KING = [];
for (let i = 0; i < 135; i++) {
  STEP[i] = [0, 1, 2, 3].map(d => step(i, d));
  RAYS[i] = [];
  for (let d = 0; d < 4; d++) for (const ray of walk(i, d)) if (ray.length) RAYS[i].push(ray);
  // 马：一步直到马腿，再斜一步；两种走法到达同一点才算（中原三角不是格子，不能斜穿）
  const hs = new Map();
  for (let d = 0; d < 4; d++) for (const [leg, dl] of STEP[i][d]) for (const e0 of PERP[d]) {
    const e = xf(i, leg, e0);
    const s1 = new Set(), s2 = new Set();
    for (const [a] of step(leg, dl)) for (const [t] of step(a, xf(leg, a, e))) s1.add(t);
    for (const [b] of step(leg, e)) for (const [t] of step(b, xf(leg, b, dl))) s2.add(t);
    for (const t of s1) if (s2.has(t)) hs.set(leg * 1000 + t, { leg, to: t });
  }
  HORSE[i] = [...hs.values()];
  const p = P_(i), f = F_(i), r = R_(i);
  ELE[i] = []; ADV[i] = []; KING[i] = [];
  for (const [dr, df] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nf = f + 2 * df, nr = r + 2 * dr;
    if (nf >= 1 && nf <= 9 && nr >= 0 && nr <= 4) ELE[i].push({ eye: id(p, f + df, r + dr), to: id(p, nf, nr) });
    const af = f + df, ar = r + dr;
    if (inPalace(i) && af >= 4 && af <= 6 && ar >= 0 && ar <= 2) ADV[i].push(id(p, af, ar));
  }
  if (inPalace(i)) for (const arr of STEP[i]) for (const [t] of arr) if (P_(t) === p && inPalace(t)) KING[i].push(t);
}
// 绕过中原三角的马步只有单向成立，去掉，保证马的跳法双向对称
{
  const raw = HORSE.map(l => l.slice());
  for (let i = 0; i < 135; i++) HORSE[i] = raw[i].filter(({ to }) => raw[to].some(h => h.to === i));
}
const isTri = i => F_(i) === 5 && R_(i) === 4;

class Game {
  constructor(opts = {}) {
    this.absorb = opts.absorb !== false; // true=吞并，false=出局方棋子全部移除
    this.fly = opts.fly !== false;       // 是否保留飞将
    this.split = !!opts.split;           // 瓜分：降兵按位置分给两家
    this.freeze = !!opts.freeze;         // 降兵整编：吞并来的子在吃帅者的下一回合不能动
    this.frozen = new Uint8Array(135); this.freezeOwner = -1;
    this.score = [0, 0, 0];              // 计分：吃掉的子的分值，吃帅另加 10
    this.type = new Int8Array(135); this.own = new Int8Array(135).fill(-1);
    this.alive = [true, true, true];
    this.turn = 0; this.ply = 0;
    const back = [R, H, E, A, K, A, E, H, R];
    for (let p = 0; p < 3; p++) {
      back.forEach((t, k) => this.put(id(p, k + 1, 0), t, p));
      this.put(id(p, 2, 2), C, p); this.put(id(p, 8, 2), C, p);
      for (const f of [1, 3, 5, 7, 9]) this.put(id(p, f, 3), P, p);
    }
  }
  put(i, t, p) { this.type[i] = t; this.own[i] = p; }
  // 瓜分：在死者左翼的子归左邻、右翼归右邻、中路归吃帅者；已打进别家的子归那一家
  heir(i, victim, killer) {
    const h = P_(i);
    if (h !== victim) return this.alive[h] ? h : killer;
    const f = F_(i);
    const q = f < 5 ? Lp(victim) : f > 5 ? Rp(victim) : killer;
    return this.alive[q] ? q : killer;
  }
  aliveCount() { return this.alive.filter(Boolean).length; }
  nextAlive(p) { for (let k = 1; k <= 3; k++) { const q = (p + k) % 3; if (this.alive[q]) return q; } return p; }

  gen(pl, capsOnly = false) {
    const out = [], seen = new Set(), T = this.type, O = this.own;
    const add = (from, to) => {
      const k = from * 1000 + to; if (seen.has(k)) return; seen.add(k);
      if (capsOnly && T[to] === EMPTY) return;
      out.push({ from, to, cap: T[to], mover: pl });
    };
    for (let i = 0; i < 135; i++) {
      if (O[i] !== pl || this.frozen[i]) continue;
      const t = T[i];
      if (t === R) {
        for (const ray of RAYS[i]) for (const s of ray) { if (T[s] === EMPTY) add(i, s); else { if (O[s] !== pl) add(i, s); break; } }
      } else if (t === C) {
        for (const ray of RAYS[i]) {
          let screen = false;
          for (const s of ray) {
            if (!screen) { if (T[s] === EMPTY) add(i, s); else screen = true; }
            else if (T[s] !== EMPTY) { if (O[s] !== pl) add(i, s); break; }
          }
        }
      } else if (t === H) {
        for (const { leg, to } of HORSE[i]) if (T[leg] === EMPTY && O[to] !== pl) add(i, to);
      } else if (t === E) {
        if (P_(i) === pl) for (const { eye, to } of ELE[i]) if (T[eye] === EMPTY && O[to] !== pl) add(i, to);
      } else if (t === A) {
        if (P_(i) === pl) for (const to of ADV[i]) if (O[to] !== pl) add(i, to);
      } else if (t === K) {
        for (const to of KING[i]) if (O[to] !== pl) add(i, to);
        // 飞将：同一直线上中间无子即可直接吃对方帅
        if (this.fly) for (const ray of RAYS[i]) for (const s of ray) { if (T[s] !== EMPTY) { if (T[s] === K && O[s] !== pl) add(i, s); break; } }
      } else if (t === P) {
        const dirs = P_(i) === pl ? [0] : [1, 2, 3];
        for (const d of dirs) for (const [s] of STEP[i][d]) if (O[s] !== pl) add(i, s);
      }
    }
    return out;
  }

  make(m) {
    const u = { m, prevTurn: this.turn, changes: null, elim: -1, frozen: this.frozen.slice(), freezeOwner: this.freezeOwner, score: this.score.slice() };
    if (m.cap !== EMPTY) this.score[m.mover] += m.cap === K ? 10 : VAL[m.cap];
    // 吃帅者又走了一步：整编结束
    if (this.freezeOwner === m.mover) { this.frozen.fill(0); this.freezeOwner = -1; }
    this.frozen[m.to] = 0;
    const victim = this.own[m.to];
    this.type[m.to] = this.type[m.from]; this.own[m.to] = this.own[m.from];
    this.type[m.from] = EMPTY; this.own[m.from] = -1;
    if (m.cap === K) {
      u.elim = victim; this.alive[victim] = false; u.changes = [];
      for (let i = 0; i < 135; i++) if (this.own[i] === victim) {
        u.changes.push([i, this.type[i], victim]);
        const t = this.type[i];
        if (this.absorb && (t === R || t === H || t === C || t === P)) {
          this.own[i] = this.split ? this.heir(i, victim, m.mover) : m.mover;
          if (this.freeze) { this.frozen[i] = 1; this.freezeOwner = m.mover; }
        }
        else { this.type[i] = EMPTY; this.own[i] = -1; }
      }
    }
    this.ply++; this.turn = this.nextAlive(m.mover);
    return u;
  }
  unmake(u) {
    const m = u.m;
    this.frozen = u.frozen; this.freezeOwner = u.freezeOwner; this.score = u.score;
    if (u.changes) { for (const [i, t, p] of u.changes) { this.type[i] = t; this.own[i] = p; } this.alive[u.elim] = true; }
    this.type[m.from] = this.type[m.to]; this.own[m.from] = m.mover;
    if (m.cap !== EMPTY) { this.type[m.to] = m.cap; this.own[m.to] = u.capOwner; } else { this.type[m.to] = EMPTY; this.own[m.to] = -1; }
    this.ply--; this.turn = u.prevTurn;
  }
  material() {
    const mat = [0, 0, 0];
    for (let i = 0; i < 135; i++) {
      const p = this.own[i]; if (p < 0) continue;
      const t = this.type[i];
      mat[p] += t === P && P_(i) !== p ? 2 : VAL[t];
    }
    return mat;
  }
}
// make 需要记录被吃子的所属
const _make = Game.prototype.make;
Game.prototype.make = function (m) { const co = this.own[m.to]; const u = _make.call(this, m); u.capOwner = co; return u; };

module.exports = { Game, id, P_, R_, F_, Lp, Rp, STEP, RAYS, HORSE, ELE, ADV, KING, isTri, NAMES, PNAME, VAL, EMPTY, K, A, E, H, R, C, P };
