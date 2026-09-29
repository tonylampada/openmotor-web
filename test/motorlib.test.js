// Golden results produced by running the real openMotor motorlib on the same inputs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulate } from '../motorlib.js';
import { DEFAULT_MODEL, validate, normalize, suggestFixes } from '../model.js';

const golden = JSON.parse(readFileSync(new URL('./openmotor-golden.json', import.meta.url)));
const close = (a, b, what, rel = 1e-6) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${what}: ${a} vs openMotor ${b}`);

for (const [name, g] of Object.entries(golden)) {
  test(`matches openMotor: ${name}`, () => {
    const r = simulate(g.model);
    assert.equal(r.getDesignation(), g.designation);
    assert.deepEqual(r.alerts.map(a => a.description), g.alerts);
    for (const [k, fn] of Object.entries({
      impulse: 'getImpulse', isp: 'getISP', burnTime: 'getBurnTime', peakPressure: 'getMaxPressure', avgPressure: 'getAveragePressure',
      initialKn: 'getInitialKN', peakKn: 'getPeakKN', peakMassFlux: 'getPeakMassFlux', peakMach: 'getPeakMachNumber',
      propellantMass: 'getPropellantMass', volumeLoading: 'getVolumeLoading', idealCf: 'getIdealThrustCoefficient', deliveredCf: 'getAdjustedThrustCoefficient',
    })) close(r[fn](), g[k], k);
    assert.equal(r.channels.pressure.length, g.pressure.length);
    g.pressure.forEach((p, i) => close(r.channels.pressure[i], p, `pressure[${i}]`));
    g.force.forEach((f, i) => close(r.channels.force[i], f, `force[${i}]`));
    g.exitPressure.forEach((p, i) => close(r.channels.exitPressure[i], p, `exitPressure[${i}]`, 1e-5));
  });
}

test('defaults reproduce the captain run: I980, ~617 Ns, 0.60 s, ~1150 psi', () => {
  const r = simulate(DEFAULT_MODEL);
  assert.equal(r.getDesignation(), 'I980');
  close(r.getImpulse(), 617.22, 'impulse', 0.02);
  close(r.getBurnTime(), 0.6, 'burn', 0.02);
  close(r.getMaxPressure() / 6895, 1150, 'peak psi', 0.02);
});

test('export -> import round-trips to identical results', () => {
  const text = JSON.stringify(normalize(DEFAULT_MODEL), null, 2);
  const back = JSON.parse(text);
  assert.deepEqual(validate(back), []);
  assert.equal(JSON.stringify(normalize(back), null, 2), text);
  assert.deepEqual(simulate(back).channels, simulate(DEFAULT_MODEL).channels);
});

test('validate reports out-of-range values', () => {
  const m = structuredClone(DEFAULT_MODEL);
  m.nozzle.throat_mm = -3; m.grains[0].inhibitedEnds = 'Sideways';
  const errs = validate(m);
  assert.ok(errs.some(e => e.startsWith('nozzle.throat_mm')));
  assert.ok(errs.some(e => e.startsWith('grains[0].inhibitedEnds')));
});

test('every suggested action on the defaults clears the alert it targets (or says it does not)', () => {
  const r = simulate(DEFAULT_MODEL);
  const s = suggestFixes(DEFAULT_MODEL, r);
  assert.equal(s.length, 3);
  for (const x of s) assert.ok(x.actions.some(a => a.clears), `no clearing action for: ${x.alert.description}`);
});
