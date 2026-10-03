'use strict';
// 用法: node analyze.js 文件1.jsonl 文件2.jsonl ...
const fs = require('fs');
const games = process.argv.slice(2).flatMap(f => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse));
const n = games.length;
const pct = (a, b = n) => (b ? (100 * a / b).toFixed(1) + '%' : '-');
const avg = a => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-');
const NAMES = ['魏(先手)', '吴(第二)', '蜀(第三)'];
const wins = [0, 0, 0]; let draws = 0;
for (const g of games) if (g.winner >= 0) wins[g.winner]++; else draws++;
console.log(`对局数 ${n}，规则 ${[...new Set(games.map(g => g.variant))]}，搜索深度 ${[...new Set(games.map(g => g.depth))]}`);
console.log('胜率:', NAMES.map((s, i) => `${s} ${pct(wins[i])}`).join('  '), ` 和棋 ${pct(draws)}`);
console.log('平均步数(每人每步算1):', avg(games.map(g => g.plies)), ' 平均吃子数:', avg(games.map(g => g.ncaps)));
const e1 = games.filter(g => g.elims.length);
console.log('出现第一次吃帅的局:', pct(e1.length), ' 第一次吃帅平均在第', avg(e1.map(g => g.elims[0].ply)), '步');
const firstVictim = [0, 0, 0]; e1.forEach(g => firstVictim[g.elims[0].victim]++);
console.log('第一个出局的是:', NAMES.map((s, i) => `${s} ${pct(firstVictim[i], e1.length)}`).join('  '));
const decided = e1.filter(g => g.winner >= 0);
const killerWins = decided.filter(g => g.winner === g.elims[0].killer).length;
const thirdWins = decided.filter(g => g.winner !== g.elims[0].killer).length;
console.log(`第一个吃帅的人最终获胜: ${pct(killerWins, decided.length)}   没参与第一次吃帅的第三方获胜: ${pct(thirdWins, decided.length)}`);
// 捡漏：吃帅者对被吃方造成的子力损失少于另一家
let vult = 0, gang = 0, tot = 0;
for (const g of e1) {
  const { killer, victim, dmg } = g.elims[0];
  const other = [0, 1, 2].find(p => p !== killer && p !== victim);
  const total = dmg[killer] + dmg[other];
  tot++;
  if (dmg[other] > dmg[killer]) vult++;
  if (total > 0 && dmg[other] / total >= 0.3 && dmg[killer] / total >= 0.3) gang++;
}
console.log(`第一次吃帅是"捡漏"(吃帅者打掉的子比另一家少): ${pct(vult, tot)}   被两家合围(两家各打掉≥30%): ${pct(gang, tot)}`);
const by = {}; e1.forEach(g => { by[g.elims[0].by] = (by[g.elims[0].by] || 0) + 1; });
console.log('吃帅的棋子:', Object.entries(by).map(([k, v]) => `${k} ${pct(v, e1.length)}`).join('  '));
console.log('平均每局穿越中原的着法:', avg(games.map(g => g.triCross)), ' 其中吃子:', avg(games.map(g => g.triCrossCap)), ' 飞将吃帅总次数:', games.reduce((s, g) => s + g.flying, 0));
console.log('开局第一步就吃子的局:', pct(games.filter(g => g.firstCapPly === 0).length));
const sc = games.filter(g => g.result === 'score').length;
console.log(`吃光对手获胜: ${pct(games.filter(g => g.result === 'win').length)}  靠计分获胜: ${pct(sc)}  因 150 步无吃子而终局: ${pct(games.filter(g => g.stalled).length)}（三家都活着: ${pct(games.filter(g => g.stalled && g.alive.length === 3).length)}）`);
// 和棋时的子力
const dr = games.filter(g => g.result === 'draw');
if (dr.length) console.log('和棋局存活人数分布:', [1, 2, 3].map(k => `${k}人 ${dr.filter(g => g.alive.length === k).length}`).join(' '));
