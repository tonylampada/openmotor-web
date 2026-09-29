// The web app's input schema: defaults, presets, field specs (drive the sliders, validation and the
// LLM context), import validation, and fix suggestions for each openMotor alert.
import { simulate } from './motorlib.js';

export const SCHEMA = 'openmotor-web/1';

// Propellants shipped with openMotor (uilib/defaults.py), converted to this schema.
const OPENMOTOR_PROPELLANTS = [{"name": "MIT - Cherry Limeade", "density_kg_m3": 1670, "k": 1.21, "combustionTemp_K": 2800, "molarMass_g_mol": 23.67, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 6.895, "a_mm_per_s_MPa_n": 3.23578, "n": 0.3273}]}, {"name": "MIT - Ocean Water", "density_kg_m3": 1650, "k": 1.25, "combustionTemp_K": 2600, "molarMass_g_mol": 23.67, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 6.895, "a_mm_per_s_MPa_n": 2.87363, "n": 0.382}]}, {"name": "Nakka - KNDX", "density_kg_m3": 1785, "k": 1.1308, "combustionTemp_K": 1625.0, "molarMass_g_mol": 42.39, "tabs": [{"minPressure_MPa": 0.103425, "maxPressure_MPa": 0.779135, "a_mm_per_s_MPa_n": 8.84916, "n": 0.619}, {"minPressure_MPa": 0.779135, "maxPressure_MPa": 2.571835, "a_mm_per_s_MPa_n": 7.55339, "n": -0.009}, {"minPressure_MPa": 2.571835, "maxPressure_MPa": 5.9297, "a_mm_per_s_MPa_n": 3.89846, "n": 0.688}, {"minPressure_MPa": 5.9297, "maxPressure_MPa": 8.501535, "a_mm_per_s_MPa_n": 17.2187, "n": -0.148}, {"minPressure_MPa": 8.501535, "maxPressure_MPa": 11.204375, "a_mm_per_s_MPa_n": 4.86121, "n": 0.444}]}, {"name": "Nakka - KNSB", "density_kg_m3": 1750, "k": 1.1361, "combustionTemp_K": 1520.0, "molarMass_g_mol": 39.9, "tabs": [{"minPressure_MPa": 0.103425, "maxPressure_MPa": 0.806715, "a_mm_per_s_MPa_n": 10.8269, "n": 0.625}, {"minPressure_MPa": 0.806715, "maxPressure_MPa": 1.50311, "a_mm_per_s_MPa_n": 8.81562, "n": -0.313}, {"minPressure_MPa": 1.50311, "maxPressure_MPa": 3.79225, "a_mm_per_s_MPa_n": 7.79843, "n": -0.0145}, {"minPressure_MPa": 3.79225, "maxPressure_MPa": 7.0329, "a_mm_per_s_MPa_n": 3.80116, "n": 0.5245}, {"minPressure_MPa": 7.0329, "maxPressure_MPa": 10.67346, "a_mm_per_s_MPa_n": 9.43715, "n": 0.059}]}, {"name": "Nakka - KNSU", "density_kg_m3": 1800, "k": 1.133, "combustionTemp_K": 1720, "molarMass_g_mol": 41.98, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 8.2635, "n": 0.319}]}, {"name": "RCS - White Lightning", "density_kg_m3": 1820.230130676801, "k": 1.243, "combustionTemp_K": 2339.0, "molarMass_g_mol": 27.125, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 2.86204, "n": 0.45}]}, {"name": "RCS - Blue Thunder", "density_kg_m3": 1625.0868456817973, "k": 1.235, "combustionTemp_K": 2616.5, "molarMass_g_mol": 22.959, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 5.89879, "n": 0.321}]}, {"name": "RCS - Black Jack", "density_kg_m3": 2085.95715705, "k": 1.247, "combustionTemp_K": 1428.99, "molarMass_g_mol": 30.561, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 2.67843, "n": 0.056}]}, {"name": "RCS - Redline", "density_kg_m3": 1729.9936613, "k": 1.225, "combustionTemp_K": 2238.589, "molarMass_g_mol": 26.502, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 4.66324, "n": 0.366}]}, {"name": "RCS - Black Max", "density_kg_m3": 2021.18619437, "k": 1.275, "combustionTemp_K": 1462.331, "molarMass_g_mol": 27.627, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 3.68237, "n": 0.398}]}, {"name": "RCS - Warp 9", "density_kg_m3": 1641.41798584, "k": 1.229, "combustionTemp_K": 2780.64, "molarMass_g_mol": 23.669, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 13.0341, "n": 0.287}]}, {"name": "RCS - Mojave Green", "density_kg_m3": 1807.77417632, "k": 1.209, "combustionTemp_K": 2913.486, "molarMass_g_mol": 29.784, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 4.81044, "n": 0.462}]}, {"name": "RCS - Classic", "density_kg_m3": 1646.95396556, "k": 1.225, "combustionTemp_K": 2887.981, "molarMass_g_mol": 24.145, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 3.85356, "n": 0.323}]}, {"name": "RCS - Metalstorm", "density_kg_m3": 1819.39973372, "k": 1.21, "combustionTemp_K": 2558.168, "molarMass_g_mol": 29.153, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 2.86204, "n": 0.45}]}, {"name": "RCS - Metalstorm DM", "density_kg_m3": 1697.88497895, "k": 1.257, "combustionTemp_K": 1895.29, "molarMass_g_mol": 23.262, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 4.68632, "n": 0.334}]}, {"name": "RCS - Propellant X (K1103X)", "density_kg_m3": 1746.60160045, "k": 1.177, "combustionTemp_K": 3442.461, "molarMass_g_mol": 27.704, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 6.48795, "n": 0.358}]}, {"name": "RCS - Super Thunder", "density_kg_m3": 1644.1859757, "k": 1.223, "combustionTemp_K": 2737.657, "molarMass_g_mol": 23.767, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 12.5122, "n": 0.277}]}, {"name": "RCS - Slow White Lightning", "density_kg_m3": 1815.8013469, "k": 1.245, "combustionTemp_K": 2364.133, "molarMass_g_mol": 27.022, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 2.55843, "n": 0.346}]}, {"name": "RCS - New Blue Thunder", "density_kg_m3": 1702.59056171, "k": 1.203, "combustionTemp_K": 3184.414, "molarMass_g_mol": 26.005, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 4.24126, "n": 0.41}]}, {"name": "RCS - Slower White Lightning", "density_kg_m3": 1815.8013469, "k": 1.245, "combustionTemp_K": 2364.133, "molarMass_g_mol": 27.022, "tabs": [{"minPressure_MPa": 0.0, "maxPressure_MPa": 10.3425, "a_mm_per_s_MPa_n": 2.32703, "n": 0.244}]}];

// Not in openMotor. Fitted with the real openMotor to the captain's run of "Propelente KNSB com ~1.5% céria"
// (2x BATES 39x110 mm, 12 mm core, 12 mm throat -> I980, 617 Ns, 0.60 s, ~1150 psi, 437.79 g).
export const KNSB_CERIA = {
  name: 'KNSB + ~1.5% ceria', density_kg_m3: 1840, k: 1.1361, combustionTemp_K: 1705, molarMass_g_mol: 39.9,
  tabs: [{ minPressure_MPa: 0, maxPressure_MPa: 10.3425, a_mm_per_s_MPa_n: 11.10, n: 0.405 }],
};

export const PRESETS = [KNSB_CERIA, ...OPENMOTOR_PROPELLANTS];

const bates = () => ({ type: 'BATES', diameter_mm: 39, length_mm: 110, coreDiameter_mm: 12, inhibitedEnds: 'Neither' });

// openMotor's default preferences (uilib/defaults.py) for the config block.
export const DEFAULT_MODEL = {
  schema: SCHEMA,
  grains: [bates(), bates()],
  nozzle: {
    throat_mm: 12, exit_mm: 47.5, efficiency: 0.99, divAngle_deg: 15, convAngle_deg: 45,
    throatLength_mm: 0, slagCoeff_mm_MPa_per_s: 0, erosionCoeff_mm_per_s_MPa: 0,
  },
  propellant: structuredClone(KNSB_CERIA),
  config: {
    ambPressure_kPa: 101.325, timestep_s: 0.03, maxPressure_MPa: 10.3425, maxMassFlux_kg_m2s: 1406.47,
    minPortThroat: 2, maxMachNumber: 0.7, burnoutWebThres_mm: 0.0254, burnoutThrustThres_pct: 0.1,
    sepPressureRatio: 0.4, flowSeparationWarnPercent: 0.05,
  },
};

// kind: display unit family (see UNITS in app.js). min/max: hard validity range (openMotor's property
// limits where it has them). lo/hi: slider travel. log: slider moves on a log scale.
export const FIELDS = {
  grain: [
    { key: 'diameter_mm', label: 'Diameter', kind: 'length', min: 0.1, max: 6600, lo: 10, hi: 200, step: 0.1, help: 'Outer diameter of the propellant grain (casting tube ID).' },
    { key: 'length_mm', label: 'Length', kind: 'length', min: 0.1, max: 24600, lo: 10, hi: 500, step: 0.5, help: 'Grain length.' },
    { key: 'coreDiameter_mm', label: 'Core diameter', kind: 'length', min: 0.1, max: 5000, lo: 1, hi: 150, step: 0.1, help: 'Diameter of the cylindrical core (must be < diameter).' },
    { key: 'inhibitedEnds', label: 'Inhibited ends', enum: ['Neither', 'Top', 'Bottom', 'Both'], help: 'Which grain faces are inhibited (do not burn). Top = forward/head end.' },
  ],
  nozzle: [
    { key: 'throat_mm', label: 'Throat', kind: 'length', min: 0.1, max: 6600, lo: 2, hi: 80, step: 0.1, help: 'Throat diameter. Bigger throat -> lower Kn and pressure.' },
    { key: 'exit_mm', label: 'Exit', kind: 'length', min: 0.1, max: 6600, lo: 2, hi: 200, step: 0.1, help: 'Exit diameter (>= throat). Sets expansion ratio (exit/throat)^2.' },
    { key: 'efficiency', label: 'Efficiency', min: 0.01, max: 2, lo: 0.5, hi: 1.1, step: 0.005, help: 'Nozzle efficiency multiplier on thrust coefficient (typ. 0.85-0.95).' },
    { key: 'divAngle_deg', label: 'Divergence half-angle', kind: 'deg', min: 0, max: 90, lo: 0, hi: 45, step: 0.5, help: 'Divergence losses = (1+cos a)/2.' },
    { key: 'convAngle_deg', label: 'Convergence half-angle', kind: 'deg', min: 0, max: 90, lo: 0, hi: 90, step: 0.5, help: 'Stored for completeness; openMotor does not use it in the sim.' },
    { key: 'throatLength_mm', label: 'Throat length', kind: 'length', min: 0, max: 2460, lo: 0, hi: 30, step: 0.1, help: 'Straight throat length; throat losses grow with length/diameter.' },
    { key: 'erosionCoeff_mm_per_s_MPa', label: 'Throat erosion coeff', kind: 'erosion', min: 0, max: 1e6, lo: 0, hi: 0.5, step: 0.001, help: 'Throat diameter grows by 2*coeff*P per second (mm/(s*MPa)).' },
    { key: 'slagCoeff_mm_MPa_per_s', label: 'Slag buildup coeff', kind: 'slag', min: 0, max: 1e6, lo: 0, hi: 10, step: 0.01, help: 'Throat diameter shrinks by 2*coeff/P per second ((mm*MPa)/s).' },
  ],
  propellant: [
    { key: 'density_kg_m3', label: 'Density', kind: 'density', min: 1, max: 10000, lo: 1000, hi: 2500, step: 1, help: 'Propellant density (kg/m^3).' },
    { key: 'k', label: 'Specific heat ratio k', min: 1.000001, max: 10, lo: 1.05, hi: 1.4, step: 0.0001, help: 'Ratio of specific heats of the exhaust.' },
    { key: 'combustionTemp_K', label: 'Combustion temp Tc', kind: 'K', min: 1, max: 10000, lo: 800, hi: 3600, step: 1, help: 'Combustion temperature (K). With molar mass sets c*.' },
    { key: 'molarMass_g_mol', label: 'Exhaust molar mass', kind: 'molar', min: 1e-6, max: 100, lo: 15, hi: 50, step: 0.01, help: 'Exhaust molar mass (g/mol).' },
  ],
  tab: [
    { key: 'a_mm_per_s_MPa_n', label: 'Burn rate coeff a', kind: 'burnA', min: 1e-6, max: 1e6, lo: 0.1, hi: 100, step: 0.001, log: true, help: 'St. Robert\'s law r = a*P^n with r in mm/s and P in MPa.' },
    { key: 'n', label: 'Burn rate exponent n', min: -0.99, max: 0.99, lo: -0.5, hi: 0.9, step: 0.001, help: 'Pressure exponent. Higher n -> pressure more sensitive to Kn.' },
    { key: 'minPressure_MPa', label: 'Valid from', kind: 'pressureMPa', min: 0, max: 70, lo: 0, hi: 20, step: 0.01, help: 'Lower bound of the pressure range this a/n applies to (MPa).' },
    { key: 'maxPressure_MPa', label: 'Valid to', kind: 'pressureMPa', min: 0, max: 70, lo: 0, hi: 20, step: 0.01, help: 'Upper bound of the pressure range this a/n applies to (MPa).' },
  ],
  config: [
    { key: 'maxPressure_MPa', label: 'Max pressure', kind: 'pressureMPa', min: 0, max: 70, lo: 1, hi: 20, step: 0.01, help: 'Alert when peak chamber pressure exceeds this.' },
    { key: 'maxMassFlux_kg_m2s', label: 'Max mass flux', kind: 'massFlux', min: 0, max: 10000, lo: 200, hi: 5000, step: 1, help: 'Alert when peak core mass flux exceeds this (kg/(m^2*s)).' },
    { key: 'minPortThroat', label: 'Min port/throat', min: 1, max: 4, lo: 1, hi: 4, step: 0.01, help: 'Alert when aft grain port area / throat area is below this.' },
    { key: 'maxMachNumber', label: 'Max core Mach', min: 0, max: 100, lo: 0.1, hi: 1, step: 0.01, help: 'Alert when core Mach number exceeds this.' },
    { key: 'ambPressure_kPa', label: 'Ambient pressure', kind: 'kPa', min: 0.0001, max: 102, lo: 1, hi: 102, step: 0.025, help: 'Ambient pressure (kPa). 101.325 at sea level.' },
    { key: 'timestep_s', label: 'Timestep', kind: 's', min: 0.0001, max: 0.1, lo: 0.001, hi: 0.1, step: 0.001, log: true, help: 'Simulation timestep (s).' },
    { key: 'burnoutWebThres_mm', label: 'Web burnout threshold', kind: 'length', min: 0.0254, max: 3.175, lo: 0.0254, hi: 3.175, step: 0.001, help: 'A grain is burnt out when remaining web is below this.' },
    { key: 'burnoutThrustThres_pct', label: 'Thrust burnout threshold', kind: 'pct', min: 0.01, max: 10, lo: 0.01, hi: 10, step: 0.01, help: 'Sim stops when thrust falls below this % of peak.' },
    { key: 'sepPressureRatio', label: 'Separation pressure ratio', min: 0.001, max: 1, lo: 0.1, hi: 1, step: 0.01, help: 'Exit pressure below ambient*ratio counts as possible flow separation (Summerfield 0.4).' },
    { key: 'flowSeparationWarnPercent', label: 'Separation warn fraction', min: 0, max: 1, lo: 0, hi: 1, step: 0.01, help: 'Warn when more than this fraction of samples are below the separation pressure.' },
  ],
};

// --- import validation -------------------------------------------------------------------------

export function validate(m) {
  const errs = [];
  const obj = (v, path) => (v && typeof v === 'object' && !Array.isArray(v)) || (errs.push(`${path}: expected an object`), false);
  const check = (o, fields, path) => {
    for (const f of fields) {
      const v = o[f.key], p = `${path}.${f.key}`;
      if (f.enum) { if (!f.enum.includes(v)) errs.push(`${p}: must be one of ${f.enum.join(', ')} (got ${JSON.stringify(v)})`); continue; }
      if (typeof v !== 'number' || !Number.isFinite(v)) errs.push(`${p}: expected a number (got ${JSON.stringify(v)})`);
      else if (v < f.min || v > f.max) errs.push(`${p}: ${v} is outside ${f.min}..${f.max}`);
    }
  };
  if (!obj(m, '$')) return errs;
  if (!Array.isArray(m.grains) || m.grains.length < 1 || m.grains.length > 20) errs.push('grains: expected an array of 1-20 grains');
  else m.grains.forEach((g, i) => {
    if (!obj(g, `grains[${i}]`)) return;
    if (g.type !== 'BATES') errs.push(`grains[${i}].type: only "BATES" is supported`);
    check(g, FIELDS.grain, `grains[${i}]`);
    if (g.coreDiameter_mm >= g.diameter_mm) errs.push(`grains[${i}]: coreDiameter_mm must be less than diameter_mm`);
  });
  if (obj(m.nozzle, 'nozzle')) { check(m.nozzle, FIELDS.nozzle, 'nozzle'); if (m.nozzle.exit_mm < m.nozzle.throat_mm) errs.push('nozzle: exit_mm must be >= throat_mm'); }
  if (obj(m.propellant, 'propellant')) {
    check(m.propellant, FIELDS.propellant, 'propellant');
    if (typeof m.propellant.name !== 'string') errs.push('propellant.name: expected a string');
    if (!Array.isArray(m.propellant.tabs) || !m.propellant.tabs.length) errs.push('propellant.tabs: expected a non-empty array');
    else m.propellant.tabs.forEach((t, i) => obj(t, `propellant.tabs[${i}]`) && check(t, FIELDS.tab, `propellant.tabs[${i}]`));
  }
  if (obj(m.config, 'config')) check(m.config, FIELDS.config, 'config');
  return errs;
}

// Keeps only schema keys, in schema order, so export is canonical and import ignores extras.
export function normalize(m) {
  const pick = (o, fields) => Object.fromEntries(fields.map(f => [f.key, o[f.key]]));
  return {
    schema: SCHEMA,
    grains: m.grains.map(g => ({ type: 'BATES', ...pick(g, FIELDS.grain) })),
    nozzle: pick(m.nozzle, FIELDS.nozzle),
    propellant: { name: m.propellant.name, ...pick(m.propellant, FIELDS.propellant), tabs: m.propellant.tabs.map(t => pick(t, FIELDS.tab)) },
    config: pick(m.config, FIELDS.config),
  };
}

// --- fix suggestions ---------------------------------------------------------------------------
// Every number here comes from the equations or from re-running the real sim on the changed motor,
// never from rules of thumb.

const has = (res, text) => res.alerts.some(a => a.description.includes(text));
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const ceil1 = v => Math.ceil(v * 10 - 1e-9) / 10;
const floor1 = v => Math.floor(v * 10 + 1e-9) / 10;

function tryRun(m) { try { const r = simulate(m); return r.success ? r : null; } catch { return null; } }

// Smallest (dir=+1) or largest (dir=-1) x in [lo,hi] where ok(x) holds, assuming ok is monotone.
function search(ok, lo, hi, dir, iters = 30) {
  const good = dir > 0 ? hi : lo, bad = dir > 0 ? lo : hi;
  if (!ok(good)) return null;
  let g = good, b = bad;
  for (let i = 0; i < iters; i++) { const mid = (g + b) / 2; if (ok(mid)) g = mid; else b = mid; }
  return g;
}

const setCores = v => m => { m.grains.forEach(g => { if (g.coreDiameter_mm < v) g.coreDiameter_mm = v; }); };
const setThroat = v => m => { m.nozzle.throat_mm = v; };
const setExit = v => m => { m.nozzle.exit_mm = v; };
const applied = (m, fn) => { const c = structuredClone(m); fn(c); return c; };

function action(model, label, fn, clears) {
  const next = applied(model, fn);
  const r = tryRun(next);
  return { label, apply: fn, model: next, result: r, clears: r ? !has(r, clears) : false };
}

export function suggestFixes(model, res) {
  const out = [];
  const cfg = model.config, noz = model.nozzle, G = model.grains;
  const aft = G[G.length - 1];
  const minCoreGap = 1; // mm of web kept when searching core sizes
  const maxDia = Math.min(...G.map(g => g.diameter_mm));
  const flux = r => r.getPeakMassFlux();

  for (const a of res.alerts) {
    const d = a.description;
    const s = { alert: a, text: '', actions: [] };

    if (d.startsWith('Initial port/throat ratio')) {
      // Port/throat only looks at the aft grain: (core/throat)^2 >= min  =>  core >= throat*sqrt(min)
      const core = ceil1(noz.throat_mm * Math.sqrt(cfg.minPortThroat));
      const throat = floor1(aft.coreDiameter_mm / Math.sqrt(cfg.minPortThroat));
      s.text = `The aft grain's port is too small for the throat: gas has to squeeze through a core only ${round(Math.sqrt(res.getPortRatio()), 2)}x the throat diameter, which causes erosive burning and pressure spikes. Port/throat = (core ÷ throat)² must reach ${cfg.minPortThroat}, so core ≥ throat × √${cfg.minPortThroat} = ${core} mm, or throat ≤ ${throat} mm.`;
      if (core < aft.diameter_mm) s.actions.push(action(model, `Open cores to ${core} mm`, setCores(core), 'port/throat'));
      if (throat > 0) s.actions.push(action(model, `Shrink throat to ${throat} mm`, setThroat(throat), 'port/throat'));
    } else if (d.startsWith('Peak mass flux')) {
      const lim = cfg.maxMassFlux_kg_m2s;
      s.text = `Too much gas is flowing through the aft end of the core (peak ${round(flux(res), 0)} vs limit ${lim} kg/(m²·s), grain ${res.getPeakMassFluxLocation() + 1}). Levers: a bigger core (more flow area, less burning surface), fewer grains (less upstream mass), inhibiting faces, or a bigger throat (lower pressure, slower burn).`;
      const okFlux = fn => x => { const r = tryRun(applied(model, fn(x))); return !!r && flux(r) <= lim; };
      const curCore = Math.max(...G.map(g => g.coreDiameter_mm));
      const c = search(okFlux(setCores), curCore, maxDia - 2 * minCoreGap, +1);
      if (c != null) s.actions.push(action(model, `Open cores to ${ceil1(c)} mm`, setCores(ceil1(c)), 'mass flux'));
      if (G.length > 1) s.actions.push(action(model, `Remove grain ${G.length} (${G.length - 1} grains)`, m => { m.grains.pop(); }, 'mass flux'));
      s.actions.push(action(model, 'Inhibit both ends of all grains', m => m.grains.forEach(g => { g.inhibitedEnds = 'Both'; }), 'mass flux'));
      const t = search(okFlux(setThroat), noz.throat_mm, Math.min(noz.exit_mm, maxDia), +1);
      if (t != null) s.actions.push(action(model, `Open throat to ${ceil1(t)} mm`, setThroat(ceil1(t)), 'mass flux'));
    } else if (d.startsWith('Max pressure exceeded')) {
      const lim = cfg.maxPressure_MPa * 1e6;
      s.text = `Peak chamber pressure ${round(res.getMaxPressure() / 1e6, 2)} MPa is over your ${cfg.maxPressure_MPa} MPa limit. Pressure follows Kn = burning area ÷ throat area, so a bigger throat is the direct lever.`;
      const t = search(x => { const r = tryRun(applied(model, setThroat(x))); return !!r && r.getMaxPressure() <= lim; }, noz.throat_mm, Math.min(noz.exit_mm, maxDia), +1);
      if (t != null) s.actions.push(action(model, `Open throat to ${ceil1(t)} mm`, setThroat(ceil1(t)), 'Max pressure'));
    } else if (d.startsWith('Max core Mach')) {
      s.text = 'Core gas speed is too high near the aft end. A bigger core gives the flow more area.';
      const curCore = Math.max(...G.map(g => g.coreDiameter_mm));
      const c = search(x => { const r = tryRun(applied(model, setCores(x))); return !!r && !has(r, 'Mach'); }, curCore, maxDia - 2 * minCoreGap, +1);
      if (c != null) s.actions.push(action(model, `Open cores to ${ceil1(c)} mm`, setCores(ceil1(c)), 'Mach'));
    } else if (d.startsWith('Low exit pressure')) {
      const thres = cfg.ambPressure_kPa * cfg.sepPressureRatio;
      s.text = `The nozzle over-expands: for more than ${round(cfg.flowSeparationWarnPercent * 100, 0)}% of the burn the exit pressure is below ${round(thres, 1)} kPa (ambient × ${cfg.sepPressureRatio}), so flow may separate from the wall. Expansion ratio (exit ÷ throat)² = ${round((noz.exit_mm / noz.throat_mm) ** 2, 2)} is too large for this pressure; a smaller exit fixes it.`;
      const exitFix = base => search(x => { const r = tryRun(applied(base, setExit(x))); return !!r && !has(r, 'Low exit pressure'); }, noz.throat_mm, noz.exit_mm, -1);
      const e = exitFix(model);
      if (e != null) s.actions.push(action(model, `Shrink exit to ${floor1(e)} mm`, setExit(floor1(e)), 'Low exit pressure'));
      else {
        // The ignition sample (exit pressure 0) and the burnout sample always count as "below", so at a
        // coarse timestep they alone can exceed the warn fraction. A finer timestep shrinks their share.
        const dt = Math.min(cfg.timestep_s, 0.01);
        const withDt = m => { m.config.timestep_s = dt; };
        const e2 = exitFix(applied(model, withDt));
        s.text += ` At a ${cfg.timestep_s} s timestep the ignition and burnout samples alone are ${round(2 / res.channels.time.length * 100, 0)}% of the samples, so no exit size can clear this; a finer timestep is needed too.`;
        if (e2 != null) { const x = floor1(e2); s.actions.push(action(model, `Exit ${x} mm + timestep ${dt} s`, m => { withDt(m); setExit(x)(m); }, 'Low exit pressure')); }
      }
    } else if (d.startsWith('Chamber pressure deviated')) {
      const t = model.propellant.tabs;
      s.text = `Chamber pressure left the range where this propellant's burn rate is characterized (${Math.min(...t.map(x => x.minPressure_MPa))}–${Math.max(...t.map(x => x.maxPressure_MPa))} MPa); openMotor extrapolates with the nearest a/n. Resize the throat to bring pressure into range, or extend the propellant's pressure table.`;
    } else if (d.startsWith('Motor did not generate thrust')) {
      s.text = 'Pressure is too low to produce thrust. Raise Kn: smaller throat, more/longer grains, or a smaller core.';
    } else if (d.includes('Core diameter must be less')) {
      s.text = 'The core is as wide as the grain, so there is no propellant.';
      const i = Number((a.location || '').replace('Grain ', '')) - 1;
      if (G[i]) s.actions.push({ label: `Set core to ${round(G[i].diameter_mm / 3)} mm`, apply: m => { m.grains[i].coreDiameter_mm = round(m.grains[i].diameter_mm / 3); } });
    } else if (d.includes('Exit diameter must not be smaller')) {
      s.text = 'A converging-only nozzle is not modeled; exit must be at least the throat.';
      s.actions.push({ label: `Set exit to ${round(noz.throat_mm * 2)} mm`, apply: setExit(round(noz.throat_mm * 2)) });
    }
    out.push(s);
  }
  return out;
}
