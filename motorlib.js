// Port of openMotor's motorlib (github.com/reilleya/openMotor, GPL-3.0): motor.py, grain.py,
// grains/bates.py, nozzle.py, propellant.py, simResult.py. Internals are SI, like the original.
// BATES is the only grain geometry. Inputs come in the web app's JSON schema (see toSI).

export const GAS_CONSTANT = 8314.462618; // J/(kmol*K)
export const G0 = 9.80665;
export const ATM = 101325;

const circleArea = d => (d / 2) ** 2 * Math.PI;

// --- schema (web JSON, units in key names) -> openMotor SI dicts -----------------------------

export function toSI(m) {
  return {
    grains: m.grains.map(g => ({
      type: 'BATES', diameter: g.diameter_mm / 1000, length: g.length_mm / 1000,
      coreDiameter: g.coreDiameter_mm / 1000, inhibitedEnds: g.inhibitedEnds,
    })),
    nozzle: {
      throat: m.nozzle.throat_mm / 1000, exit: m.nozzle.exit_mm / 1000, efficiency: m.nozzle.efficiency,
      divAngle: m.nozzle.divAngle_deg, convAngle: m.nozzle.convAngle_deg, throatLength: m.nozzle.throatLength_mm / 1000,
      slagCoeff: m.nozzle.slagCoeff_mm_MPa_per_s * 1e3, erosionCoeff: m.nozzle.erosionCoeff_mm_per_s_MPa * 1e-9,
    },
    propellant: {
      name: m.propellant.name, density: m.propellant.density_kg_m3,
      // a is entered as mm/(s*MPa^n) (Nakka's convention); openMotor wants m/(s*Pa^n)
      tabs: m.propellant.tabs.map(t => ({
        minPressure: t.minPressure_MPa * 1e6, maxPressure: t.maxPressure_MPa * 1e6,
        a: t.a_mm_per_s_MPa_n / 1000 / (1e6 ** t.n), n: t.n,
        k: m.propellant.k, t: m.propellant.combustionTemp_K, m: m.propellant.molarMass_g_mol,
      })),
    },
    config: {
      maxPressure: m.config.maxPressure_MPa * 1e6, maxMassFlux: m.config.maxMassFlux_kg_m2s,
      maxMachNumber: m.config.maxMachNumber, minPortThroat: m.config.minPortThroat,
      flowSeparationWarnPercent: m.config.flowSeparationWarnPercent, burnoutWebThres: m.config.burnoutWebThres_mm / 1000,
      burnoutThrustThres: m.config.burnoutThrustThres_pct, timestep: m.config.timestep_s,
      ambPressure: m.config.ambPressure_kPa * 1e3, sepPressureRatio: m.config.sepPressureRatio,
    },
  };
}

// --- grain.py PerforatedGrain + grains/bates.py -------------------------------------------------

class Bates {
  constructor(p) { Object.assign(this, p); this.wallWeb = (p.diameter - p.coreDiameter) / 2; }
  getEndPositions(r) {
    switch (this.inhibitedEnds) {
      case 'Neither': return [r, this.length - r];
      case 'Top': return [0, this.length - r];
      case 'Bottom': return [r, this.length];
      case 'Both': return [0, this.length];
    }
    throw new Error('Invalid number of faces inhibited');
  }
  getRegressedLength(r) { const e = this.getEndPositions(r); return e[1] - e[0]; }
  getCorePerimeter(r) { return Math.PI * (this.coreDiameter + 2 * r); }
  getFaceArea(r) { return circleArea(this.diameter) - circleArea(this.coreDiameter + 2 * r); }
  getCoreSurfaceArea(r) { return this.getCorePerimeter(r) * this.getRegressedLength(r); }
  getWebLeft(r) {
    const wallLeft = this.wallWeb - r;
    if (this.inhibitedEnds === 'Both') return wallLeft;
    return Math.min(this.getRegressedLength(r), wallLeft);
  }
  isWebLeft(r, thres) { return this.getWebLeft(r) > thres; }
  getSurfaceAreaAtRegression(r) {
    const faces = { Neither: 2, Top: 1, Bottom: 1, Both: 0 }[this.inhibitedEnds];
    return this.getCoreSurfaceArea(r) + faces * this.getFaceArea(r);
  }
  getVolumeAtRegression(r) { return this.getFaceArea(r) * this.getRegressedLength(r); }
  getVolumeSlice(r, dr) { return this.getVolumeAtRegression(r) - this.getVolumeAtRegression(r + dr); }
  getPortArea(r) { return circleArea(this.diameter) - this.getFaceArea(r); }
  getGrainBoundingVolume() { return this.length * circleArea(this.diameter); }
  getFreeVolume(r) { return this.getGrainBoundingVolume() - this.getVolumeAtRegression(r); }
  getMassFlux(massIn, dTime, regDist, dRegDist, position, density) {
    const endPos = this.getEndPositions(regDist);
    if (position < endPos[0]) return massIn / circleArea(this.diameter);
    if (position <= endPos[1]) {
      let top, countedCoreLength;
      if (this.inhibitedEnds === 'Top' || this.inhibitedEnds === 'Both') {
        top = 0; countedCoreLength = position;
      } else {
        top = this.getFaceArea(regDist + dRegDist) * dRegDist * density;
        countedCoreLength = position - (endPos[0] + dRegDist);
      }
      const core = (this.getPortArea(regDist + dRegDist) * countedCoreLength - this.getPortArea(regDist) * countedCoreLength) * density;
      return (massIn + (top + core) / dTime) / this.getPortArea(regDist + dRegDist);
    }
    return (massIn + this.getVolumeSlice(regDist, dRegDist) * density / dTime) / circleArea(this.diameter);
  }
  getPeakMassFlux(massIn, dTime, regDist, dRegDist, density) {
    return this.getMassFlux(massIn, dTime, regDist, dRegDist, this.getEndPositions(regDist)[1], density);
  }
  getGeometryErrors() {
    const e = [];
    if (this.diameter === 0) e.push(alert('Error', 'Geometry', 'Diameter must not be 0'));
    if (this.length === 0) e.push(alert('Error', 'Geometry', 'Length must not be 0'));
    if (this.coreDiameter === 0) e.push(alert('Error', 'Geometry', 'Core diameter must not be 0'));
    if (this.coreDiameter >= this.diameter) e.push(alert('Error', 'Geometry', 'Core diameter must be less than grain diameter'));
    return e;
  }
}

// --- nozzle.py ---------------------------------------------------------------------------------

export function eRatioFromPRatio(k, pRatio) {
  return ((k + 1) / 2) ** (1 / (k - 1)) * pRatio ** (1 / k) * (((k + 1) / (k - 1)) * (1 - pRatio ** ((k - 1) / k))) ** 0.5;
}

class Nozzle {
  constructor(p) { Object.assign(this, p); }
  calcExpansion() { return (this.exit / this.throat) ** 2; }
  getThroatArea(dThroat = 0) { return circleArea(this.throat + dThroat); }
  getExitArea() { return circleArea(this.exit); }
  // openMotor uses fsolve from x0=0, which lands on the supersonic root. eRatio rises monotonically
  // from 0 to 1 on (0, critical pressure ratio], so bisection finds the same root robustly.
  getExitPressure(k, inputPressure) {
    const target = 1 / this.calcExpansion();
    if (!(target < 1)) return inputPressure * (2 / (k + 1)) ** (k / (k - 1));
    let lo = 0, hi = (2 / (k + 1)) ** (k / (k - 1));
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      if (eRatioFromPRatio(k, mid) < target) lo = mid; else hi = mid;
    }
    return inputPressure * (lo + hi) / 2;
  }
  getDivergenceLosses() { return (1 + Math.cos(this.divAngle * Math.PI / 180)) / 2; }
  getThroatLosses(dThroat = 0) {
    const aspect = this.throatLength / (this.throat + dThroat);
    return aspect > 0.45 ? 0.95 : 0.99 - 0.0333 * aspect;
  }
  getSkinLosses() { return 0.99; }
  getIdealThrustCoeff(chamberPres, ambPres, gamma, dThroat, exitPres) {
    if (chamberPres === 0) return 0;
    if (exitPres == null) exitPres = this.getExitPressure(gamma, chamberPres);
    const term1 = (2 * gamma ** 2) / (gamma - 1);
    const term2 = (2 / (gamma + 1)) ** ((gamma + 1) / (gamma - 1));
    const term3 = 1 - (exitPres / chamberPres) ** ((gamma - 1) / gamma);
    return (term1 * term2 * term3) ** 0.5 + ((exitPres - ambPres) * this.getExitArea()) / (this.getThroatArea(dThroat) * chamberPres);
  }
  getAdjustedThrustCoeff(chamberPres, ambPres, gamma, dThroat, exitPres) {
    const ideal = this.getIdealThrustCoeff(chamberPres, ambPres, gamma, dThroat, exitPres);
    const skin = this.getSkinLosses();
    return this.getDivergenceLosses() * this.getThroatLosses(dThroat) * this.efficiency * (skin * ideal + (1 - skin));
  }
  getGeometryErrors() {
    const e = [];
    if (this.throat === 0) e.push(alert('Error', 'Geometry', 'Throat diameter must not be 0', 'Nozzle'));
    if (this.exit < this.throat) e.push(alert('Error', 'Geometry', 'Exit diameter must not be smaller than throat diameter', 'Nozzle'));
    if (this.efficiency === 0) e.push(alert('Error', 'Constraint', 'Efficiency must not be 0', 'Nozzle'));
    return e;
  }
}

// --- propellant.py -----------------------------------------------------------------------------

class Propellant {
  constructor(p) { Object.assign(this, p); }
  minValid() { return Math.min(...this.tabs.map(t => t.minPressure)); }
  maxValid() { return Math.max(...this.tabs.map(t => t.maxPressure)); }
  getCombustionProperties(pressure) {
    let closest = null, closestPressure = 1e100;
    for (const t of this.tabs) {
      if (t.minPressure < pressure && pressure < t.maxPressure) return [t.a, t.n, t.k, t.t, t.m];
      if (Math.abs(pressure - t.minPressure) < closestPressure) { closest = t; closestPressure = Math.abs(pressure - t.minPressure); }
      if (Math.abs(pressure - t.maxPressure) < closestPressure) { closest = t; closestPressure = Math.abs(pressure - t.maxPressure); }
    }
    return [closest.a, closest.n, closest.k, closest.t, closest.m];
  }
  getBurnRate(pressure) { const [a, n] = this.getCombustionProperties(pressure); return a * pressure ** n; }
  getCStar(pressure) {
    const [, , g, T, M] = this.getCombustionProperties(pressure);
    return (g * GAS_CONSTANT / M * T) ** 0.5 / (g * ((2 / (g + 1)) ** ((g + 1) / (g - 1))) ** 0.5);
  }
  getPressureFromKn(kn) {
    const tabPressures = [];
    const minV = this.minValid(), maxV = this.maxValid();
    for (const t of this.tabs) {
      const num = kn * this.density * t.a;
      const exponent = 1 / (1 - t.n);
      const denom = ((t.k / ((GAS_CONSTANT / t.m) * t.t)) * (2 / (t.k + 1)) ** ((t.k + 1) / (t.k - 1))) ** 0.5;
      const p = (num / denom) ** exponent;
      if (t.minPressure === minV && p < t.maxPressure) return p;
      if (t.maxPressure === maxV && t.minPressure < p) return p;
      if (t.minPressure < p && p < t.maxPressure) return p;
      tabPressures.push([Math.min(Math.abs(t.minPressure - p), Math.abs(p - t.maxPressure)), p]);
    }
    tabPressures.sort((x, y) => x[0] - y[0]);
    return tabPressures[0][1];
  }
  getErrors() {
    const e = [];
    this.tabs.forEach((t, i) => {
      if (t.maxPressure === t.minPressure) e.push(alert('Error', 'Value', `Tab #${i + 1} has the same minimum and maximum pressures.`, 'Propellant'));
      if (t.maxPressure < t.minPressure) e.push(alert('Error', 'Value', `Tab #${i + 1} has reversed pressure limits.`, 'Propellant'));
      this.tabs.forEach((o, j) => {
        if (i !== j && o.minPressure < t.maxPressure && t.maxPressure < o.maxPressure)
          e.push(alert('Error', 'Value', `Tabs #${i + 1} and #${j + 1} have overlapping ranges.`, 'Propellant'));
      });
    });
    return e;
  }
  getPressureErrors(pressure) {
    for (const t of this.tabs) if (t.minPressure < pressure && pressure < t.maxPressure) return [];
    return [alert('Warning', 'Value', "Chamber pressure deviated from propellant's entered ranges. Results may not be accurate.", 'Propellant')];
  }
}

// --- simResult.py ------------------------------------------------------------------------------

function alert(level, type, description, location = null) { return { level, type, description, location }; }

const sum = a => a.reduce((x, y) => x + y, 0);
const maxOf = a => a.reduce((x, y) => (y > x ? y : x), -Infinity);

export class SimulationResult {
  constructor(motor) {
    this.motor = motor;
    this.alerts = [];
    this.success = false;
    this.channels = {};
    for (const k of ['time', 'kn', 'pressure', 'force', 'mass', 'volumeLoading', 'massFlow', 'massFlux', 'regression', 'web', 'exitPressure', 'dThroat', 'machNumber']) this.channels[k] = [];
  }
  last(ch) { const d = this.channels[ch]; return d[d.length - 1]; }
  chMax(ch) { const d = this.channels[ch]; return Array.isArray(d[0]) ? maxOf(d.map(maxOf)) : maxOf(d); }
  chAvg(ch) { const d = this.channels[ch]; return sum(d) / d.length; }
  getBurnTime() { return this.last('time'); }
  getInitialKN() { return this.channels.kn[0]; }
  getPeakKN() { return this.chMax('kn'); }
  getAveragePressure() { return this.chAvg('pressure'); }
  getMaxPressure() { return this.chMax('pressure'); }
  getPercentBelowThreshold(ch, thres) { const d = this.channels[ch]; return d.filter(p => p < thres).length / d.length; }
  getImpulse(stop) {
    let impulse = 0, lastTime = 0;
    const t = this.channels.time, f = this.channels.force, n = stop == null ? t.length : stop;
    for (let i = 0; i < n; i++) { impulse += f[i] * (t[i] - lastTime); lastTime = t[i]; }
    return impulse;
  }
  getAverageForce() { return this.chAvg('force'); }
  getDesignation() {
    const imp = this.getImpulse();
    if (imp < 1.25) return 'N/A';
    let letters = '';
    let order = Math.trunc(Math.log2(imp / 1.25)) + 1;
    const places = Math.trunc(Math.log(order) / Math.log(26)) + 1;
    for (let p = 0; p < places; p++) {
      const rem = order % 26;
      letters = String.fromCharCode(rem + 64) + letters;
      order = Math.trunc((order - rem) / 26);
    }
    return letters + this.getAverageForce().toFixed(0);
  }
  getImpulseClassPercentage() {
    const imp = this.getImpulse();
    if (imp < 1.25) return 0;
    const minClass = 1.25 * 2 ** Math.trunc(Math.log2(imp / 1.25));
    return (imp - minClass) / minClass;
  }
  getPeakMassFlux() { return this.chMax('massFlux'); }
  getPeakMassFluxLocation() {
    const v = this.getPeakMassFlux();
    for (const frame of this.channels.massFlux) { const i = frame.indexOf(v); if (i >= 0) return i; }
    return null;
  }
  getPeakMachNumber() { return this.chMax('machNumber'); }
  getPropellantMass(i = 0) { return sum(this.channels.mass[i]); }
  getISP() { const m = this.getPropellantMass(); return m === 0 ? 0 : this.getImpulse() / (m * G0); }
  getPortRatio() { return this.motor.grains[this.motor.grains.length - 1].getPortArea(0) / circleArea(this.motor.nozzle.throat); }
  getVolumeLoading(i = 0) { return this.channels.volumeLoading[i]; }
  getPropellantLength() { return sum(this.motor.grains.map(g => g.length)); }
  getMaxPropellantDiameter() { return Math.max(...this.motor.grains.map(g => g.diameter)); }
  getIdealThrustCoefficient() {
    const p = this.getAveragePressure(), [, , g] = this.motor.propellant.getCombustionProperties(p);
    return this.motor.nozzle.getIdealThrustCoeff(p, this.motor.config.ambPressure, g, 0);
  }
  getAdjustedThrustCoefficient() {
    const p = this.getAveragePressure(), [, , g] = this.motor.propellant.getCombustionProperties(p);
    return this.motor.nozzle.getAdjustedThrustCoeff(p, this.motor.config.ambPressure, g, 0);
  }
  shouldContinueSim(thrustThres) {
    if (this.channels.time.length === 1) return true;
    return this.last('force') > thrustThres * 0.01 * this.chMax('force');
  }
}

// --- motor.py ----------------------------------------------------------------------------------

export class Motor {
  constructor(si) {
    this.grains = si.grains.map(g => new Bates(g));
    this.nozzle = new Nozzle(si.nozzle);
    this.propellant = new Propellant(si.propellant);
    this.config = si.config;
  }
  calcKN(regDepth, dThroat) {
    const thres = this.config.burnoutWebThres;
    const area = sum(this.grains.map((g, i) => g.getSurfaceAreaAtRegression(regDepth[i]) * (g.isWebLeft(regDepth[i], thres) ? 1 : 0)));
    return area / this.nozzle.getThroatArea(dThroat);
  }
  calcFreeVolume(reg) { return sum(this.grains.map((g, i) => g.getFreeVolume(reg[i]))); }
  calcTotalVolume() { return sum(this.grains.map(g => g.getGrainBoundingVolume())); }
  calcForce(chamberPres, dThroat, exitPres) {
    const [, , gamma] = this.propellant.getCombustionProperties(chamberPres);
    const cf = this.nozzle.getAdjustedThrustCoeff(chamberPres, this.config.ambPressure, gamma, dThroat, exitPres);
    return Math.max(cf * this.nozzle.getThroatArea(dThroat) * chamberPres, 0);
  }
  calcMachNumber(chamberPres, massFlux) {
    const [, , gamma, T, molarMass] = this.propellant.getCombustionProperties(chamberPres);
    if (chamberPres <= ATM) return 0;
    const A = chamberPres * (gamma * molarMass / (GAS_CONSTANT * T)) ** 0.5;
    const C = -(gamma + 1) / (2 * (gamma - 1));
    const f = M => A * M * (1 + ((gamma - 1) / 2) * M * M) ** C - massFlux;
    const df = M => { const B = 1 + ((gamma - 1) / 2) * M * M; return A * (B ** C + M * C * B ** (C - 1) * (gamma - 1) * M); };
    const maxMassFlux = f(1) + massFlux;
    if (massFlux >= maxMassFlux) return 1;
    let M = Math.asin(massFlux / maxMassFlux) * 2 / Math.PI;
    for (let i = 0; i < 50; i++) { // scipy.optimize.newton, same tolerance
      const step = f(M) / df(M);
      M -= step;
      if (Math.abs(step) < 1.48e-8) break;
    }
    return Math.max(M, 0);
  }

  runSimulation() {
    const { burnoutWebThres, burnoutThrustThres, timestep: dTime } = this.config;
    const res = new SimulationResult(this);
    const G = this.grains;

    if (G.length === 0) res.alerts.push(alert('Error', 'Constraint', 'Motor must have at least one propellant grain', 'Motor'));
    G.forEach((g, i) => g.getGeometryErrors().forEach(a => res.alerts.push({ ...a, location: `Grain ${i + 1}` })));
    res.alerts.push(...this.nozzle.getGeometryErrors(), ...this.propellant.getErrors());
    if (res.alerts.some(a => a.level === 'Error')) return res;

    const density = this.propellant.density;
    const motorVolume = this.calcTotalVolume();
    const reg = G.map(() => 0);
    const ch = res.channels;
    const zeros = () => G.map(() => 0);

    ch.time.push(0);
    ch.kn.push(this.calcKN(reg, 0));
    ch.pressure.push(this.propellant.getPressureFromKn(ch.kn[0]));
    ch.force.push(0);
    ch.mass.push(G.map(g => g.getVolumeAtRegression(0) * density));
    ch.volumeLoading.push(100 * (1 - this.calcFreeVolume(reg) / motorVolume));
    ch.massFlow.push(zeros()); ch.massFlux.push(zeros()); ch.regression.push(zeros());
    ch.web.push(G.map(g => g.getWebLeft(0)));
    ch.exitPressure.push(0); ch.dThroat.push(0); ch.machNumber.push(zeros());

    const ratio = res.getPortRatio();
    if (ratio < this.config.minPortThroat)
      res.alerts.push(alert('Warning', 'Constraint', `Initial port/throat ratio of ${ratio.toFixed(3)} was less than ${this.config.minPortThroat.toFixed(3)}`, 'N/A'));

    // Guard against runaway loops from pathological inputs (e.g. zero burn rate); openMotor has none.
    for (let step = 0; step < 200000 && res.shouldContinueSim(burnoutThrustThres); step++) {
      let massFlow = 0;
      const pMass = zeros(), pFlow = zeros(), pFlux = zeros(), pWeb = zeros();
      const lastMass = res.last('mass'), lastP = res.last('pressure');
      G.forEach((g, i) => {
        if (g.getWebLeft(reg[i]) > burnoutWebThres) {
          const r = dTime * this.propellant.getBurnRate(lastP);
          pFlux[i] = g.getPeakMassFlux(massFlow, dTime, reg[i], r, density);
          pMass[i] = g.getVolumeAtRegression(reg[i]) * density;
          massFlow += (lastMass[i] - pMass[i]) / dTime;
          reg[i] += r;
          pWeb[i] = g.getWebLeft(reg[i]);
        }
        pFlow[i] = massFlow;
      });
      ch.regression.push(reg.slice()); ch.web.push(pWeb);
      ch.volumeLoading.push(100 * (1 - this.calcFreeVolume(reg) / motorVolume));
      ch.mass.push(pMass); ch.massFlow.push(pFlow); ch.massFlux.push(pFlux);

      const dThroat = res.last('dThroat');
      const kn = this.calcKN(reg, dThroat);
      ch.kn.push(kn);
      const pressure = this.propellant.getPressureFromKn(kn);
      ch.pressure.push(pressure);
      ch.machNumber.push(pFlux.map(f => this.calcMachNumber(pressure, f)));
      const [, , gamma] = this.propellant.getCombustionProperties(pressure);
      const exitPressure = this.nozzle.getExitPressure(gamma, pressure);
      ch.exitPressure.push(exitPressure);
      ch.force.push(this.calcForce(pressure, dThroat, exitPressure));
      ch.time.push(res.last('time') + dTime);

      const slagRate = pressure === 0 ? 0 : (1 / pressure) * this.nozzle.slagCoeff;
      const erosionRate = pressure * this.nozzle.erosionCoeff;
      ch.dThroat.push(dThroat + dTime * (-2 * slagRate + 2 * erosionRate));
    }

    res.success = true;
    const c = this.config;
    if (res.getPeakMassFlux() > c.maxMassFlux) res.alerts.push(alert('Warning', 'Constraint', 'Peak mass flux exceeded configured limit', 'Motor'));
    if (res.getMaxPressure() > c.maxPressure) res.alerts.push(alert('Warning', 'Constraint', 'Max pressure exceeded configured limit', 'Motor'));
    if (res.getPeakMachNumber() >= 1) res.alerts.push(alert('Warning', 'Constraint', 'Max core Mach number exceeded allowable subsonic limit (M>1.0)', 'Motor'));
    else if (res.getPeakMachNumber() > c.maxMachNumber) res.alerts.push(alert('Warning', 'Constraint', 'Max core Mach number exceeded configured limit', 'Motor'));
    if (res.getPercentBelowThreshold('exitPressure', c.ambPressure * c.sepPressureRatio) > c.flowSeparationWarnPercent)
      res.alerts.push(alert('Warning', 'Value', 'Low exit pressure, nozzle flow may separate', 'Nozzle'));
    if (res.getAverageForce() < burnoutThrustThres)
      res.alerts.push(alert('Error', 'Value', 'Motor did not generate thrust. Check Kn, chamber pressure and expansion ratio.', 'Motor'));
    for (const p of ch.pressure) {
      if (p > 0) { const e = this.propellant.getPressureErrors(p); if (e.length) { res.alerts.push(e[0]); break; } }
    }
    return res;
  }
}

export const simulate = model => new Motor(toSI(model)).runSimulation();
