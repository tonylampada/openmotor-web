import { simulate } from './motorlib.js';
import { DEFAULT_MODEL, PRESETS, FIELDS, validate, normalize, suggestFixes, llmContext } from './model.js';

const $ = s => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

// ---- state -------------------------------------------------------------------------------------

let model = loadModel();
let units = { length: 'mm', pressure: 'psi', force: 'N', ...JSON.parse(store.get('omw-units') || '{}') };
const history = [];
let result = null;

function loadModel() {
  try { const m = JSON.parse(store.get('omw-model')); if (m && !validate(m).length) return normalize(m); } catch { /* fall through */ }
  return structuredClone(DEFAULT_MODEL);
}

// ---- units (openMotor's own conversion factors, motorlib/units.py) --------------------------------

const imperial = () => units.length === 'in';
const UNITS = {
  length: () => imperial() ? ['in', 1 / 25.4] : ['mm', 1],
  pressureMPa: () => units.pressure === 'psi' ? ['psi', 1e6 / 6895] : ['MPa', 1],
  kPa: () => units.pressure === 'psi' ? ['psi', 1e3 / 6895] : ['kPa', 1],
  massFlux: () => imperial() ? ['lb/in²s', 0.001422] : ['kg/m²s', 1],
  density: () => imperial() ? ['lb/in³', 3.61273e-5] : ['kg/m³', 1],
  burnA: () => ['mm/s·MPaⁿ', 1],
  erosion: () => ['mm/s·MPa', 1],
  slag: () => ['mm·MPa/s', 1],
  deg: () => ['°', 1], K: () => ['K', 1], molar: () => ['g/mol', 1], s: () => ['s', 1], pct: () => ['%', 1],
};
const unitOf = kind => (kind ? UNITS[kind]() : ['', 1]);
// SI -> display, for results
const OUT = {
  pressure: () => units.pressure === 'psi' ? ['psi', 1 / 6895] : ['MPa', 1e-6],
  force: () => units.force === 'lbf' ? ['lbf', 0.2248] : ['N', 1],
  impulse: () => units.force === 'lbf' ? ['lbf·s', 0.2248] : ['Ns', 1],
  length: () => imperial() ? ['in', 39.37] : ['mm', 1000],
  mass: () => imperial() ? ['lb', 2.205] : ['g', 1000],
  massFlow: () => imperial() ? ['lb/s', 2.205] : ['kg/s', 1],
  massFlux: () => imperial() ? ['lb/in²s', 0.001422] : ['kg/m²s', 1],
  none: () => ['', 1], pct: () => ['%', 1], s: () => ['s', 1],
};
const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '-');
const outFmt = (v, kind, d = 2) => { const [u, f] = OUT[kind](); return `${fmt(v * f, d)} ${u}`.trim(); };
const decimals = (step, f) => Math.max(0, Math.min(6, Math.ceil(-Math.log10(step * f)) + 1));

// ---- inputs ------------------------------------------------------------------------------------

function field(obj, f, onChange = changed) {
  if (f.enum) {
    const sel = h('select', { onchange: e => { obj[f.key] = e.target.value; onChange(); } }, f.enum.map(v => h('option', { value: v, selected: obj[f.key] === v }, v)));
    return h('div', { class: 'field', title: f.help }, h('label', {}, f.label), sel);
  }
  const [u, fac] = unitOf(f.kind);
  const toSlider = v => f.log ? 1000 * Math.log(v / f.lo) / Math.log(f.hi / f.lo) : v;
  const fromSlider = s => f.log ? f.lo * (f.hi / f.lo) ** (s / 1000) : s;
  const d = decimals(f.step, fac);
  const range = h('input', f.log ? { type: 'range', min: 0, max: 1000, step: 1 } : { type: 'range', min: f.lo, max: f.hi, step: f.step });
  const num = h('input', { type: 'number', step: 'any' });
  const show = () => { range.value = toSlider(obj[f.key]); num.value = +(obj[f.key] * fac).toFixed(f.log ? 4 : d); };
  range.addEventListener('input', () => {
    let v = fromSlider(+range.value);
    if (f.log) v = +v.toPrecision(4);
    obj[f.key] = v; num.value = +(v * fac).toFixed(f.log ? 4 : d); onChange();
  });
  num.addEventListener('input', () => {
    const v = parseFloat(num.value) / fac;
    if (Number.isFinite(v) && v >= f.min && v <= f.max) { obj[f.key] = v; range.value = toSlider(v); onChange(); }
  });
  num.addEventListener('change', show);
  show();
  return h('div', { class: 'field', title: f.help }, h('label', {}, f.label), range, num, h('span', { class: 'unit', title: u }, u));
}

function grainSVG(g) {
  const s = 64, r = s / 2 - 2, cr = r * Math.min(g.coreDiameter_mm / g.diameter_mm, 0.98);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', 150); svg.setAttribute('height', s); svg.setAttribute('viewBox', `0 0 150 ${s}`);
  const el = (tag, a) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
  el('circle', { cx: s / 2, cy: s / 2, r, fill: 'var(--ink)' });
  el('circle', { cx: s / 2, cy: s / 2, r: cr, fill: 'var(--panel)' });
  // side view, head end at the left
  const L = Math.min(76, 76 * g.length_mm / Math.max(g.length_mm, g.diameter_mm * 1.5)), x0 = 70, H = 2 * r, y0 = 2;
  const ch = H * g.coreDiameter_mm / g.diameter_mm;
  el('rect', { x: x0, y: y0, width: L, height: H, fill: 'var(--ink)' });
  el('rect', { x: x0, y: y0 + (H - ch) / 2, width: L, height: ch, fill: 'var(--panel)' });
  const inh = g.inhibitedEnds;
  if (inh === 'Top' || inh === 'Both') el('rect', { x: x0 - 3, y: y0, width: 3, height: H, fill: 'var(--accent)' });
  if (inh === 'Bottom' || inh === 'Both') el('rect', { x: x0 + L, y: y0, width: 3, height: H, fill: 'var(--accent)' });
  return svg;
}

const openState = JSON.parse(store.get('omw-open') || '{"grains":true,"nozzle":true,"propellant":true,"config":false}');
function section(id, title, extra, ...body) {
  const d = h('details', { class: 'card', open: openState[id] }, h('summary', {}, title, extra), h('div', { class: 'body' }, ...body));
  d.addEventListener('toggle', () => { openState[id] = d.open; store.set('omw-open', JSON.stringify(openState)); });
  return d;
}

function renderInputs() {
  const G = model.grains;
  const move = (i, j) => { [G[i], G[j]] = [G[j], G[i]]; structural(); };
  const grains = G.map((g, i) => {
    const viz = h('div', { class: 'grain-viz' }, grainSVG(g), h('div', { class: 'cap' }, `web ${fmt((g.diameter_mm - g.coreDiameter_mm) / 2 * unitOf('length')[1], 1)} ${unitOf('length')[0]}`));
    const refresh = () => { viz.firstChild.replaceWith(grainSVG(g)); viz.lastChild.textContent = `web ${fmt((g.diameter_mm - g.coreDiameter_mm) / 2 * unitOf('length')[1], 1)} ${unitOf('length')[0]}`; changed(); };
    return h('div', { class: 'grain' },
      h('div', { class: 'grain-head' }, h('b', {}, `Grain ${i + 1} · BATES`), h('span', { class: 'btns' },
        h('button', { title: 'Move forward', disabled: i === 0, onclick: () => move(i, i - 1) }, '↑'),
        h('button', { title: 'Move aft', disabled: i === G.length - 1, onclick: () => move(i, i + 1) }, '↓'),
        h('button', { title: 'Duplicate', onclick: () => { G.splice(i + 1, 0, structuredClone(g)); structural(); } }, 'Copy'),
        h('button', { title: 'Remove', disabled: G.length === 1, onclick: () => { G.splice(i, 1); structural(); } }, '✕'))),
      viz,
      FIELDS.grain.map(f => field(g, f, refresh)));
  });
  const p = model.propellant;
  const presetSel = h('select', { onchange: e => { model.propellant = structuredClone(PRESETS[+e.target.value]); structural(); } },
    PRESETS.map((pr, i) => h('option', { value: i, selected: pr.name === p.name }, pr.name)),
    PRESETS.some(pr => pr.name === p.name) ? null : h('option', { selected: true, disabled: true }, p.name));
  const multi = p.tabs.length > 1;
  const tabs = p.tabs.map((t, i) => h('div', { class: 'tab' },
    multi ? h('div', { class: 'tab-title' }, `Burn rate tab ${i + 1}`) : null,
    FIELDS.tab.filter(f => multi || !f.key.endsWith('Pressure_MPa')).map(f => field(t, f))));
  $('#inputs').replaceChildren(
    section('grains', `Grains (${G.length})`, null, grains, h('button', { onclick: () => { G.push(structuredClone(G[G.length - 1])); structural(); } }, '+ Add grain')),
    section('nozzle', 'Nozzle', null, FIELDS.nozzle.map(f => field(model.nozzle, f))),
    section('propellant', 'Propellant', null,
      h('div', { class: 'field' }, h('label', {}, 'Preset'), presetSel),
      FIELDS.propellant.map(f => field(p, f)), tabs),
    section('config', 'Config & limits', null, FIELDS.config.map(f => field(model.config, f))),
  );
}

function structural() { renderInputs(); changed(); }

// ---- simulation loop ---------------------------------------------------------------------------

let simQueued = false, fixTimer = 0;
function changed() {
  if (simQueued) return;
  simQueued = true;
  requestAnimationFrame(() => { simQueued = false; run(); });
}

function run() {
  store.set('omw-model', JSON.stringify(model));
  if (validate(model).length) { renderBlocked(validate(model)); return; }
  result = simulate(model);
  renderStats(result);
  renderChart(result);
  renderAlerts(result, null);
  // Suggestions re-run the sim many times; wait for the slider to settle.
  clearTimeout(fixTimer);
  const r = result;
  fixTimer = setTimeout(() => { if (r === result) renderAlerts(r, suggestFixes(model, r)); }, 150);
}

function renderBlocked(errs) {
  result = null;
  $('#stats').replaceChildren(h('div', { class: 'blocked' }, 'Fix the inputs to simulate.'));
  renderChart(null);
  $('#alerts').replaceChildren(h('div', { class: 'body err', style: 'padding:12px' }, errs.join('\n')));
}

function renderStats(r) {
  const el = $('#stats');
  if (!r.success) { el.replaceChildren(h('div', { class: 'blocked' }, 'All errors must be resolved to view simulation results.')); return; }
  const flux = r.getPeakMassFlux();
  const rows = [
    ['Motor designation', `${r.getDesignation()} (${Math.round(r.getImpulseClassPercentage() * 100)}%)`, true],
    ['Impulse', outFmt(r.getImpulse(), 'impulse'), true],
    ['Delivered ISP', `${fmt(r.getISP())} s`],
    ['Burn time', `${fmt(r.getBurnTime())} s`, true],
    ['Volume loading', `${fmt(r.getVolumeLoading())}%`],
    ['Average pressure', outFmt(r.getAveragePressure(), 'pressure')],
    ['Peak pressure', outFmt(r.getMaxPressure(), 'pressure'), true],
    ['Initial Kn', fmt(r.getInitialKN())],
    ['Peak Kn', fmt(r.getPeakKN())],
    ['Ideal thrust coeff.', fmt(r.getIdealThrustCoefficient())],
    ['Propellant mass', outFmt(r.getPropellantMass(), 'mass')],
    ['Propellant length', `ø${outFmt(r.getMaxPropellantDiameter(), 'length')} × ${outFmt(r.getPropellantLength(), 'length')}`],
    ['Port/throat ratio', fmt(r.getPortRatio())],
    ['Peak mass flux', `${outFmt(flux, 'massFlux')} (G: ${r.getPeakMassFluxLocation() + 1})`],
    ['Delivered thrust coeff.', fmt(r.getAdjustedThrustCoefficient())],
  ];
  el.replaceChildren(...rows.map(([k, v, big]) => h('div', { class: 'stat' + (big ? ' big' : '') }, h('span', {}, k), h('span', {}, v))));
  const warn = r.alerts.length;
  $('#mini').replaceChildren(h('b', {}, r.getDesignation()), ` · ${outFmt(r.getImpulse(), 'impulse', 0)} · ${fmt(r.getBurnTime())} s · ${outFmt(r.getMaxPressure(), 'pressure', units.pressure === 'psi' ? 0 : 2)}`,
    warn ? h('span', { class: 'mini-warn' }, ` ⚠ ${warn}`) : h('span', { class: 'mini-ok' }, ' ✓'));
}

// ---- chart -------------------------------------------------------------------------------------

const SERIES = [
  { ch: 'kn', label: 'Kn', out: 'none', on: true, color: '#1f77b4' },
  { ch: 'pressure', label: 'Chamber Pressure', out: 'pressure', on: true, color: '#ff7f0e' },
  { ch: 'force', label: 'Thrust', out: 'force', on: true, color: '#2ca02c' },
  { ch: 'mass', label: 'Propellant Mass', out: 'mass', grain: true },
  { ch: 'volumeLoading', label: 'Volume Loading', out: 'pct' },
  { ch: 'massFlow', label: 'Mass Flow', out: 'massFlow', grain: true },
  { ch: 'massFlux', label: 'Mass Flux', out: 'massFlux', grain: true },
  { ch: 'regression', label: 'Regression Depth', out: 'length', grain: true },
  { ch: 'web', label: 'Web', out: 'length', grain: true, on: true, color: '#d62728' },
  { ch: 'exitPressure', label: 'Nozzle Exit Pressure', out: 'pressure' },
  { ch: 'dThroat', label: 'Change in Throat Diameter', out: 'length' },
  { ch: 'machNumber', label: 'Core Mach Number', out: 'none', grain: true },
];
const XS = [{ ch: 'time', label: 'Time', out: 's' }, { ch: 'regression', label: 'Regression Depth', out: 'length' }, { ch: 'web', label: 'Web', out: 'length' }];
const PALETTE = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
const pick = { x: 'time', on: Object.fromEntries(SERIES.map(s => [s.ch, !!s.on])), grains: { 0: true }, ...JSON.parse(store.get('omw-pick') || '{}') };
let plot = null;

function renderPick() {
  const save = () => { store.set('omw-pick', JSON.stringify(pick)); renderChart(result); };
  const n = model.grains.length;
  $('#pick').replaceChildren(...[
    h('h4', {}, 'X axis'),
    XS.map(x => h('label', {}, h('input', { type: 'radio', name: 'xax', checked: pick.x === x.ch, onchange: () => { pick.x = x.ch; save(); } }), x.label)),
    h('h4', {}, 'Y axis'),
    SERIES.map(s => h('label', {}, h('input', { type: 'checkbox', checked: pick.on[s.ch], onchange: e => { pick.on[s.ch] = e.target.checked; save(); } }), s.label)),
    h('h4', {}, 'Grains'),
    Array.from({ length: n }, (_, i) => h('label', {}, h('input', { type: 'checkbox', checked: !!pick.grains[i], onchange: e => { pick.grains[i] = e.target.checked; save(); } }), `Grain ${i + 1}`)),
  ].flat());
}

function renderChart(r) {
  renderPick();
  const box = $('#chart');
  if (plot) { plot.destroy(); plot = null; }
  if (!r || !r.success) return;
  const C = r.channels, n = model.grains.length;
  const grains = Array.from({ length: n }, (_, i) => i).filter(i => pick.grains[i]);
  const xg = grains.length ? grains[0] : 0; // openMotor also plots per-grain x channels against the selected grain
  const X = XS.find(x => x.ch === pick.x);
  const [xu, xf] = OUT[X.out]();
  let xs = (X.ch === 'time' ? C.time : C[X.ch].map(v => v[xg])).map(v => v * xf);
  const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b] || a - b); // uPlot needs ascending x
  xs = order.map(i => xs[i]);
  const series = [{ label: `${X.label} (${xu})` }], data = [xs];
  SERIES.forEach((s, si) => {
    if (!pick.on[s.ch]) return;
    const [u, f] = OUT[s.out]();
    // colors follow the series (and grain), not the plotting order, so toggling doesn't recolor lines
    const add = (label, vals, g = 0) => {
      series.push({ label: u ? `${label} - ${u}` : label, stroke: g === 0 && s.color ? s.color : PALETTE[(si + 3 * g) % PALETTE.length], width: 2, points: { show: false } });
      data.push(order.map(i => vals[i] * f));
    };
    if (s.grain) grains.forEach((g, k) => add(`${s.label} - Grain ${g + 1}`, C[s.ch].map(v => v[g]), k));
    else add(s.label, C[s.ch]);
  });
  const width = Math.max(260, box.clientWidth), height = Math.max(240, Math.min(440, width * 0.55));
  const css = getComputedStyle(document.documentElement);
  const axis = { stroke: css.getPropertyValue('--muted'), grid: { stroke: css.getPropertyValue('--line'), width: 1 }, ticks: { stroke: css.getPropertyValue('--line') } };
  plot = new uPlot({
    width, height, series,
    scales: { x: { time: false }, y: { range: (u, lo, hi) => [Math.min(0, lo), hi > 0 ? hi * 1.05 : 1] } },
    axes: [{ ...axis, label: `${X.label} - ${xu}` }, { ...axis, size: 56 }],
    cursor: { drag: { x: false, y: false }, points: { size: 7 } },
    legend: { show: false },
    hooks: { setCursor: [u => tooltip(u)] },
  }, data, box);
}

function tooltip(u) {
  const tip = $('#tip'), i = u.cursor.idx;
  if (i == null || u.cursor.left < 0) { tip.style.display = 'none'; return; }
  const rows = u.series.slice(1).map((s, k) => h('div', {}, h('span', { class: 'sw', style: `background:${s.stroke()}` }), `${s.label}: `, h('b', { style: 'display:inline' }, fmt(u.data[k + 1][i], 3))));
  tip.replaceChildren(h('b', {}, `${u.series[0].label.replace(/ \(.*/, '')}: ${fmt(u.data[0][i], 3)}`), ...rows);
  tip.style.display = 'block';
  const over = u.over.getBoundingClientRect(), box = $('#chart').getBoundingClientRect();
  let left = over.left - box.left + u.cursor.left + 14, top = over.top - box.top + u.cursor.top + 14;
  if (left + tip.offsetWidth > box.width) left -= tip.offsetWidth + 28;
  if (top + tip.offsetHeight > box.height) top = Math.max(0, top - tip.offsetHeight - 28);
  tip.style.left = `${left}px`; tip.style.top = `${top}px`;
}

new ResizeObserver(() => { if (plot) plot.setSize({ width: Math.max(260, $('#chart').clientWidth), height: Math.max(240, Math.min(440, $('#chart').clientWidth * 0.55)) }); }).observe($('#chart'));

// ---- alerts + fixes ----------------------------------------------------------------------------

function renderAlerts(r, fixes) {
  const el = $('#alerts');
  if (!r.alerts.length) { el.replaceChildren(h('div', { class: 'none' }, '✓ No alerts')); return; }
  const rows = r.alerts.map((a, i) => {
    const fx = fixes && fixes[i];
    let fix = null;
    if (fx && (fx.text || fx.actions.length)) {
      fix = h('div', { class: 'fix' }, h('p', {}, fx.text),
        h('div', { class: 'acts' }, fx.actions.map(act => {
          const res = act.result;
          const sub = res === undefined ? null : !res ? h('span', { class: 'res' }, 'sim fails with this') :
            h('span', { class: 'res' }, act.clears ? h('span', { class: 'ok' }, '✓ clears · ') : '✗ not enough · ',
              `${res.getDesignation()}, ${outFmt(res.getImpulse(), 'impulse', 0)}, peak ${outFmt(res.getMaxPressure(), 'pressure', units.pressure === 'psi' ? 0 : 2)}`);
          return h('button', { onclick: () => tryIt(act) }, `Try: ${act.label}`, sub);
        })));
    } else if (!fixes) fix = h('div', { class: 'fix', style: 'color:var(--muted)' }, 'working out fixes…');
    return h('tr', {}, h('td', {}, h('span', { class: `lvl ${a.level}` }, a.level)), h('td', {}, a.type), h('td', {}, a.location || ''), h('td', {}, a.description, fix));
  });
  el.replaceChildren(h('table', { class: 'alerts' }, h('thead', {}, h('tr', {}, h('th', {}, 'Level'), h('th', {}, 'Type'), h('th', {}, 'Location'), h('th', {}, 'Details'))), h('tbody', {}, rows)));
}

function remember() { history.push(JSON.stringify(model)); $('#undo').disabled = false; }
function tryIt(act) { remember(); act.apply(model); structural(); toast(act.label); }
$('#undo').onclick = () => { if (!history.length) return; model = JSON.parse(history.pop()); $('#undo').disabled = !history.length; structural(); };

// ---- header actions ----------------------------------------------------------------------------

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1800); }
async function copy(text, what) {
  try { await navigator.clipboard.writeText(text); toast(`${what} copied`); }
  catch { const ta = h('textarea', {}, text); document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast(`${what} copied`); }
}
const exportText = () => JSON.stringify(normalize(model), null, 2);
$('#export').onclick = () => copy(exportText(), 'JSON');
$('#download').onclick = () => {
  const a = h('a', { href: URL.createObjectURL(new Blob([exportText()], { type: 'application/json' })), download: 'motor.json' });
  a.click(); URL.revokeObjectURL(a.href);
};
$('#llm').onclick = () => copy(llmContext(model, result && result.success ? result : null), 'LLM context');
$('#reset').onclick = () => { remember(); model = structuredClone(DEFAULT_MODEL); structural(); };

const dlg = $('#importDlg'), itext = $('#importText'), ierr = $('#importErr');
$('#import').onclick = () => { ierr.textContent = ''; itext.value = ''; dlg.showModal(); };
$('#importCancel').onclick = () => dlg.close();
$('#importPaste').onclick = async () => { try { itext.value = await navigator.clipboard.readText(); } catch { ierr.textContent = 'Clipboard not readable here; paste with Ctrl/Cmd+V.'; } };
const readFile = f => f && f.text().then(t => { itext.value = t; });
$('#importFile').onchange = e => readFile(e.target.files[0]);
itext.addEventListener('dragover', e => { e.preventDefault(); dlg.classList.add('drag'); });
itext.addEventListener('dragleave', () => dlg.classList.remove('drag'));
itext.addEventListener('drop', e => { e.preventDefault(); dlg.classList.remove('drag'); readFile(e.dataTransfer.files[0]); });
$('#importApply').onclick = () => {
  const r = importJSON(itext.value);
  if (r.length) { ierr.textContent = r.join('\n'); return; }
  dlg.close(); toast('Imported');
};
function importJSON(text) {
  let m;
  // LLMs like to wrap JSON in prose or code fences; take the outermost object.
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  try { m = JSON.parse(s >= 0 ? text.slice(s, e + 1) : text); } catch (err) { return [`Not valid JSON: ${err.message}`]; }
  const errs = validate(m);
  if (errs.length) return errs;
  remember(); model = normalize(m); structural();
  return [];
}
window.omw = { importJSON, exportText, get model() { return model; }, get result() { return result; } }; // for automation/tests

function syncUnits() {
  document.querySelectorAll('.seg').forEach(seg => seg.querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', units[seg.dataset.unit] === b.dataset.v);
    b.onclick = () => { units[seg.dataset.unit] = b.dataset.v; store.set('omw-units', JSON.stringify(units)); syncUnits(); structural(); };
  }));
}
syncUnits();
structural();
