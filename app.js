/* Ten Acres: everything on the page is computed from data/bundle.json. */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const h = (tag, cls, html) => { const el = document.createElement(tag); if (cls) el.className = cls; if (html != null) el.innerHTML = html; return el; };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';
  const pctT = (x) => { const v = x * 100; return (v < 10 && v !== 0 ? v.toFixed(1) : v.toFixed(0)) + '%'; };

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON = MONTHS.map((m) => m.slice(0, 3));
  const BANDS = ['12 to 3 am', '3 to 6 am', '6 to 9 am', '9 am to 12 pm', '12 to 3 pm', '3 to 6 pm', '6 to 9 pm', '9 pm to 12 am'];
  const SIZES = ['under 1/4 acre', '1/4 to 1 acre', '1 to 10 acres', 'over 10 acres', 'size not given'];
  const LANDS = ['private land', 'federal land', 'state or local public land', 'land owner not given'];

  function wilson(k, n, z = 1.96) {
    if (!n) return [0, 0, 1];
    const p = k / n, d = 1 + z * z / n;
    const c = (p + z * z / (2 * n)) / d;
    const w = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [p, Math.max(0, c - w), Math.min(1, c + w)];
  }

  fetch('data/bundle.json').then((r) => r.json()).then(init).catch((err) => {
    console.error(err);
    $('#ledger-chart').textContent = 'The data bundle did not load. Try refreshing.';
  });

  function init(B) {
    const M = B.meta;
    const N = M.n;
    const dec = (s) => Uint8Array.from(s, (ch) => ch.charCodeAt(0) - 48);
    const col = { c: dec(B.cols.c), m: dec(B.cols.m), h: dec(B.cols.h), z: dec(B.cols.z), l: dec(B.cols.l), e: dec(B.cols.e) };

    /* tally */
    const T = { n: fmt(N), held: pct(1 - M.escaped / N), esc: fmt(M.escaped), share: pct(M.escAcres / M.acres) };
    document.querySelectorAll('#tally dd').forEach((dd) => { dd.textContent = T[dd.dataset.k]; });

    ledger(B);
    split(B);
    heat(B);
    desk(B, col);
    holdout(M);
  }

  /* 01 ledger */
  function ledger(B) {
    const box = $('#ledger-chart');
    const lo = 0.9, x = (v) => ((v - lo) / (1 - lo)) * 100;
    const rows = h('div', 'lrows');
    const missed = [], met = [];
    B.years.forEach((y) => {
      const r = y.held / y.n;
      (r >= 0.95 ? met : missed).push(y.year);
      const row = h('div', 'lrow');
      row.append(h('span', 'lrow__y', y.year));
      const tr = h('div', 'lrow__track');
      const bar = h('i', 'lrow__bar' + (r < 0.95 ? ' is-miss' : ''));
      bar.style.width = x(r) + '%';
      tr.append(bar);
      if (r < 0.95) { const m = h('i', 'lrow__miss'); m.style.left = x(r) + '%'; m.style.width = (x(0.95) - x(r)) + '%'; tr.append(m); }
      row.append(tr);
      const miss = Math.round(0.95 * y.n) - y.held;
      row.append(h('span', 'lrow__v', `<b>${pct(r)}</b> <span>${r < 0.95 ? `<span class="miss">${fmt(miss)} short</span>` : `of ${fmt(y.n)}`}</span>`));
      rows.append(row);
    });
    box.append(rows);
    const goal = h('i', 'goal', '<span>goal 95%</span>');
    // goal line spans the track column only
    const place = () => {
      const t = rows.querySelector('.lrow__track');
      const bx = box.getBoundingClientRect(), tb = t.getBoundingClientRect();
      goal.style.left = (tb.left - bx.left + tb.width * x(0.95) / 100) + 'px';
      axis.style.marginLeft = (tb.left - bx.left) + 'px';
      axis.style.width = tb.width + 'px';
      axis.style.marginRight = '0';
    };
    box.append(goal);
    const axis = h('div', 'axis');
    [0.9, 0.92, 0.94, 0.96, 0.98, 1].forEach((v) => { const s = h('span', '', Math.round(v * 100) + '%'); s.style.left = x(v) + '%'; axis.append(s); });
    box.append(axis);
    place();
    addEventListener('resize', place);
    if (document.fonts) document.fonts.ready.then(place);
    const list = (a) => a.length === 2 ? `${a[0]} and ${a[1]}` : a.join(', ');
    const miss = B.years.filter((y) => y.held / y.n < 0.95);
    $('#ledger-note').textContent = `In this record the goal was met in ${list(met) || 'no year'} and missed in ${list(missed) || 'no year'}. The misses look small as fire counts, under a hundred fires a year, and large on the ground: ${miss.map((y) => `${y.year}'s escapes burned ${fmt(y.escAcres)} acres`).join(' and ')}.`;
  }

  /* 02 split */
  function split(B) {
    const M = B.meta, box = $('#split');
    const mk = (lab, held, heldTxt, escTxt) => {
      const r = h('div', 'sbar');
      r.append(h('span', 'sbar__lab', lab));
      const tr = h('div', 'sbar__track');
      const a = h('span', 'sbar__seg sbar__seg--held');
      a.style.flex = `0 0 ${held * 100}%`;
      tr.append(a, h('span', 'sbar__seg sbar__seg--esc'));
      const cap = h('div', 'sbar__cap', `<span class="is-held">${heldTxt}</span><span class="is-esc">${escTxt}</span>`);
      const col = h('div', 'sbar__col'); col.append(tr, cap);
      r.append(col); return r;
    };
    const hs = 1 - M.escaped / M.n, as = M.escAcres / M.acres;
    box.append(mk('Fires', hs, `${pct(hs)} held at 10 acres or less`, `${pct(1 - hs)} escaped`));
    box.append(mk('Acres', 1 - as, `${pct(1 - as)} burned by held fires`, `${pct(as)} burned by escapes`));
    const t = B.top[0];
    const d = new Date(t.date + 'T12:00:00');
    $('#conc-note').textContent = `The ${fmt(M.escaped)} escapes burned ${fmt(M.escAcres)} of ${fmt(M.acres)} acres. The ${t.name} Fire alone, reported in ${t.county} County on ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, accounts for ${pct(B.conc['1'], 0)} of every acre in the four years, and the ten largest for ${pct(B.conc['10'], 0)}.`;
    const tb = $('#big-table tbody');
    B.top.forEach((f) => {
      const tr = h('tr');
      const dd = new Date(f.date + 'T12:00:00');
      tr.innerHTML = `<td>${f.name}</td><td>${f.county}</td><td>${MON[dd.getMonth()]} ${dd.getFullYear()}</td><td class="num">${fmt(f.acres)}</td>`;
      tb.append(tr);
    });
  }

  /* 03 heat */
  const STOPS = [[247, 245, 236], [243, 213, 195], [207, 79, 28], [110, 34, 8]];
  function heatColor(r) {
    const t = Math.min(1, r / 0.12) * (STOPS.length - 1);
    const i = Math.min(STOPS.length - 2, Math.floor(t)), f = t - i;
    const c = STOPS[i].map((v, j) => Math.round(v + (STOPS[i + 1][j] - v) * f));
    return `rgb(${c.join(',')})`;
  }
  function heat(B) {
    const box = $('#heat'), read = $('#heat-read');
    box.append(h('span', ''));
    MON.forEach((m) => box.append(h('span', 'heat__m', m[0] + (innerWidth < 820 ? '' : m.slice(1)))));
    const bandShort = ['12-3a', '3-6a', '6-9a', '9a-12p', '12-3p', '3-6p', '6-9p', '9p-12a'];
    for (let b = 0; b < 8; b++) {
      box.append(h('span', 'heat__h', innerWidth < 820 ? bandShort[b] : BANDS[b]));
      for (let m = 0; m < 12; m++) {
        const [n, k] = B.heat[m][b];
        const c = h('button', 'heat__c' + (n < 30 ? ' is-thin' : ''));
        c.type = 'button';
        c.style.background = heatColor(n ? k / n : 0);
        const txt = `${MONTHS[m]}, reported ${BANDS[b]}: ${fmt(k)} of ${fmt(n)} fires escaped${n ? ` (${pct(k / n)})` : ''}${n < 30 ? '. Too few to read.' : '.'}`;
        c.setAttribute('aria-label', txt);
        const show = () => { read.textContent = txt; };
        c.addEventListener('mouseenter', show); c.addEventListener('focus', show);
        box.append(c);
      }
    }
    const key = h('div', 'heat__key');
    key.append(h('span', '', 'escape rate'));
    [0, 0.03, 0.06, 0.09, 0.12].forEach((v) => { const i = h('i'); i.style.background = heatColor(v); key.append(i); key.append(h('span', '', v === 0.12 ? '12%+' : pct(v, 0))); });
    box.append(key);
    // note: afternoon vs overnight across all months
    const sum = (bs) => bs.reduce((a, b) => { for (let m = 0; m < 12; m++) { a[0] += B.heat[m][b][0]; a[1] += B.heat[m][b][1]; } return a; }, [0, 0]);
    const aft = sum([4]), night = sum([0, 1]);
    const summer = [5, 6, 7].reduce((a, m) => { for (let b = 0; b < 8; b++) { a[0] += B.heat[m][b][0]; a[1] += B.heat[m][b][1]; } return a; }, [0, 0]);
    const winter = [11, 0, 1].reduce((a, m) => { for (let b = 0; b < 8; b++) { a[0] += B.heat[m][b][0]; a[1] += B.heat[m][b][1]; } return a; }, [0, 0]);
    $('#heat-note').textContent = `Fires reported between noon and 3 pm escaped at ${pct(aft[1] / aft[0])}, against ${pct(night[1] / night[0])} for fires reported between midnight and 6 am. June through August ran at ${pct(summer[1] / summer[0])}; December through February at ${pct(winter[1] / winter[0])}. The afternoon is when wind, heat and low humidity line up, so the same first call means something different at 2 pm than at 2 am.`;
  }

  /* 04 desk + 05 check */
  function desk(B, col) {
    const M = B.meta, N = M.n, MIN = M.minN;
    const sel = { c: $('#f-county'), m: $('#f-m'), h: $('#f-h'), z: $('#f-z'), l: $('#f-l') };
    const opt = (s, v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.append(o); };
    const counts = new Map();
    for (let i = 0; i < N; i++) counts.set(col.c[i], (counts.get(col.c[i]) || 0) + 1);
    opt(sel.c, '', 'Any county');
    B.counties.forEach((c, i) => { if (c !== 'Unknown') opt(sel.c, i, c); });
    opt(sel.m, '', 'Any month'); MONTHS.forEach((m, i) => opt(sel.m, i, m));
    opt(sel.h, '', 'Any time'); BANDS.forEach((b, i) => opt(sel.h, i, b));
    opt(sel.z, '', 'Any size'); SIZES.slice(0, 4).forEach((s, i) => opt(sel.z, i, s[0].toUpperCase() + s.slice(1)));
    opt(sel.l, '', 'Any land'); LANDS.slice(0, 3).forEach((s, i) => opt(sel.l, i, s[0].toUpperCase() + s.slice(1)));
    // a starting example: an ordinary summer afternoon call
    sel.c.value = String(B.counties.indexOf('Fresno'));
    sel.m.value = '6'; sel.h.value = '4'; sel.z.value = '0'; sel.l.value = '0';

    const ORDER = [
      ['c', (v) => `in ${B.counties[v]} County`],
      ['m', (v) => `reported in ${MONTHS[v]}`],
      ['h', (v) => `reported ${BANDS[v]}`],
      ['z', (v) => `first sized at ${SIZES[v]}`],
      ['l', (v) => `on ${LANDS[v]}`],
    ];
    const escByIdx = new Map(B.escapes.map((e) => [e[0], e]));
    let last = null;
    const claim = $('#claim'), out = $('#claim-out');

    function run() {
      let pool = null; // null = all rows
      const base = wilson(M.escaped, N);
      const rungs = [{ lab: 'All sized California wildfires', k: M.escaped, n: N, ci: base }];
      let stopped = null, skipped = 0;
      for (const [key, label] of ORDER) {
        const v = sel[key].value;
        if (v === '') continue;
        if (stopped) { skipped++; continue; }
        const vv = +v, a = col[key], next = [];
        if (pool === null) { for (let i = 0; i < N; i++) if (a[i] === vv) next.push(i); }
        else for (const i of pool) if (a[i] === vv) next.push(i);
        let k = 0; for (const i of next) k += col.e[i];
        if (next.length < MIN) { stopped = { lab: label(vv), n: next.length, k }; continue; }
        pool = next;
        rungs.push({ lab: label(vv), k, n: next.length, ci: wilson(k, next.length) });
      }
      last = rungs[rungs.length - 1];
      last.pool = pool;
      drawLadder(rungs, stopped, skipped, base);
      drawPrec(pool);
      const cv = sel.c.value;
      const cn = $('#contract-note');
      if (cv !== '' && B.contract.includes(B.counties[+cv])) {
        cn.hidden = false;
        cn.textContent = `${B.counties[+cv]} County runs its own fire department under contract with the state, and few of its small fires carry a size in this record. Its rates lean toward the fires that grew, so read them as an upper bound.`;
      } else cn.hidden = true;
      const parts = ['CA'];
      if (cv !== '') parts.push(B.counties[+cv].slice(0, 3).toUpperCase());
      if (sel.m.value !== '') parts.push(MON[+sel.m.value].toUpperCase());
      if (sel.h.value !== '') parts.push(['0000', '0300', '0600', '0900', '1200', '1500', '1800', '2100'][+sel.h.value]);
      $('#card-id').textContent = parts.join(' / ');
      verdict();
    }

    function drawLadder(rungs, stopped, skipped, base) {
      const box = $('#ladder');
      box.replaceChildren();
      const top = Math.max(...rungs.map((r) => r.ci[2]));
      const max = [0.1, 0.2, 0.3, 0.5, 0.75, 1].find((s) => s >= top) || 1;
      const X = (v) => Math.min(100, (v / max) * 100) + '%';
      const ax = h('div', 'rung rung--axis');
      ax.append(h('span', 'rung__lab', ''));
      const ap = h('div', 'rung__plot');
      for (let i = 0; i <= 5; i++) { const v = (max * i) / 5; const s = h('span', '', pctT(v)); s.style.left = X(v); ap.append(s); }
      ax.append(ap); ax.append(h('span', 'rung__v', ''));
      rungs.forEach((r, i) => {
        const row = h('div', 'rung' + (i === rungs.length - 1 ? ' is-last' : ''));
        row.append(h('span', 'rung__lab', (i ? '<em>+</em>' : '') + r.lab));
        const p = h('div', 'rung__plot');
        const ci = h('i', 'rung__ci'); ci.style.left = X(r.ci[1]); ci.style.width = `calc(${X(r.ci[2])} - ${X(r.ci[1])})`;
        const bl = h('i', 'rung__base'); bl.style.left = X(base[0]); bl.title = 'statewide rate';
        const dot = h('i', 'rung__dot'); dot.style.left = X(r.ci[0]);
        p.append(bl, ci, dot);
        row.append(p);
        row.append(h('span', 'rung__v', `<b>${pct(r.ci[0])}</b>${fmt(r.k)} of ${fmt(r.n)}`));
        row.setAttribute('aria-label', `${r.lab}: ${fmt(r.k)} of ${fmt(r.n)} escaped, ${pct(r.ci[0])}, 95% interval ${pct(r.ci[1])} to ${pct(r.ci[2])}`);
        box.append(row);
      });
      if (stopped) {
        const row = h('div', 'rung is-stop');
        row.append(h('span', 'rung__lab', '<em>+</em>' + stopped.lab));
        row.append(h('span', 'rung__plot small', ''));
        row.append(h('span', 'rung__v', `<b>${fmt(stopped.n)}</b>too few`));
        box.append(row);
        box.append(h('p', 'small', `Only ${fmt(stopped.n)} past ${stopped.n === 1 ? 'fire matches' : 'fires match'} once you add that, so the desk stops one step earlier${skipped ? ` and leaves the remaining ${skipped === 1 ? 'fact' : skipped + ' facts'} unused` : ''}.`));
      }
      box.prepend(ax);
      box.append(h('p', 'small', 'Dot: share that escaped. Bar: 95% interval. Dashed line: the statewide rate.'));
    }

    function drawPrec(pool) {
      const list = $('#prec');
      list.replaceChildren();
      const idx = pool === null ? B.escapes.map((e) => e[0]) : pool.filter((i) => col.e[i]);
      const n = pool === null ? N : pool.length;
      const recent = idx.slice().sort((a, b) => b - a).slice(0, 8);
      $('#prec-sum').textContent = idx.length
        ? `${fmt(idx.length)} of the ${fmt(n)} matching fires got past 10 acres. The most recent ${Math.min(8, idx.length) === 1 ? 'one' : Math.min(8, idx.length)}:`
        : `None of the ${fmt(n)} matching fires got past 10 acres.`;
      recent.forEach((i) => {
        const e = escByIdx.get(i);
        const [d, t] = e[2].split(' ');
        const dd = new Date(d + 'T12:00:00');
        const hr = +t.slice(0, 2), mn = t.slice(3);
        const clock = `${hr % 12 || 12}:${mn} ${hr < 12 ? 'am' : 'pm'}`;
        const li = h('li');
        li.innerHTML = `<b>${e[1] || 'Unnamed'}</b><span class="ac">${fmt(e[3])} ac</span><span class="when">${B.counties[col.c[i]]} &middot; ${MON[dd.getMonth()]} ${dd.getDate()}, ${dd.getFullYear()} &middot; ${clock}</span>`;
        list.append(li);
      });
    }

    function verdict() {
      const c = Number(claim.value) / 100;
      out.textContent = claim.value + '%';
      if (!last) return;
      const [p, lo, hi] = last.ci;
      let v, tag, sub;
      if (c >= lo && c <= hi) { v = 'ok'; tag = 'Consistent'; sub = 'inside the 95% interval'; }
      else if (c >= lo / 3 && c <= Math.min(1, hi * 3)) { v = 'reason'; tag = 'Needs a reason'; sub = 'within 3x of the interval'; }
      else { v = 'extra'; tag = 'Extraordinary'; sub = 'more than 3x outside'; }
      const ratio = p > 0 ? c / p : Infinity;
      const rel = !isFinite(ratio) ? 'above a rate of zero' : ratio >= 1 ? `${ratio.toFixed(ratio < 10 ? 1 : 0)} times the record` : c === 0 ? 'zero, against a rate above zero' : `${(1 / ratio).toFixed(1)} times lower than the record`;
      const advice = {
        ok: 'Nothing to explain. It also means the copilot is adding little that the record did not already say.',
        reason: 'Plausible, but the copilot should name what it can see that the record cannot: wind, fuel moisture, slope, or how soon crews arrive.',
        extra: `Hold the recommendation until the copilot shows its evidence. For scale: when the desk was tested on 2025, even the riskiest tenth of fires escaped at ${pct(B.meta.holdout.topRate, 0)}.`,
      }[v];
      const el = $('#verdict');
      el.dataset.v = v;
      el.innerHTML = `<div class="verdict__tag">${tag}<small>${sub}</small></div><div class="verdict__body"><p>The deepest precedent pool above (${fmt(last.n)} fires) escaped at <b>${pct(p)}</b>, with a 95% interval of ${pct(lo)} to ${pct(hi)}. A ${claim.value}% claim is ${rel}.</p><p>${advice}</p></div>`;
    }

    Object.values(sel).forEach((s) => s.addEventListener('change', run));
    claim.addEventListener('input', verdict);
    run();
  }

  /* 06 holdout */
  function holdout(M) {
    const H = M.holdout;
    $('#holdout').textContent = `To test the desk, I built its precedent rates from 2022 to 2024 only and scored every one of the ${fmt(H.n)} fires in 2025. Ranked by their precedent rate, the fires sort with an AUC of ${H.auc.toFixed(2)}, where 0.5 is a coin flip and 1 is perfect. The riskiest tenth escaped at ${pct(H.topRate)}, about twice the year's ${pct(H.testRate)}, and held ${pct(H.topCapture, 0)} of its escapes. The desk ran a little hot at the top (it expected ${pct(H.topPred)}), and 2025 as a whole ran hotter than the years it learned from (${pct(H.testRate)} against ${pct(H.trainRate)}).`;
  }
})();
