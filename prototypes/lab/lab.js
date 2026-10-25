// Break the Wall lab prototype: renders hand-made disassemblies (btw-disassembly/0.1) as technical drawings.
// One engine for every subject: only the joint vocabulary and the form of "run" come from the data.

const SVG = 'http://www.w3.org/2000/svg';
const KIND = {
  step: 'passo', component: 'componente', artifact: 'artefatto', premise: 'premessa', conclusion: 'tesi',
  ground: 'fondamento', limit: 'limite', objection: 'obiezione', consequence: 'conseguenza', rejected: 'scartato',
};
const FAMILY = {
  'sends-to': 'mechanism', causes: 'mechanism', 'depends-on': 'mechanism',
  supports: 'argument', attacks: 'argument', limits: 'argument',
  'leads-to': 'story', because: 'story',
};
const VERB = {
  'sends-to': 'invia a', causes: 'causa', 'depends-on': 'dipende da', supports: 'sostiene', attacks: 'attacca',
  limits: 'limita', 'leads-to': 'porta a', because: 'spiega',
};
const REASON = {
  context: 'contesto', 'outside-question': 'fuori dalla domanda', repetition: 'ripetizione', detail: 'dettaglio',
  secrets: 'contiene segreti', generated: 'generato',
};
// A load test has three outcomes: arguments with independent supports weaken rather than fall.
const VERDICT = {
  falls: { state: 'failed', label: 'CROLLA', cls: 'fail', feedback: 'wrong', text: 'La tesi crolla. ', mark: '✕ ' },
  weakens: { state: 'active', label: 'SI INDEBOLISCE', cls: 'weak', feedback: 'weak', text: 'La tesi si indebolisce. ', mark: '◐ ' },
  holds: { state: 'ok', label: 'REGGE', cls: 'hold', feedback: 'right', text: 'La tesi regge. ', mark: '✓ ' },
};
const verdictOf = brick => VERDICT[brick.verdict || (brick.bears ? 'falls' : 'holds')];
const MARK = { ok: '✓', failed: '✕', active: '…', restored: '↺' };
// Point marks carry meaning, so they work for any subject; unmarked points get a plain bullet.
const POINT = { step: ['→', 'poi'], keeps: ['=', 'resta uguale'], caveat: ['⚠', 'attenzione'] };
const G = { col: 252, row: 128, w: 162, h: 72, margin: 56, top: 34, block: 64 };

const app = {
  list: [], d: null, lines: {}, report: null,
  mode: 'explode', path: [], selected: null, focus: null, source: null,
  run: 0, rs: null, re: null, geom: null, animate: true,
};

// ---------- DOM helpers ----------
const $ = sel => document.querySelector(sel);
function h(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid instanceof Node ? kid : document.createTextNode(kid));
  return node;
}
function s(tag, attrs = {}, ...kids) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid instanceof Node ? kid : document.createTextNode(kid));
  return node;
}
function icon(name, size = 20, x = 0, y = 0) {
  const key = (name || 'box').split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
  const lib = window.lucide || {};
  const node = (lib.icons && lib.icons[key]) || lib[key] || (lib.icons && lib.icons.Box);
  const svg = s('svg', { x, y, width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'icon', 'aria-hidden': 'true' });
  for (const [tag, attrs] of (node ? node[2] : [])) svg.append(s(tag, attrs));
  return svg;
}
// Words longer than a line (file names, identifiers) break after - . / _ or, failing that, anywhere.
function pieces(word, max) {
  if (word.length <= max) return [word];
  const out = []; let cur = '';
  for (const p of word.split(/(?<=[-./_])/)) { if (cur && (cur + p).length > max) { out.push(cur); cur = p; } else cur += p; }
  if (cur) out.push(cur);
  return out.flatMap(x => x.length <= max ? [x] : x.match(new RegExp(`.{1,${max}}`, 'g')));
}
function wrap(text, max) {
  const lines = []; let cur = '';
  for (const word of text.split(/\s+/).flatMap(w => pieces(w, max))) {
    if (cur && (cur + ' ' + word).length > max) { lines.push(cur); cur = word; } else cur = cur ? cur + ' ' + word : word;
  }
  if (cur) lines.push(cur);
  return lines;
}
const range = c => c.from === c.to ? `r. ${c.from}` : `r. ${c.from}–${c.to}`;
// Documents keep a page map (first line of each page), so a citation can name its pages too.
function pageOf(src, line) {
  let page = null;
  for (const x of src?.pages || []) if (x.from <= line) page = x.page;
  return page;
}
// A citation as the learner reads it: file (when there are several), page (for documents), lines.
function locator(c) {
  const src = app.d?.sources.find(x => x.id === c.source);
  const out = [];
  if (app.d?.sources.length > 1 && src) out.push(src.title.split('/').pop());
  const first = pageOf(src, c.from), last = pageOf(src, c.to);
  if (first) out.push(last && last !== first ? `pp. ${first}–${last}` : `p. ${first}`);
  out.push(range(c));
  return out.join(' · ');
}

// ---------- Data ----------
async function json(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}
async function boot() {
  try { app.theme = localStorage.getItem('btw-lab-theme') || 'paper'; } catch { app.theme = 'paper'; }
  document.documentElement.dataset.theme = app.theme;
  const index = await json('/prototypes/lab/data/index.json');
  // A private index under the ignored .local folder lists the owner's own disassemblies, if present.
  const entries = [];
  for (const entry of index.disassemblies) {
    if (!entry.index) { entries.push(entry); continue; }
    try { entries.push(...(await json(entry.index)).disassemblies.map(x => ({ ...x, private: true }))); } catch { /* no private index */ }
  }
  for (const entry of entries) {
    try { const d = await json(entry.path); d.private = !!entry.private; app.list.push(d); }
    catch (error) { console.warn(error); }
  }
  const picker = $('#picker');
  for (const d of app.list) picker.append(h('option', { value: d.id }, (d.private ? '🔒 ' : '') + d.title));
  picker.addEventListener('change', () => open(picker.value));
  for (const b of document.querySelectorAll('#modes button')) b.addEventListener('click', () => setMode(b.dataset.mode));
  $('#theme').addEventListener('click', toggleTheme);
  let timer; window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => drawOnly(), 120); });
  const [id, mode] = location.hash.slice(1).split('/');
  await open(app.list.some(d => d.id === id) ? id : app.list[0].id, mode);
}
async function open(id, mode = 'explode') {
  const d = app.list.find(x => x.id === id);
  app.d = d; app.lines = {};
  for (const src of d.sources) {
    const text = await fetch(src.path, { cache: 'no-store' }).then(r => r.ok ? r.text() : Promise.reject(new Error(`${src.path}: ${r.status}`)));
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    if (lines.at(-1) === '') lines.pop();
    app.lines[src.id] = lines;
  }
  app.report = validate(d);
  app.source = d.sources[0].id;
  app.run = 0;
  setMode(['explode', 'run', 'reassemble', 'bom'].includes(mode) ? mode : 'explode', true);
}
function toggleTheme() {
  app.theme = app.theme === 'paper' ? 'blueprint' : 'paper';
  document.documentElement.dataset.theme = app.theme;
  try { localStorage.setItem('btw-lab-theme', app.theme); } catch { /* preference only */ }
  $('#theme').textContent = app.theme === 'paper' ? 'Blueprint' : 'Carta';
}
function setMode(mode, fresh = false) {
  app.mode = mode; app.path = []; app.selected = null; app.focus = null; app.animate = true;
  if (mode === 'run' || fresh) resetRun();
  if (mode === 'reassemble' || fresh) resetReassemble();
  history.replaceState(null, '', `#${app.d.id}/${mode}`);
  render();
}

// Parts and joints of the level the learner is looking at (the path is a stack of opened sub-assemblies).
function level() {
  let parts = app.d.parts, joints = app.d.joints || [], owner = null;
  for (const id of app.path) {
    owner = parts.find(p => p.id === id);
    parts = owner.parts; joints = owner.joints || [];
  }
  return { parts, joints, owner };
}
function flat(parts = app.d.parts, depth = 0, prefix = '') {
  return parts.flatMap(p => [{ part: p, depth, pos: prefix + p.n }, ...(p.parts ? flat(p.parts, depth + 1, prefix + p.n + '.') : [])]);
}
const findPart = id => flat().find(x => x.part.id === id)?.part;

// ---------- Host checks: citations, 3–7 per level, joints, bill of materials ----------
function validate(d) {
  const findings = [];
  const covered = {}; const excluded = {};
  for (const src of d.sources) { covered[src.id] = app.lines[src.id].map(() => []); excluded[src.id] = app.lines[src.id].map(() => null); }
  const mark = (c, owner, counts = true) => {
    const lines = app.lines[c.source];
    if (!lines) { findings.push(`${owner}: fonte sconosciuta «${c.source}»`); return; }
    if (c.from < 1 || c.to > lines.length || c.from > c.to) { findings.push(`${owner}: righe ${c.from}–${c.to} fuori dalla fonte (${lines.length} righe)`); return; }
    if (counts) for (let i = c.from; i <= c.to; i++) covered[c.source][i - 1].push(owner);
  };
  (d.whole.cites || []).forEach(c => mark(c, d.whole.name));
  const walk = (parts, joints, name) => {
    if (parts.length < 3 || parts.length > 7) findings.push(`«${name}»: ${parts.length} pezzi a questo livello (attesi 3–7)`);
    const ids = new Set(parts.map(p => p.id));
    for (const p of parts) {
      if (!p.cites?.length) findings.push(`«${p.name}» non cita la fonte`);
      (p.cites || []).forEach(c => mark(c, p.name));
      if (p.parts) walk(p.parts, p.joints || [], p.name);
    }
    for (const j of joints) {
      if (!ids.has(j.from) || !ids.has(j.to)) findings.push(`Giunto ${j.from} → ${j.to}: i pezzi non sono allo stesso livello`);
      if (!FAMILY[j.type]) findings.push(`Giunto ${j.from} → ${j.to}: tipo sconosciuto «${j.type}»`);
      (j.cites || []).forEach(c => mark(c, `giunto ${j.label}`));
    }
  };
  walk(d.parts, d.joints || [], d.whole.name);
  for (const run of d.runs || []) {
    for (const c of [...(run.cites || []), ...(run.steps || []).flatMap(x => x.cites || []), ...(run.bricks || []).flatMap(x => x.cites || [])]) mark(c, run.title, false);
  }
  for (const x of d.bom?.excluded || []) {
    const lines = app.lines[x.source];
    if (!lines || x.from < 1 || x.to > lines.length) { findings.push(`Esclusione ${range(x)}: fuori dalla fonte`); continue; }
    if (!REASON[x.reason]) findings.push(`Esclusione ${range(x)}: motivo sconosciuto «${x.reason}»`);
    for (let i = x.from; i <= x.to; i++) excluded[x.source][i - 1] = x;
  }
  for (const x of d.bom?.excludedFiles || []) if (!REASON[x.reason]) findings.push(`File ${x.path}: motivo sconosciuto «${x.reason}»`);
  const status = {}; const missing = [];
  for (const src of d.sources) {
    status[src.id] = app.lines[src.id].map((t, i) => !t.trim() ? 'blank' : covered[src.id][i].length ? 'assigned' : excluded[src.id][i] ? 'excluded' : 'missing');
    let open = null, last = null;
    status[src.id].forEach((st, i) => {
      if (st === 'missing') { if (open === null) open = i; last = i; }
      else if (st !== 'blank' && open !== null) { missing.push({ source: src.id, from: open + 1, to: last + 1 }); open = null; }
    });
    if (open !== null) missing.push({ source: src.id, from: open + 1, to: last + 1 });
  }
  for (const m of missing) findings.push(`Righe ${m.from}–${m.to} di ${d.sources.find(x => x.id === m.source).title}: né in un pezzo né escluse`);
  return { findings, status, covered, excluded, missing };
}

// ---------- Render ----------
function render() {
  const d = app.d;
  $('#picker').value = d.id;
  $('#theme').textContent = app.theme === 'paper' ? 'Blueprint' : 'Carta';
  for (const b of document.querySelectorAll('#modes button')) b.setAttribute('aria-pressed', String(b.dataset.mode === app.mode));
  const badge = $('#bom-badge');
  badge.textContent = app.report.findings.length ? String(app.report.findings.length) : '✓';
  badge.className = 'badge ' + (app.report.findings.length ? 'warn' : 'ok');
  $('#question').textContent = d.question;
  renderCrumbs();
  drawOnly();
  renderPanel();
  renderCard();
  renderSource();
}
function renderCrumbs() {
  const nav = $('#crumbs'); nav.replaceChildren();
  const label = { explode: 'Esploso', run: 'Fai girare', reassemble: 'Rimonta', bom: 'Distinta base' }[app.mode];
  if (!app.path.length) { nav.append(`${label} · ${app.d.whole.name}`); return; }
  nav.append(h('button', { onclick: () => goTo(0) }, app.d.whole.name));
  app.path.forEach((id, i) => {
    nav.append(' › ');
    const name = findPart(id).name;
    nav.append(i === app.path.length - 1 ? name : h('button', { onclick: () => goTo(i + 1) }, name));
  });
}
function goTo(depth) { app.path = app.path.slice(0, depth); app.selected = null; app.focus = null; app.animate = true; render(); }
function enter(id) { app.path.push(id); app.selected = null; app.focus = null; app.animate = true; render(); }

function drawOnly() {
  const host = $('#drawing');
  if (app.mode === 'bom') { host.replaceChildren(bomView()); return; }
  const { parts, joints, owner } = level();
  if (app.mode === 'reassemble') { host.replaceChildren(reassembleDrawing()); return; }
  const run = app.mode === 'run' ? app.d.runs[app.run] : null;
  host.replaceChildren(sheet({ parts, joints, owner, run }));
}

// Geometry: hand-made grid positions ("at": [column, row]) until generated disassemblies get auto-layout.
function geometry(items) {
  const cs = items.map(i => i.at[0]); const rs = items.map(i => i.at[1]);
  const c0 = Math.min(...cs), r0 = Math.min(...rs);
  const pos = new Map(items.map(i => [i.id, { x: G.margin + (i.at[0] - c0) * G.col, y: G.margin + G.top + (i.at[1] - r0) * G.row }]));
  const W = Math.max(640, G.margin * 2 + (Math.max(...cs) - c0) * G.col + G.w);
  const H = G.margin * 2 + G.top + (Math.max(...rs) - r0) * G.row + G.h + G.block;
  return { pos, W, H };
}
function canvas(W, H, title, sub) {
  // Fit the sheet to the drawing area, within limits that keep the lettering readable.
  const host = $('#drawing');
  const scale = Math.min(1.15, Math.max(0.62, Math.min((host.clientWidth - 8) / W, (host.clientHeight - 8) / H)));
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: Math.round(W * scale), height: Math.round(H * scale), role: 'img', 'aria-label': title });
  svg.style.width = `${Math.round(W * scale)}px`; svg.style.height = `${Math.round(H * scale)}px`;
  svg.append(s('defs', {},
    s('pattern', { id: 'hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      s('rect', { width: 7, height: 7, style: 'fill: var(--paper)' }),
      s('line', { x1: 0, y1: 0, x2: 0, y2: 7, style: 'stroke: var(--ink-3); stroke-width: 1; opacity: .45' }))));
  svg.append(s('rect', { class: 'frame', x: 10, y: 10, width: W - 20, height: H - 20 }));
  svg.append(s('rect', { class: 'frame-inner', x: 15, y: 15, width: W - 30, height: H - 30 }));
  // Title block, as on an engineering sheet.
  const bw = 300, bh = 46, bx = W - 15 - bw, by = H - 15 - bh;
  svg.append(s('g', {},
    s('rect', { x: bx, y: by, width: bw, height: bh, class: 'frame-inner' }),
    s('line', { x1: bx, y1: by + 26, x2: bx + bw, y2: by + 26, class: 'tb-line' }),
    s('text', { x: bx + 10, y: by + 18, class: 'tb-title' }, title.length > 38 ? title.slice(0, 37) + '…' : title),
    s('text', { x: bx + 10, y: by + 39, class: 'tb-text' }, sub)));
  return svg;
}
function sheet({ parts, joints, owner, run }) {
  const { pos, W, H } = geometry(parts);
  app.geom = { pos };
  const title = owner ? owner.name : app.d.whole.name;
  const depth = app.path.length;
  const sub = `${run ? 'fai girare' : 'esploso'} · livello ${depth + 1} · ${parts.length} pezzi · scala 1:1`;
  const svg = canvas(W, H, title, sub);
  const states = run?.type === 'scenario' ? app.rs.states : {};
  const lit = new Set();
  if (run?.type === 'case') for (const p of parts) if ((p.cites || []).some(c => (run.cites || []).some(r => r.source === c.source && r.from <= c.to && c.from <= r.to))) lit.add(p.id);
  const removed = run?.type === 'load' ? app.rs.removed : null;
  const brick = removed ? run.bricks.find(b => b.part === removed) : null;

  const jg = s('g', { class: 'joints' + (app.animate ? ' hidden' : '') });
  for (const j of joints) {
    if (!pos.has(j.from) || !pos.has(j.to)) continue;
    jg.append(joint(pos.get(j.from), pos.get(j.to), j, { broken: removed && j.from === removed }));
  }
  svg.append(jg);
  const center = { x: W / 2 - G.w / 2, y: (H - G.block) / 2 - G.h / 2 };
  for (const p of parts) {
    const at = pos.get(p.id);
    const cls = ['plate'];
    if (p.parts) cls.push('assembly');
    if (p.parts && !p.relevant) cls.push('closed');
    if (states[p.id]) cls.push('state-' + states[p.id]);
    if (app.selected === p.id) cls.push('sel');
    if (lit.has(p.id)) cls.push('lit');
    if (run?.type === 'load' && run.bricks.some(b => b.part === p.id)) cls.push('brick');
    if (removed === p.id) cls.push('removed');
    if (brick && p.id === run.target) cls.push('state-' + verdictOf(brick).state);
    const g = plate(p, cls.join(' '), states[p.id]);
    if (brick && p.id === run.target) g.append(s('text', { x: G.w / 2, y: -10, 'text-anchor': 'middle', class: 'verdict ' + verdictOf(brick).cls }, verdictOf(brick).label));
    if (brick && p.id === run.target && verdictOf(brick) !== VERDICT.holds) g.querySelector('.body').setAttribute('transform', `rotate(${verdictOf(brick) === VERDICT.falls ? 3 : 1.2} ${G.w / 2} ${G.h})`);
    const start = app.animate ? center : at;
    g.style.transform = `translate(${start.x}px, ${start.y}px)`;
    if (app.animate) g.style.opacity = '0.3';
    g.addEventListener('click', () => onPlate(p, run));
    g.addEventListener('dblclick', () => { if (!run && p.parts) enter(p.id); });
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlate(p, run); } });
    svg.append(g);
  }
  if (app.animate) {
    // The exploded view opens: parts start assembled at the centre and move out to their places.
    // A timer, not requestAnimationFrame, so a page opened in a background tab does not stay assembled.
    setTimeout(() => {
      for (const g of svg.querySelectorAll('.plate')) { const at = pos.get(g.dataset.id); g.style.transform = `translate(${at.x}px, ${at.y}px)`; g.style.opacity = ''; }
      setTimeout(() => jg.classList.remove('hidden'), 520);
    }, 40);
    app.animate = false;
  }
  return svg;
}
function plate(p, cls, state) {
  const g = s('g', { class: cls, 'data-id': p.id, tabindex: 0, role: 'button', 'aria-label': `${p.n}. ${p.name}` });
  if (p.parts) g.append(s('rect', { class: 'outer', x: -4, y: -4, width: G.w + 8, height: G.h + 8, rx: 4 }));
  g.append(s('rect', { class: 'body', x: 0, y: 0, width: G.w, height: G.h, rx: 3 }));
  g.append(s('text', { class: 'kindtag', x: 10, y: 14 }, KIND[p.kind] || p.kind || ''));
  g.append(icon(p.icon, 20, 10, 27));
  let lines = wrap(p.name, 16);
  if (lines.length > 3) lines = [...lines.slice(0, 2), lines.slice(2).join(' ').slice(0, 14) + '…'];
  const top = (G.h - lines.length * 15) / 2 + 6;
  lines.forEach((line, i) => g.append(s('text', { class: 'name', x: 40, y: top + 11 + i * 15 }, line)));
  if (p.parts) g.append(s('text', { class: 'sub', x: G.w - 8, y: 14, 'text-anchor': 'end' }, `${p.relevant ? '⊕' : '▨'} ${p.parts.length} pezzi`));
  // Balloon with leader line: the item number links the drawing to the bill of materials.
  g.append(s('g', { class: 'balloon' },
    s('line', { x1: -9, y1: -9, x2: 6, y2: 6 }),
    s('circle', { cx: -15, cy: -15, r: 10 }),
    s('text', { x: -15, y: -11, 'text-anchor': 'middle' }, String(p.n))));
  if (state) g.append(s('g', { class: 'statemark ' + state }, s('circle', { cx: G.w, cy: 0, r: 10 }), s('text', { x: G.w, y: 4, 'text-anchor': 'middle' }, MARK[state])));
  return g;
}
function edge(c, t) {
  const dx = t.x - c.x, dy = t.y - c.y;
  const k = Math.min((G.w / 2 + 6) / Math.abs(dx || 1e-9), (G.h / 2 + 6) / Math.abs(dy || 1e-9));
  return { x: c.x + dx * k, y: c.y + dy * k };
}
function joint(a, b, j, { broken = false, label = true } = {}) {
  const fam = FAMILY[j.type] || 'mechanism';
  const ca = { x: a.x + G.w / 2, y: a.y + G.h / 2 }, cb = { x: b.x + G.w / 2, y: b.y + G.h / 2 };
  const p1 = edge(ca, cb), p2 = edge(cb, ca);
  const g = s('g', {});
  g.append(s('path', { d: `M${p1.x},${p1.y} L${p2.x},${p2.y}`, class: `joint fam-${fam} t-${j.type}${broken ? ' broken' : ''}` }));
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1, ux = (p2.x - p1.x) / len, uy = (p2.y - p1.y) / len;
  if (j.type === 'limits') {
    g.append(s('path', { d: `M${p2.x - uy * 7},${p2.y + ux * 7} L${p2.x + uy * 7},${p2.y - ux * 7}`, class: `joint fam-${fam}` }));
  } else {
    const bx = p2.x - ux * 10, by = p2.y - uy * 10;
    g.append(s('polygon', { points: `${p2.x},${p2.y} ${bx - uy * 4.5},${by + ux * 4.5} ${bx + uy * 4.5},${by - ux * 4.5}`, class: `joint-head fam-${fam}` }));
  }
  if (j.type === 'attacks') {
    // The cross sits near the attacking part, so the label can keep the middle of the line.
    const mx = p1.x + ux * 12, my = p1.y + uy * 12;
    g.append(s('path', { d: `M${mx - 5},${my - 5} L${mx + 5},${my + 5} M${mx + 5},${my - 5} L${mx - 5},${my + 5}`, class: `joint fam-${fam}` }));
  }
  if (label && j.label) {
    const lines = wrap(j.label, 12);
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    const w = Math.max(...lines.map(l => l.length)) * 6.1 + 8, hgt = lines.length * 12 + 4;
    const lg = s('g', { class: `jlabel fam-${fam}` }, s('rect', { x: mx - w / 2, y: my - hgt / 2, width: w, height: hgt, rx: 2 }));
    lines.forEach((l, i) => lg.append(s('text', { x: mx, y: my - hgt / 2 + 12 + i * 12, 'text-anchor': 'middle' }, l)));
    g.append(lg);
  }
  return g;
}
function onPlate(p, run) {
  if (run?.type === 'load' && run.bricks.some(b => b.part === p.id)) { removeBrick(p.id); return; }
  app.selected = app.selected === p.id ? null : p.id;
  app.focus = app.selected ? (p.cites || [])[0] : null;
  if (app.focus) app.source = app.focus.source;
  for (const g of document.querySelectorAll('#drawing .plate')) g.classList.toggle('sel', g.dataset.id === app.selected);
  renderCard(); renderSource();
}

// ---------- Card: the selected part, or the whole ----------
function renderCard() {
  const card = $('#card'); card.replaceChildren();
  const p = app.selected ? findPart(app.selected) : null;
  if (!p) {
    const owner = level().owner;
    const whole = owner || app.d.whole;
    card.append(...[
      h('div', { class: 'kind' }, owner ? `Sottoassieme · ${KIND[owner.kind] || ''}` : `Smontaggio${app.d.private ? ' · privato' : ''}`),
      h('h2', {}, whole.name),
      h('p', { class: 'role' }, owner ? owner.role : app.d.whole.does),
      h('p', {}, owner ? owner.explain : app.d.whole.why),
      cites(owner ? owner.cites : app.d.whole.cites),
      h('p', { class: 'kind', style: 'margin-top:12px' }, app.mode === 'explode' ? 'Seleziona un pezzo per aprirlo. Doppio clic su un sottoassieme per entrarci.' : ''),
    ].filter(Boolean));
    return;
  }
  const { joints } = level();
  const name = id => findPart(id)?.name || id;
  const rel = joints.filter(j => j.from === p.id || j.to === p.id).map(j => h('li', {},
    j.from === p.id ? `${VERB[j.type]} «${name(j.to)}»` : `«${name(j.from)}» ${VERB[j.type]} questo pezzo`,
    j.label ? h('span', { class: 'kind' }, ` · ${j.label}`) : ''));
  card.append(...[
    h('div', { class: 'kind' }, `Pezzo ${p.n} · ${KIND[p.kind] || p.kind}`),
    h('h2', {}, p.name),
    h('p', { class: 'role' }, p.role),
    p.points ? points(p.points) : h('p', {}, p.explain),
    p.lens ? h('div', { class: 'box' }, h('span', { class: 'label' }, 'Lente'),
      h('dl', { class: 'lens' }, h('dt', {}, "Cos'è"), h('dd', {}, p.lens.what), h('dt', {}, 'Perché qui'), h('dd', {}, p.lens.why),
        h('dt', {}, 'Come'), h('dd', {}, p.lens.how), h('dt', {}, '⚠'), h('dd', {}, p.lens.critical))) : null,
    p.metaphor ? h('div', { class: 'box' }, h('span', { class: 'label' }, 'Metafora'), h('p', {}, p.metaphor.text),
      h('span', { class: 'label' }, '⚠ Dove si ferma'), h('p', { style: 'margin:0' }, p.metaphor.limit)) : null,
    p.critique ? h('div', { class: 'box inference' }, h('span', { class: 'label' }, 'Nota critica · non viene dalla fonte'), h('p', { style: 'margin:0' }, p.critique)) : null,
    rel.length ? h('div', { class: 'box limit' }, h('span', { class: 'label' }, 'Giunti'), h('ul', { style: 'margin:0;padding-left:18px' }, rel)) : null,
    cites(p.cites),
    p.parts ? h('button', { class: 'open-sub', onclick: () => enter(p.id) }, `${p.relevant ? 'Apri' : 'Apri comunque'} il sottoassieme · ${p.parts.length} pezzi`) : null,
    p.parts && !p.relevant ? h('p', { class: 'kind', style: 'margin-top:6px' }, 'Chiuso: non serve alla tua domanda, ma resta qui.') : null,
  ].filter(Boolean)); // native append would print null as text
}
function points(list) {
  return h('ul', { class: 'points' }, list.map(point => {
    const { text, mark } = typeof point === 'string' ? { text: point } : point;
    const [glyph, meaning] = POINT[mark] || ['•', null];
    return h('li', { class: mark ? `m-${mark}` : null },
      h('span', { class: 'mark', 'aria-hidden': 'true' }, glyph), meaning ? h('span', { class: 'sr' }, `${meaning}: `) : null, h('span', {}, text));
  }));
}
function cites(list = []) {
  return h('div', { class: 'cites' }, list.map(c => h('button', { class: 'cite', onclick: () => { app.focus = c; app.source = c.source; renderSource(); } }, locator(c))));
}

// ---------- Source: the numbered lines, with the focused citation highlighted ----------
function renderSource() {
  const d = app.d, src = d.sources.find(x => x.id === app.source) || d.sources[0];
  const lines = app.lines[src.id];
  // Few sources get buttons; a repository's files get a list.
  const switcher = d.sources.length > 3
    ? h('select', { class: 'source-pick', 'aria-label': 'File della fonte', onchange: e => { app.source = e.target.value; app.focus = null; renderSource(); } },
      d.sources.map(x => h('option', { value: x.id, selected: x.id === src.id }, x.title)))
    : d.sources.length > 1 ? h('span', {}, d.sources.map(x => h('button', { class: 'cite', onclick: () => { app.source = x.id; renderSource(); } }, x.title))) : '';
  $('#source-head').replaceChildren(
    h('span', {}, `${d.sources.length > 3 ? '' : src.title + ' · '}${src.language} · ${lines.length} righe${src.pages ? ` · pp. ${src.pages[0].page}–${src.pages.at(-1).page}` : ''}`),
    switcher);
  const hl = new Set();
  const marks = app.selected ? (findPart(app.selected)?.cites || []) : app.focus ? [app.focus] : [];
  for (const c of marks) if (c.source === src.id) for (let i = c.from; i <= c.to; i++) hl.add(i);
  if (app.focus && app.focus.source === src.id) for (let i = app.focus.from; i <= app.focus.to; i++) hl.add(i);
  const status = app.report.status[src.id];
  const ol = $('#source'); ol.replaceChildren();
  const pageStarts = new Map((src.pages || []).map(x => [x.from, x.page]));
  lines.forEach((t, i) => {
    if (pageStarts.has(i + 1)) ol.append(h('li', { class: 'pagebreak', 'aria-hidden': 'true' }, h('span', { class: 'n' }, ''), h('span', { class: 't' }, `pagina ${pageStarts.get(i + 1)}`)));
    const cls =[hl.has(i + 1) ? 'hl' : '', app.mode === 'bom' && status[i] !== 'blank' ? 'bom-' + status[i] : ''].join(' ').trim();
    ol.append(h('li', { id: `L${i + 1}`, class: cls || null }, h('span', { class: 'n' }, String(i + 1)), h('span', { class: 't' }, t)));
  });
  const first = app.focus?.source === src.id ? app.focus.from : Math.min(...hl);
  // Scroll only the source list: scrollIntoView would also move the page and hide the drawing.
  const target = Number.isFinite(first) ? ol.querySelector(`#L${first}`) : null;
  if (target) ol.scrollTop = target.offsetTop - ol.clientHeight / 3;
}

// ---------- Panel: run and reassemble controls ----------
function renderPanel() {
  const panel = $('#panel'); panel.replaceChildren();
  if (app.mode === 'run') panel.append(...runPanel());
  if (app.mode === 'reassemble') panel.append(...reassemblePanel());
}

// Run: a scenario (mechanism), a load test (argument) or a new case (any kind). All are "put a joint under load".
function resetRun() {
  const run = app.d.runs?.[app.run];
  app.rs = { step: -1, phase: 'action', choice: null, states: {}, vars: { ...(run?.vars || {}) }, changed: new Set(), removed: null, tried: new Set() };
}
function runPanel() {
  const runs = app.d.runs || [];
  const tabs = h('div', { class: 'runs' }, runs.map((r, i) => h('button', { 'aria-pressed': String(i === app.run), onclick: () => { app.run = i; resetRun(); app.focus = null; render(); } },
    `${{ scenario: 'Scenario', load: 'Carico', case: 'Caso nuovo' }[r.type]} · ${r.title}`)));
  const run = runs[app.run];
  if (!run) return [h('p', {}, 'Nessuna prova per questo smontaggio.')];
  if (run.type === 'scenario') return [tabs, ...scenarioPanel(run)];
  if (run.type === 'load') return [tabs, ...loadPanel(run)];
  return [tabs, ...casePanel(run)];
}
function instruments() {
  return h('div', { class: 'instruments' }, Object.entries(app.rs.vars).map(([k, v]) => h('div', { class: app.rs.changed.has(k) ? 'changed' : null }, h('b', {}, k), v)));
}
function scenarioPanel(run) {
  const rs = app.rs;
  const out = [h('h3', {}, run.title, h('span', { class: 'tag' }, 'meccanismo')), instruments()];
  if (rs.step < 0) {
    out.push(h('p', {}, run.setup), h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => { rs.step = 0; rs.phase = 'action'; renderPanel(); } }, '▶ Inizia')));
    return out;
  }
  const step = run.steps[rs.step];
  out.push(h('p', { class: 'steps' }, `Passo ${rs.step + 1} di ${run.steps.length}`), h('p', {}, h('b', {}, 'Azione: '), step.action));
  if (step.predict && rs.phase === 'action') {
    out.push(h('p', {}, h('b', {}, '? Prevedi: '), step.predict.question), options(step.predict.options, i => { rs.choice = i; rs.phase = 'predicted'; renderPanel(); }));
    return out;
  }
  if (step.predict) {
    out.push(h('p', {}, h('b', {}, '? '), step.predict.question), options(step.predict.options, null, rs.choice), feedback(step.predict.options[rs.choice]));
  }
  if (rs.phase === 'running') { out.push(h('p', { class: 'kind' }, 'In corso…')); return out; }
  if (rs.phase !== 'done') {
    out.push(h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => execute(run, step) }, `▶ Esegui`)));
    return out;
  }
  out.push(h('p', {}, step.explain), cites(step.cites));
  const last = rs.step === run.steps.length - 1;
  out.push(h('div', { class: 'actions' },
    last ? h('button', { class: 'primary', onclick: () => { resetRun(); render(); } }, '↺ Ricomincia')
      : h('button', { class: 'primary', onclick: () => { rs.step++; rs.phase = 'action'; rs.choice = null; rs.changed = new Set(); app.focus = null; renderPanel(); renderSource(); } }, 'Passo successivo →')));
  return out;
}
async function execute(run, step) {
  const rs = app.rs;
  rs.phase = 'running'; renderPanel();
  for (const [a, b] of step.flow || []) await packet(a, b);
  Object.assign(rs.states, step.effect || {});
  rs.changed = new Set(Object.keys(step.vars || {}));
  Object.assign(rs.vars, step.vars || {});
  rs.phase = 'done';
  app.focus = step.cites?.[0] || null;
  if (app.focus) app.source = app.focus.source;
  drawOnly(); renderPanel(); renderSource();
}
function packet(a, b) {
  const pos = app.geom?.pos; const svg = $('#drawing svg');
  if (!pos?.has(a) || !pos?.has(b) || !svg) return Promise.resolve();
  const A = pos.get(a), B = pos.get(b);
  const from = { x: A.x + G.w / 2, y: A.y + G.h / 2 }, to = { x: B.x + G.w / 2, y: B.y + G.h / 2 };
  const dot = s('circle', { class: 'packet', r: 7, cx: from.x, cy: from.y });
  svg.append(dot);
  return new Promise(resolve => {
    const t0 = performance.now(), dur = 650;
    let finished = false;
    const finish = () => { if (finished) return; finished = true; dot.remove(); resolve(); };
    const tick = now => {
      if (finished) return;
      const t = Math.min(1, (now - t0) / dur), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      dot.setAttribute('cx', from.x + (to.x - from.x) * e); dot.setAttribute('cy', from.y + (to.y - from.y) * e);
      if (t < 1) requestAnimationFrame(tick); else finish();
    };
    requestAnimationFrame(tick);
    setTimeout(finish, dur + 120); // background tabs pause animation frames
  });
}
function options(list, onPick, chosen = null) {
  return h('div', { class: 'options' }, list.map((o, i) => h('button', {
    disabled: chosen !== null || !onPick,
    class: chosen === null ? null : o.correct ? 'right' : i === chosen ? 'wrong' : null,
    onclick: onPick ? () => onPick(i) : null,
  }, o.text)));
}
function feedback(o) {
  return h('div', { class: 'feedback ' + (o.correct ? 'right' : 'wrong') }, h('b', {}, o.correct ? 'Esatto. ' : 'Non proprio. '), o.why);
}
function loadPanel(run) {
  const rs = app.rs;
  const target = findPart(run.target);
  const out = [h('h3', {}, run.title, h('span', { class: 'tag' }, 'argomento · metti sotto carico')),
    h('p', {}, run.question),
    h('p', { class: 'kind' }, `Il tetto è «${target.name}». I mattoni tratteggiati si possono togliere: clicca sul disegno o qui sotto.`),
    h('div', { class: 'actions' }, run.bricks.map(b => h('button', { class: rs.removed === b.part ? 'primary' : null, onclick: () => removeBrick(b.part) },
      `${rs.tried.has(b.part) ? verdictOf(b).mark : ''}Togli «${findPart(b.part).name}»`)))];
  const brick = run.bricks.find(b => b.part === rs.removed);
  if (brick) {
    out.push(h('div', { class: 'feedback ' + verdictOf(brick).feedback }, h('b', {}, verdictOf(brick).text), brick.explain));
    if (brick.inference) out.push(h('div', { class: 'box inference' }, h('span', { class: 'label' }, 'Interpretazione · non viene dalla fonte'), 'Il giudizio su questo mattone è una lettura del testo, non una citazione.'));
    out.push(cites(brick.cites), h('div', { class: 'actions' }, h('button', { onclick: () => { rs.removed = null; app.focus = null; drawOnly(); renderPanel(); renderSource(); } }, '↺ Rimetti il mattone')));
  }
  if (rs.tried.size === run.bricks.length) {
    const named = v => run.bricks.filter(b => verdictOf(b) === v).map(b => findPart(b.part).name).join(', ');
    out.push(h('p', { class: 'kind', style: 'margin-top:10px' }, [
      named(VERDICT.falls) && `Portanti: ${named(VERDICT.falls)}.`,
      named(VERDICT.weakens) && `Di rinforzo: ${named(VERDICT.weakens)}.`,
      named(VERDICT.holds) && `Non portanti: ${named(VERDICT.holds)}.`,
    ].filter(Boolean).join(' ')));
  }
  return out;
}
function removeBrick(id) {
  const run = app.d.runs[app.run];
  app.rs.removed = app.rs.removed === id ? null : id;
  if (app.rs.removed) app.rs.tried.add(id);
  const brick = run.bricks.find(b => b.part === app.rs.removed);
  app.focus = brick?.cites?.[0] || null;
  if (app.focus) app.source = app.focus.source;
  drawOnly(); renderPanel(); renderSource();
}
function casePanel(run) {
  const rs = app.rs;
  const out = [h('h3', {}, run.title, h('span', { class: 'tag' }, 'applica')),
    h('p', {}, h('b', {}, 'Caso: '), run.scenario), h('p', {}, h('b', {}, '? '), run.question),
    options(run.options, rs.choice === null ? i => { rs.choice = i; app.focus = run.cites?.[0] || null; if (app.focus) app.source = app.focus.source; renderPanel(); renderSource(); } : null, rs.choice)];
  if (rs.choice !== null) {
    out.push(feedback(run.options[rs.choice]));
    if (run.inference) out.push(h('div', { class: 'box inference' }, h('span', { class: 'label' }, 'Caso costruito · non viene dalla fonte'), 'Il caso è inventato per mettere alla prova il pezzo; la risposta segue dalle righe citate.'));
    out.push(cites(run.cites), h('div', { class: 'actions' }, h('button', { onclick: () => { rs.choice = null; renderPanel(); } }, '↺ Riprova')));
  }
  return out;
}

// ---------- Reassemble: put the parts back in their slots ----------
function resetReassemble() {
  const r = app.d.reassemble;
  // A slot accepts one part, or any of a set of interchangeable parts (e.g. three independent supports).
  const pieces = r ? [...new Set(r.slots.flatMap(x => [].concat(x.accepts)))] : [];
  // Deterministic shuffle, so the tray never starts in solution order.
  const tray = pieces.map((id, i) => ({ id, k: (i * 7 + 3) % pieces.length })).sort((a, b) => a.k - b.k).map(x => x.id);
  if (tray.every((id, i) => id === pieces[i]) && tray.length > 1) tray.push(tray.shift());
  app.re = { placed: {}, locked: new Set(), picked: null, tray, msg: null, wrong: new Set() };
}
function place(slotId, partId) {
  const re = app.re;
  if (re.locked.has(slotId)) return;
  for (const [k, v] of Object.entries(re.placed)) if (v === partId) delete re.placed[k];
  if (re.placed[slotId]) re.tray.push(re.placed[slotId]);
  re.placed[slotId] = partId;
  re.tray = re.tray.filter(x => x !== partId);
  re.picked = null; re.wrong.delete(slotId);
  drawOnly(); renderPanel();
}
function reassembleDrawing() {
  const r = app.d.reassemble, re = app.re;
  const { pos, W, H } = geometry(r.slots);
  app.geom = { pos };
  const svg = canvas(W, H, r.title, `rimonta · ${r.slots.length} posti · facoltativa`);
  const slotsFor = id => r.slots.filter(x => [].concat(x.accepts).includes(id)).map(x => x.id);
  const sk = s('g', { class: 'skeleton' });
  const drawn = new Set();
  for (const j of app.d.joints || []) for (const a of slotsFor(j.from)) for (const b of slotsFor(j.to)) {
    if (drawn.has(a + '>' + b)) continue;
    drawn.add(a + '>' + b);
    sk.append(joint(pos.get(a), pos.get(b), j, { label: false }));
  }
  svg.append(sk);
  for (const slot of r.slots) {
    const at = pos.get(slot.id);
    const partId = re.placed[slot.id];
    let g;
    if (partId) {
      const state = re.locked.has(slot.id) ? 'ok' : re.wrong.has(slot.id) ? 'failed' : null;
      g = plate(findPart(partId), 'plate' + (state ? ' state-' + state : ''), state);
      g.querySelector('.balloon').remove(); // the item number would give the order away
      g.addEventListener('click', () => { if (re.locked.has(slot.id)) return; delete re.placed[slot.id]; re.tray.push(partId); drawOnly(); renderPanel(); });
    } else {
      g = s('g', { class: 'slot' + (re.picked ? ' target' : ''), 'data-id': slot.id, tabindex: 0, role: 'button', 'aria-label': `Posto ${slot.label}` },
        s('rect', { class: 'body', x: 0, y: 0, width: G.w, height: G.h, rx: 3 }),
        s('text', { class: 'slotlabel', x: G.w / 2, y: G.h / 2 + 4, 'text-anchor': 'middle' }, slot.label));
      g.addEventListener('click', () => { if (re.picked) place(slot.id, re.picked); });
      g.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && re.picked) { e.preventDefault(); place(slot.id, re.picked); } });
    }
    g.addEventListener('dragover', e => { e.preventDefault(); g.classList.add('over'); });
    g.addEventListener('dragleave', () => g.classList.remove('over'));
    g.addEventListener('drop', e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) place(slot.id, id); });
    g.style.transform = `translate(${at.x}px, ${at.y}px)`;
    svg.append(g);
  }
  return svg;
}
function reassemblePanel() {
  const r = app.d.reassemble, re = app.re;
  if (!r) return [h('p', {}, 'Nessuna rimonta per questo smontaggio.')];
  const done = re.locked.size === r.slots.length;
  const tray = h('div', { class: 'tray' }, re.tray.map(id => {
    const p = findPart(id);
    const chip = h('button', { class: 'chip', draggable: 'true', 'aria-pressed': String(re.picked === id), onclick: () => { re.picked = re.picked === id ? null : id; drawOnly(); renderPanel(); } }, icon(p.icon, 15), p.name);
    chip.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', id));
    return chip;
  }));
  const out = [h('h3', {}, r.title, h('span', { class: 'tag' }, 'facoltativa')), h('p', {}, r.instruction)];
  if (!done) out.push(h('p', { class: 'kind' }, re.picked ? `Scegli un posto per «${findPart(re.picked).name}».` : 'Prendi un pezzo (clic o trascina) e mettilo in un posto del disegno.'), tray);
  if (re.msg) out.push(h('div', { class: 'feedback ' + (done ? 'right' : 'wrong') }, re.msg));
  out.push(h('div', { class: 'actions' },
    !done ? h('button', { class: 'primary', disabled: !Object.keys(re.placed).length, onclick: check }, 'Verifica') : null,
    h('button', { onclick: () => { resetReassemble(); drawOnly(); renderPanel(); } }, '↺ Ricomincia')));
  return out;
}
function check() {
  const r = app.d.reassemble, re = app.re;
  const wrong = [];
  for (const slot of r.slots) {
    const id = re.placed[slot.id];
    if (!id || re.locked.has(slot.id)) continue;
    if ([].concat(slot.accepts).includes(id)) re.locked.add(slot.id); else wrong.push(slot);
  }
  re.wrong = new Set(wrong.map(x => x.id));
  if (wrong.length) {
    const first = wrong[0], id = re.placed[first.id];
    re.msg = `«${findPart(id).name}» non va nel posto «${first.label}». ${r.hints?.[id] || ''}`;
    setTimeout(() => { for (const x of wrong) { if (re.placed[x.id]) re.tray.push(re.placed[x.id]); delete re.placed[x.id]; } re.wrong = new Set(); drawOnly(); renderPanel(); }, 1100);
  } else if (re.locked.size === r.slots.length) {
    re.msg = `Rimontato: ${r.slots.length} pezzi al loro posto. Sai dire perché ognuno sta lì?`;
  } else {
    re.msg = `${re.locked.size} di ${r.slots.length} al posto giusto. Continua.`;
  }
  drawOnly(); renderPanel();
}

// ---------- Bill of materials ----------
function bomView() {
  const d = app.d, rep = app.report;
  const wrapEl = h('div', { class: 'bom' });
  // The scope says what was looked at: a repository snapshot or the pages of a document.
  if (d.scope) wrapEl.append(h('div', { class: 'box' }, h('span', { class: 'label' }, d.scope.kind === 'repository' ? 'Ambito · repository' : 'Ambito · documento'),
    h('p', { style: 'margin:0' }, d.scope.root), d.scope.note ? h('p', { class: 'kind', style: 'margin:4px 0 0' }, d.scope.note) : null));
  const many = d.sources.length > 3;
  const all = { assigned: 0, excluded: 0, missing: 0, blank: 0 };
  wrapEl.append(h('h3', {}, many ? `Distinta base · ${d.sources.length} file` : 'Distinta base'));
  for (const src of d.sources) {
    const status = rep.status[src.id];
    const strip = h('div', { class: 'strip' + (many ? ' small' : ''), title: 'Ogni tacca è una riga della fonte' }, status.map(st => h('span', { class: st })));
    strip.addEventListener('click', e => {
      const i = Math.floor((e.offsetX / strip.clientWidth) * status.length) + 1;
      app.focus = { source: src.id, from: i, to: i }; app.source = src.id; renderSource();
    });
    const count = k => status.filter(x => x === k).length;
    for (const k of Object.keys(all)) all[k] += count(k);
    wrapEl.append(h('div', { class: 'strip-head' }, h('span', { class: 'mono' }, src.title), h('span', { class: 'kind' }, `${status.length} righe${count('missing') ? ` · ${count('missing')} dimenticate` : ''}`)), strip);
  }
  wrapEl.append(h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'background:var(--ok);opacity:.55' }), `in un pezzo ${all.assigned}`),
    h('span', {}, h('i', { style: 'background:var(--ink-3);opacity:.4' }), `non smontate ${all.excluded}`),
    h('span', {}, h('i', { style: 'background:var(--fail)' }), `dimenticate ${all.missing}`),
    h('span', {}, `vuote ${all.blank}`)));
  if (d.bom?.excludedFiles?.length) {
    wrapEl.append(h('h3', { style: 'margin-top:14px' }, 'File non smontati'),
      h('table', {}, h('thead', {}, h('tr', {}, ['File', 'Motivo', 'Note'].map(t => h('th', {}, t)))),
        h('tbody', {}, d.bom.excludedFiles.map(x => h('tr', { class: 'excluded' }, h('td', { class: 'mono' }, x.path), h('td', {}, REASON[x.reason] || x.reason), h('td', {}, x.note || ''))))));
  }
  wrapEl.append(h('ul', { class: 'findings' }, rep.findings.length
    ? rep.findings.map(f => h('li', {}, f))
    : h('li', { class: 'ok' }, 'Controllo dell\'app: ogni riga è in un pezzo o esclusa con un motivo; citazioni e giunti sono validi; ogni livello ha 3–7 pezzi.')));
  const rows = flat().map(({ part, depth, pos }) => h('tr', { class: depth ? 'child' : null, onclick: () => { app.selected = part.id; app.focus = part.cites?.[0]; if (app.focus) app.source = app.focus.source; renderCard(); renderSource(); } },
    h('td', { class: 'mono' }, pos), h('td', {}, part.name), h('td', {}, KIND[part.kind] || part.kind),
    h('td', { class: 'mono' }, (part.cites || []).map(locator).join(', ')),
    h('td', {}, part.parts ? (part.relevant ? 'sottoassieme aperto' : 'sottoassieme chiuso') : depth ? '' : (part.relevant ? '' : 'fuori dal percorso'))));
  const excluded = (d.bom?.excluded || []).map(x => h('tr', { class: 'excluded', onclick: () => { app.selected = null; app.focus = x; app.source = x.source; renderCard(); renderSource(); } },
    h('td', { class: 'mono' }, '—'), h('td', {}, x.note), h('td', {}, `non smontato · ${REASON[x.reason] || x.reason}`), h('td', { class: 'mono' }, locator(x)), h('td', {}, '')));
  wrapEl.append(h('table', {}, h('thead', {}, h('tr', {}, ['Pos.', 'Pezzo', 'Tipo', 'Righe', 'Note'].map(t => h('th', {}, t)))), h('tbody', {}, rows, excluded)));
  return wrapEl;
}

boot().catch(error => {
  $('#drawing').replaceChildren(h('p', { style: 'padding:20px' }, `Impossibile caricare il laboratorio: ${error.message}. Avvialo dalla radice del repository (vedi prototypes/lab/README.md).`));
  console.error(error);
});
