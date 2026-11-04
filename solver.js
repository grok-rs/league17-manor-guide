/* Модель часов поместья Орлуа и поиск кратчайшего маршрута (Дейкстра).
 * Состояние: (клетка, смещение стрелок 0..23, была ли хоть одна победа
 * после последнего сброса). Цена: сперва победы над Коршаком, затем клики. */
(function (root) {
  'use strict';
  const OUT = 'out';
  const SQUARES = {
    out:    {name: 'Гавань', short: 'Гавань', step: 0, x: 110, y: 310, level: 'город'},
    hall:   {name: 'Холл', short: 'Холл', step: 6, x: 450, y: 330, level: '1 этаж'},
    din:    {name: 'Столовая', short: 'Столовая', step: 8, x: 90, y: 420, level: '1 этаж'},
    liv:    {name: 'Гостиная', short: 'Гостиная', step: 8, x: 810, y: 420, level: '1 этаж'},
    kit:    {name: 'Кухня', short: 'Кухня', step: 4, x: 270, y: 420, level: '1 этаж'},
    serv:   {name: 'Комната для прислуги', short: 'Прислуга', step: 4, x: 630, y: 420, level: '1 этаж'},
    closet: {name: 'Чулан', short: 'Чулан', step: 2, x: 450, y: 425, level: '1 этаж'},
    cor1:   {name: 'Коридор (1 этаж)', short: 'Коридор 1', step: 3, x: 450, y: 510, level: '1 этаж'},
    base:   {name: 'Подвал', short: 'Подвал', step: 4, x: 450, y: 600, level: 'подвал'},
    pantry: {name: 'Кладовая', short: 'Кладовая', step: 2, x: 450, y: 685, level: 'подвал'},
    cor2:   {name: 'Коридор (2 этаж)', short: 'Коридор 2', step: 6, x: 450, y: 225, level: '2 этаж'},
    balc:   {name: 'Балкон', short: 'Балкон', step: 8, x: 90, y: 125, level: '2 этаж'},
    bed:    {name: 'Спальня', short: 'Спальня', step: 4, x: 270, y: 125, level: '2 этаж', unsure: true},
    fire:   {name: 'Каминный зал', short: 'Камин. зал', step: 3, x: 450, y: 125, level: '2 этаж'},
    study:  {name: 'Кабинет', short: 'Кабинет', step: 4, x: 630, y: 125, level: '2 этаж'},
    terr:   {name: 'Летняя терраса', short: 'Терраса', step: 8, x: 810, y: 125, level: '2 этаж'},
    attic:  {name: 'Чердак', short: 'Чердак', step: 2, x: 450, y: 40, level: 'чердак'},
  };
  /* Двери: откуда -> {куда: начальный час на циферблате}. */
  const DOORS = {
    hall:   {din: 12, liv: 12, kit: 6, serv: 6},
    cor2:   {balc: 12, terr: 12, bed: 6, fire: 6, study: 6},
    din:    {hall: 16, kit: 8},
    liv:    {hall: 0, serv: 8},
    kit:    {hall: 12, din: 16, cor1: 8, base: 4},
    serv:   {hall: 12, liv: 16, cor1: 8, base: 4},
    base:   {kit: 12, serv: 12, pantry: 4},
    pantry: {base: 4},
    cor1:   {kit: 9, serv: 9, closet: 3},
    closet: {cor1: 4},
    balc:   {cor2: 16, bed: 8},
    terr:   {cor2: 16, study: 8},
    study:  {cor2: 12, terr: 16, fire: 8},
    bed:    {cor2: 12, balc: 16},
    fire:   {cor2: 12, study: 9, attic: 6},
    attic:  {fire: 4},
  };
  const KILL = 1000, CLICK = {door: 1, stairs: 1, exit: 2, teleport: 3, walkin: 2};
  const mod24 = n => ((n % 24) + 24) % 24;
  const reading = (start, off) => mod24(start + off);
  /* Дверь со стартом 00:00 при нулевом смещении закрыта: стрелки должны прийти к полуночи. */
  const isOpen = (start, off, turned) => reading(start, off) === 0 && (start !== 0 || turned);
  /* Сколько побед на клетке откроют дверь; null — при таком смещении никогда. */
  function killsToOpen(sq, start, off, turned) {
    if (isOpen(start, off, turned)) return 0;
    const step = SQUARES[sq].step;
    if (!step) return null;
    for (let k = 1, o = off; k <= 24; k++) { o = mod24(o + step); if (reading(start, o) === 0) return k; }
    return null;
  }
  function edges(s, opt) {
    const out = [], {sq, off, turned} = s;
    if (sq === OUT) { out.push({type: 'walkin', to: {sq: 'hall', off, turned}}); return out; }
    out.push({type: 'kill', to: {sq, off: mod24(off + SQUARES[sq].step), turned: 1}});
    const doors = DOORS[sq] || {};
    for (const t of Object.keys(doors)) if (isOpen(doors[t], off, turned)) out.push({type: 'door', to: {sq: t, off: 0, turned: 0}});
    if (sq === 'hall') { out.push({type: 'stairs', to: {sq: 'cor2', off: 0, turned: 0}}); out.push({type: 'exit', to: {sq: OUT, off, turned}}); }
    if (sq === 'cor2') out.push({type: 'stairs', to: {sq: 'hall', off: 0, turned: 0}});
    if (opt.teleport !== false) out.push({type: 'teleport', to: {sq: OUT, off, turned}});
    return out;
  }
  const keyOf = s => s.sq + '|' + s.off + '|' + (s.turned ? 1 : 0);
  function solve(from, to, off, opt) {
    opt = opt || {};
    const start = {sq: from, off: mod24(off || 0), turned: off || opt.turned ? 1 : 0};
    const dist = new Map([[keyOf(start), 0]]), prev = new Map(), open = [start], done = new Set();
    let goal = null;
    while (open.length) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < open.length; i++) { const d = dist.get(keyOf(open[i])); if (d < bd) { bd = d; bi = i; } }
      const cur = open.splice(bi, 1)[0], ck = keyOf(cur);
      if (done.has(ck)) continue;
      done.add(ck);
      if (cur.sq === to) { goal = cur; break; }
      for (const e of edges(cur, opt)) {
        const w = e.type === 'kill' ? KILL : CLICK[e.type], nk = keyOf(e.to), nd = bd + w;
        if (!dist.has(nk) || nd < dist.get(nk)) { dist.set(nk, nd); prev.set(nk, {from: cur, type: e.type}); open.push(e.to); }
      }
    }
    if (!goal) return null;
    const raw = [];
    for (let s = goal; keyOf(s) !== keyOf(start);) { const p = prev.get(keyOf(s)); raw.unshift({type: p.type, from: p.from, to: s}); s = p.from; }
    const steps = [];
    for (const r of raw) {
      const last = steps[steps.length - 1];
      if (r.type === 'kill' && last && last.type === 'kill') { last.n++; last.offTo = r.to.off; continue; }
      steps.push(r.type === 'kill'
        ? {type: 'kill', at: r.from.sq, n: 1, offFrom: r.from.off, offTo: r.to.off}
        : {type: r.type, from: r.from.sq, to: r.to.sq, off: r.from.off, offAfter: r.to.off});
    }
    const kills = steps.reduce((a, s) => a + (s.type === 'kill' ? s.n : 0), 0);
    return {steps, kills, clicks: raw.length - raw.filter(r => r.type === 'kill').length, teleports: steps.filter(s => s.type === 'teleport').length};
  }
  const api = {SQUARES, DOORS, OUT, reading, isOpen, killsToOpen, solve, mod24};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Manor = api;
})(typeof window !== 'undefined' ? window : globalThis);
