'use strict';
const X = require('./engine');
const { Game, id, P_, F_, R_, HORSE, RAYS, STEP, NAMES } = X;
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const nm = i => `${NAMES[P_(i)]}${F_(i)}路${R_(i)}行`;

// 1. 邻接对称：a 能一步到 b，则 b 也能一步回到 a
let sym = true;
for (let i = 0; i < 135; i++) for (let d = 0; d < 4; d++) for (const [t] of STEP[i][d]) {
  if (!STEP[t].some(arr => arr.some(([u]) => u === i))) { sym = false; console.log('asym', nm(i), nm(t)); }
}
ok(sym, '所有相邻关系双向对称');

// 2. 开局三家着法数相同，且与普通象棋开局(44)对比
const g = new Game();
const counts = [0, 1, 2].map(p => g.gen(p).length);
ok(counts[0] === counts[1] && counts[1] === counts[2], `开局着法数三家相同: ${counts}`);

// 3. 中原：车从中路冲出可以进入两家的中路
const g2 = new Game();
for (let i = 0; i < 135; i++) { g2.type[i] = 0; g2.own[i] = -1; }
g2.put(id(0, 5, 2), X.R, 0);
const tos = g2.gen(0).map(m => m.to);
ok(tos.includes(id(1, 5, 0)) && tos.includes(id(2, 5, 0)), '车经中原可直达左右两家底线中点');
ok(tos.length === 22, `空盘中路车着法数=${tos.length}（期望 22：后2 前2 两家中路各5 横8）`);

// 4. 马在中原附近：经三角相邻的格子仍是正常四边形
const hm = HORSE[id(0, 5, 3)].map(h => nm(h.to)).sort();
console.log('     魏5路3行的马可跳到:', hm.join(' '));
ok(HORSE[id(0, 5, 3)].length === 8, '中路兵位的马有 8 个落点（含跨河进入两家各 1）');

// 5. 马的跳法对称
let hsym = true;
for (let i = 0; i < 135; i++) for (const { to } of HORSE[i]) if (!HORSE[to].some(h => h.to === i)) hsym = false;
ok(hsym, '马的跳法双向对称');

// 6. 随机对局 make/unmake 还原一致
let same = true;
for (let gi = 0; gi < 200 && same; gi++) {
  const gg = new Game();
  const snap = () => gg.type.join() + '|' + gg.own.join() + '|' + gg.alive.join() + gg.turn;
  for (let k = 0; k < 300 && gg.aliveCount() > 1; k++) {
    const ms = gg.gen(gg.turn); if (!ms.length) break;
    const m = ms[Math.floor(Math.random() * ms.length)];
    const s0 = snap(); const u = gg.make(m); gg.unmake(u);
    if (snap() !== s0) { same = false; break; }
    gg.make(m);
  }
}
ok(same, '随机 200 局悔棋还原一致');

// 7. 飞将：中路清空时两帅隔中原照面
const g3 = new Game();
for (let i = 0; i < 135; i++) { g3.type[i] = 0; g3.own[i] = -1; }
g3.put(id(0, 5, 0), X.K, 0); g3.put(id(1, 5, 1), X.K, 1); g3.put(id(2, 5, 0), X.K, 2); g3.put(id(2, 5, 3), X.P, 2);
const kt = g3.gen(0).map(m => m.to);
ok(kt.includes(id(1, 5, 1)) && !kt.includes(id(2, 5, 0)), '飞将经中原成立，中间有子则不成立');

process.exit(fail ? 1 : 0);
