# openmotor-web

Live-slider web version of [openMotor](https://github.com/reilleya/openMotor), the open-source solid rocket motor
simulator by Andrew Reilley. Move any slider and the simulation re-runs; there is no Simulate button.

**Live:** https://tonylampada.github.io/openmotor-web/

- Physics is a faithful JavaScript port of openMotor's `motorlib` (motor, BATES grain, nozzle, propellant, results).
  `test/openmotor-golden.json` holds results from the real openMotor; `npm test` checks the port against them.
- BATES grains only. openMotor's FMM-based geometries are not ported.
- Each alert comes with fixes computed by re-running the sim (e.g. the core diameter that clears port/throat), and a
  one-click "Try".
- Copy JSON / Import round-trips the full input set. "Copy LLM context" copies a self-contained prompt (schema, units,
  ranges, alert levers, current motor and results) for any LLM; paste its JSON answer back with Import.

Static site, no build step: serve the repo root (`python3 -m http.server`) and open `index.html`.

## License

GPL-3.0, same as openMotor, from which the simulation code is derived. See [LICENSE](LICENSE).
