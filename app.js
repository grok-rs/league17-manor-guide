(function () {
  'use strict';
  const {SQUARES: S, DOORS: D, OUT, reading, isOpen, killsToOpen, solve, mod24} = window.Manor;
  const $ = id => document.getElementById(id);
  const hh = n => String(n).padStart(2, '0') + ':00';
  const keys = Object.keys(S);
  const st = {pos: OUT, off: 0, turned: 0, goal: 'pantry'};
  let route = null;

  const fillRooms = (sel, val) => {
    sel.innerHTML = keys.map(k => `<option value="${k}">${S[k].name}</option>`).join('');
    sel.value = val;
  };
  fillRooms($('from'), st.pos); fillRooms($('to'), st.goal);
  $('hHour').innerHTML = Array.from({length: 24}, (_, h) => `<option value="${h}">${hh(h)}</option>`).join('');

  /* ---- карта ---- */
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent) => { const e = document.createElementNS(NS, name); for (const a in attrs) e.setAttribute(a, attrs[a]); if (parent) parent.appendChild(e); return e; };
  const svg = $('svg'), edgeLayer = el('g', {}, svg), badgeLayer = el('g', {}, svg), nodeLayer = el('g', {}, svg);
  const pairKey = (a, b) => [a, b].sort().join('~');
  const edgeEls = {};
  const addEdge = (a, b, free) => { const k = pairKey(a, b); if (edgeEls[k]) return; edgeEls[k] = el('line', {class: 'edge' + (free ? ' free' : ''), x1: S[a].x, y1: S[a].y, x2: S[b].x, y2: S[b].y}, edgeLayer); };
  for (const a of Object.keys(D)) for (const b of Object.keys(D[a])) addEdge(a, b, false);
  addEdge('hall', 'cor2', true); addEdge('hall', OUT, true);
  const nodeEls = {};
  for (const k of keys) {
    const s = S[k], g = el('g', {class: 'node', tabindex: 0, role: 'button', 'aria-label': s.name}, nodeLayer);
    el('rect', {x: s.x - 70, y: s.y - 23, width: 140, height: 46, rx: 5}, g);
    const t1 = el('text', {class: 'n', x: s.x, y: s.y - 3}, g); t1.textContent = s.short;
    const t2 = el('text', {class: 't', x: s.x, y: s.y + 14}, g); t2.textContent = s.step ? '+' + s.step + ' ч' + (s.unsure ? '?' : '') : 'город';
    const pick = () => { st.goal = k; $('to').value = k; render(); };
    g.addEventListener('click', pick);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    nodeEls[k] = g;
  }

  function drawDial() {
    const d = $('dial'); d.innerHTML = '';
    const c = 60, r = 46, pt = (h, rr) => { const a = (h / 24) * 2 * Math.PI - Math.PI / 2; return [c + rr * Math.cos(a), c + rr * Math.sin(a)]; };
    el('circle', {cx: c, cy: c, r, fill: 'none', stroke: 'currentColor', 'stroke-opacity': .35, 'stroke-width': 1.5}, d);
    const [mx, my] = pt(0, r); el('circle', {cx: mx, cy: my, r: 6, fill: 'var(--brass)'}, d);
    const [hx, hy] = pt(st.off, r - 8); el('line', {x1: c, y1: c, x2: hx, y2: hy, stroke: 'var(--trap)', 'stroke-width': 3, 'stroke-linecap': 'round'}, d);
    const t = el('text', {x: c, y: c + 24, 'text-anchor': 'middle', 'font-size': 15, 'font-family': 'var(--mono)', fill: 'currentColor'}, d);
    t.textContent = '+' + st.off + ' ч';
    d.style.color = 'var(--fg)';
  }

  function routeText(s, i, steps) {
    const nextDoor = steps[i + 1] && steps[i + 1].type === 'door' ? steps[i + 1].to : null;
    switch (s.type) {
      case 'kill': return `${S[s.at].name}: побед над Коршаком ${s.n}, по +${S[s.at].step} ч.` + (nextDoor ? ` Дверь «${S[nextDoor].short}» встанет на 00:00.` : ` Смещение станет +${s.offTo} ч.`);
      case 'door': return `Сразу жмите дверь «${S[s.to].name}». Смещение сбросится.`;
      case 'stairs': return `Лестница: ${S[s.to].name}. Часов на ней нет, смещение сбросится.`;
      case 'exit': return s.off ? `«Выход из поместья». Смещение +${s.off} ч сохранится.` : '«Выход из поместья».';
      case 'teleport': return s.off ? `Телепорт в Гавань. Смещение +${s.off} ч останется с вами.` : 'Телепорт в Гавань.';
      case 'walkin': return s.off ? `Старый квартал, затем Поместье Орлуа. Двери Холла покажут +${s.off} ч.` : 'Старый квартал, затем Поместье Орлуа (Холл).';
    }
  }
  const fmtTime = sec => sec < 60 ? '<1 мин' : Math.round(sec / 60) + ' мин';

  function render() {
    const teleport = $('tp').checked;
    route = st.pos === st.goal ? {steps: [], kills: 0, clicks: 0, teleports: 0} : solve(st.pos, st.goal, st.off, {teleport, turned: st.turned});
    $('from').value = st.pos;
    $('tKills').textContent = route ? route.kills : '—';
    const sec = Math.max(10, +$('sec').value || 140);
    $('tTime').textContent = route ? fmtTime(route.kills * sec + route.clicks * 2) : '—';
    $('tTp').textContent = route ? route.teleports : '—';
    $('steps').innerHTML = !route ? '<li>Пути нет: включите телепорт.</li>'
      : route.steps.length ? route.steps.map((s, i) => `<li><span>${routeText(s, i, route.steps)}</span></li>`).join('')
      : '<li><span>Вы уже на месте.</span></li>';
    const w = $('warn');
    w.hidden = !route || route.kills < 10;
    if (route && route.kills >= 10) w.textContent = 'Длинный путь: начните с полной командой. Без лечения одной команды хватало примерно на 14 побед.';
    $('next').disabled = !route || !route.steps.length;
    renderMap(); renderSim(); renderHelper();
  }

  function renderMap() {
    for (const k of keys) nodeEls[k].setAttribute('class', 'node' + (k === st.pos ? ' here' : '') + (k === st.goal ? ' goal' : ''));
    for (const k in edgeEls) edgeEls[k].classList.remove('route', 'open');
    badgeLayer.innerHTML = '';
    const doors = D[st.pos] || {};
    for (const t of Object.keys(doors)) {
      const open = isOpen(doors[t], st.off, st.turned), r = reading(doors[t], st.off), a = S[st.pos], b = S[t];
      if (open) edgeEls[pairKey(st.pos, t)].classList.add('open');
      const x = a.x + (b.x - a.x) * .55, y = a.y + (b.y - a.y) * .55;
      const g = el('g', {class: 'badge' + (open ? ' open' : '')}, badgeLayer);
      el('rect', {x: x - 21, y: y - 10, width: 42, height: 19, rx: 4}, g);
      const tx = el('text', {x, y: y + 4}, g); tx.textContent = hh(r);
    }
    if (route) for (const s of route.steps) if (s.from && s.to && edgeEls[pairKey(s.from, s.to)]) edgeEls[pairKey(s.from, s.to)].classList.add('route');
  }

  function renderSim() {
    const s = S[st.pos];
    $('sName').textContent = s.name;
    $('sStep').textContent = s.step ? `шаг +${s.step} ч за победу` : 'город, Коршаков нет';
    drawDial();
    $('kill').disabled = !s.step;
    $('kill').textContent = s.step ? `Коршак повержен: +${s.step} ч` : 'Здесь Коршаков нет';
    $('tele').disabled = st.pos === OUT;
    const list = [];
    for (const t of Object.keys(D[st.pos] || {})) {
      const start = D[st.pos][t], open = isOpen(start, st.off, st.turned), k = killsToOpen(st.pos, start, st.off, st.turned);
      const note = open ? 'открыта' : k == null ? `${hh(reading(start, st.off))} · не сойдётся` : `${hh(reading(start, st.off))} · ${k} поб.`;
      list.push(`<li><button type="button" data-to="${t}" class="${open ? 'open' : ''}"><span>${S[t].name}</span><span class="r">${note}</span></button></li>`);
    }
    if (st.pos === 'hall' || st.pos === 'cor2') list.push(`<li><button type="button" data-stairs="1"><span>Лестница</span><span class="r">без часов</span></button></li>`);
    if (st.pos === 'hall') list.push(`<li><button type="button" data-exit="1"><span>Выход из поместья</span><span class="r">без часов</span></button></li>`);
    if (st.pos === OUT) list.push(`<li><button type="button" data-in="1"><span>Войти в поместье (Холл)</span><span class="r">смещение +${st.off}</span></button></li>`);
    $('doors').innerHTML = list.join('');
  }

  function renderHelper() {
    const on = document.querySelector('input[name=clock]:checked').value === 'door';
    $('helper').hidden = !on;
    if (!on) return;
    const doors = D[st.pos] || {}, names = Object.keys(doors), sel = $('hDoor'), prev = sel.value;
    sel.innerHTML = names.map(t => `<option value="${t}">${S[t].name} (старт ${hh(doors[t])})</option>`).join('');
    if (names.includes(prev)) sel.value = prev;
    $('hOut').textContent = names.length ? `Смещение сейчас: +${st.off} ч` : 'На этой клетке нет часов. Выберите «Откуда» внутри поместья.';
  }
  function applyHelper() {
    const start = (D[st.pos] || {})[$('hDoor').value];
    if (start == null) return;
    const h = +$('hHour').value;
    st.off = mod24(h - start); st.turned = st.off ? 1 : 0;
    render();
  }

  const walk = (to, off, turned) => { st.pos = to; st.off = off; st.turned = turned; document.querySelector('input[name=clock][value=zero]').checked = true; render(); };
  const doKill = () => { st.off = mod24(st.off + S[st.pos].step); st.turned = 1; render(); };

  function doNext() {
    const s = route && route.steps[0];
    if (!s) return;
    if (s.type === 'kill') doKill();
    else walk(s.to, s.offAfter, s.offAfter ? 1 : 0);
  }

  $('from').addEventListener('change', e => { st.pos = e.target.value; st.off = 0; st.turned = 0; document.querySelector('input[name=clock][value=zero]').checked = true; render(); });
  $('to').addEventListener('change', e => { st.goal = e.target.value; render(); });
  $('swap').addEventListener('click', () => { const a = st.pos; st.pos = st.goal; st.goal = a; $('to').value = st.goal; st.off = 0; st.turned = 0; render(); });
  document.querySelectorAll('input[name=clock]').forEach(r => r.addEventListener('change', () => { if (r.value === 'zero' && r.checked) { st.off = 0; st.turned = 0; } render(); if (r.value === 'door' && r.checked) applyHelper(); }));
  $('hDoor').addEventListener('change', applyHelper); $('hHour').addEventListener('change', applyHelper);
  $('tp').addEventListener('change', render); $('sec').addEventListener('input', render);
  $('next').addEventListener('click', doNext);
  $('kill').addEventListener('click', doKill);
  $('tele').addEventListener('click', () => walk(OUT, st.off, st.turned));
  $('reset').addEventListener('click', () => walk(OUT, 0, 0));
  $('doors').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.to) { if (b.classList.contains('open')) walk(b.dataset.to, 0, 0); return; }
    if (b.dataset.stairs) return walk(st.pos === 'hall' ? 'cor2' : 'hall', 0, 0);
    if (b.dataset.exit) return walk(OUT, st.off, st.turned);
    if (b.dataset.in) return walk('hall', st.off, st.turned);
  });

  /* ---- таблицы ---- */
  const rooms = keys.filter(k => k !== OUT);
  document.querySelector('#tRooms tbody').innerHTML = rooms.map(k => {
    const to = solve(OUT, k, 0).kills, out = solve(k, OUT, 0, {teleport: false}).kills;
    return `<tr data-k="${k}" tabindex="0"><td>${S[k].name}</td><td class="n">+${S[k].step} ч${S[k].unsure ? '?' : ''}</td><td class="n">${to}</td><td class="n">${out}</td></tr>`;
  }).join('');
  document.querySelector('#tRooms tbody').addEventListener('click', e => {
    const tr = e.target.closest('tr'); if (!tr) return;
    st.goal = tr.dataset.k; $('to').value = st.goal; st.pos = OUT; st.off = 0; st.turned = 0; render();
    $('plan').scrollIntoView({behavior: 'smooth'});
  });
  document.querySelector('#tDoors tbody').innerHTML = Object.keys(D).map(k =>
    `<tr><td>${S[k].name}</td><td>${Object.keys(D[k]).map(t => `${S[t].name} <span class="clock">${hh(D[k][t])}</span>`).join(' · ')}</td></tr>`).join('');

  render();
})();
