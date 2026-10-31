// verify-build.js - checks the BUILT app (release/win-unpacked), not the dev code, before it goes to a client.
// Run automatically at the end of "npm run build:win", or on its own with "npm run verify:build".
//
//  1. Packages:  every package the app needs at runtime is inside app.asar
//  2. Real exe:  release/win-unpacked/Zerivo.exe starts on a TEMPORARY data folder (never the real one),
//                reaches "started", reports the right version, and logs no errors
//  3. Features:  the packaged code shows the home screen, saves a bill, records a credit payment,
//                and exports a real Excel file and PDF
//
// Exit code 0 = safe to ship, 1 = do NOT ship.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const asar = require('@electron/asar');

const root = path.resolve(__dirname, '..');
// VERIFY_UNPACKED lets you check another unpacked build folder (default: release/win-unpacked)
const unpacked = process.env.VERIFY_UNPACKED || path.join(root, 'release', 'win-unpacked');
const exePath = path.join(unpacked, 'Zerivo.exe');
const asarPath = path.join(unpacked, 'resources', 'app.asar');
const version = require(path.join(root, 'package.json')).version;
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'zerivo-verify-'));

let failed = false;
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => { console.log(`  FAIL  ${msg}`); failed = true; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Environment for launching Electron: VS Code terminals set ELECTRON_RUN_AS_NODE, which turns
// any Electron app into plain Node; dev mode must be off so the packaged paths are used.
function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_ENV;
  return env;
}

// ---------------------------------------------------------------- 1. packages
function checkPackages(extracted) {
  console.log('\n1. Packages inside the build');
  const seen = new Set();
  const resolveDir = (name, fromDir) => {
    for (let d = fromDir; ; d = path.dirname(d)) {
      const candidate = path.join(d, 'node_modules', name);
      if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
      if (path.dirname(d) === d) return null;
    }
  };
  const walk = (dir) => {
    const pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const deps = { ...(pj.dependencies || {}), ...(pj.optionalDependencies || {}) };
    for (const name of Object.keys(deps)) {
      const resolved = resolveDir(name, dir);
      if (!resolved) continue;
      const rel = path.relative(path.join(root, 'node_modules'), resolved);
      if (seen.has(rel)) continue;
      seen.add(rel);
      walk(resolved);
    }
  };
  walk(root);
  const missing = [...seen].filter((rel) => !fs.existsSync(path.join(extracted, 'node_modules', rel, 'package.json')));
  if (missing.length === 0) pass(`all ${seen.size} runtime packages are in the build`);
  else fail(`${missing.length} runtime package(s) missing from the build: ${missing.join(', ')}`);

  if (fs.existsSync(path.join(extracted, 'electron', 'vendor', 'exceljs.js'))) pass('bundled Excel library (electron/vendor/exceljs.js) is in the build');
  else fail('electron/vendor/exceljs.js missing — run "npm run bundle:excel" before building');
}

// ---------------------------------------------------------------- 2. real exe
async function checkRealExe(extracted) {
  console.log('\n2. Real Zerivo.exe starts');
  // Safety lock: only launch if the packaged code honours ZERIVO_USER_DATA; otherwise it would use real data
  const mainSource = fs.readFileSync(path.join(extracted, 'electron', 'main.js'), 'utf8');
  if (!mainSource.includes('process.env.ZERIVO_USER_DATA')) {
    fail('packaged main.js does not support ZERIVO_USER_DATA — refusing to launch (it would use the real data folder)');
    return;
  }

  const userData = path.join(work, 'exe-data');
  fs.mkdirSync(userData, { recursive: true });
  if (process.env.VERIFY_DB) {
    fs.mkdirSync(path.join(userData, 'database'), { recursive: true });
    fs.copyFileSync(process.env.VERIFY_DB, path.join(userData, 'database', 'hotel.db'));
    console.log(`  (upgrade test from ${process.env.VERIFY_DB})`);
  }

  const child = spawn(exePath, [], { env: cleanEnv({ ZERIVO_USER_DATA: userData }), stdio: 'ignore', detached: false });
  const logsDir = path.join(userData, 'logs');
  const readLogs = () => (fs.existsSync(logsDir)
    ? fs.readdirSync(logsDir).map((f) => fs.readFileSync(path.join(logsDir, f), 'utf8')).join('\n')
    : '');

  let logs = '';
  let exited = false;
  child.on('exit', () => { exited = true; });
  for (let i = 0; i < 60 && !exited; i++) {
    await sleep(500);
    logs = readLogs();
    if (/Zerivo .* started/.test(logs)) break;
  }
  await sleep(3000); // let it run a few seconds after start-up
  logs = readLogs();
  const stillRunning = !exited;
  spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });

  if (!logs) { fail('no log written to the test folder (app did not start, or did not use the test folder)'); return; }
  if (logs.includes(path.join('AppData', 'Roaming'))) fail('app used the REAL data folder — investigate before shipping');
  else pass('used the temporary test data folder');
  const started = logs.match(/Zerivo (\S+) started/);
  if (started) pass(`started (version ${started[1]})`); else fail('never reached "started"');
  if (started && started[1] !== version) fail(`version ${started[1]} does not match package.json ${version}`);
  if (stillRunning) pass('still running after start-up (no crash)'); else fail('exited during start-up (crash)');
  // On an empty test folder (no VERIFY_DB) the app's normal first-start message is logged as ERROR
  const expectedOnFreshStart = /No valid backup available — initializing fresh DB/;
  const errors = logs.split('\n').filter((l) => /\[ERROR\]|CRITICAL/.test(l))
    .filter((l) => process.env.VERIFY_DB || !expectedOnFreshStart.test(l));
  if (errors.length === 0) pass('no errors in the log');
  else fail(`errors in the log:\n        ${errors.slice(0, 8).join('\n        ')}`);
}

// ---------------------------------------------------------------- 3. features (packaged code)
function checkFeatures() {
  console.log('\n3. Packaged features');
  const userData = path.join(work, 'feature-data');
  fs.mkdirSync(userData, { recursive: true });
  if (process.env.VERIFY_DB) {
    fs.mkdirSync(path.join(userData, 'database'), { recursive: true });
    fs.copyFileSync(process.env.VERIFY_DB, path.join(userData, 'database', 'hotel.db'));
  }
  const electronBin = require('electron'); // path to the dev Electron binary
  const result = spawnSync(electronBin, [path.join(__dirname, 'verify-build-app.js'), asarPath, userData], {
    env: cleanEnv(), encoding: 'utf8', timeout: 120000,
  });
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  const lines = out.split('\n').filter((l) => /^(PASS|FAIL) /.test(l));
  lines.forEach((l) => (l.startsWith('PASS') ? pass(l.slice(5)) : fail(l.slice(5))));
  if (lines.length === 0) fail(`feature check did not run:\n${out.slice(-1500)}`);
}

(async () => {
  console.log(`Verifying built app ${version} (${unpacked})`);
  if (!fs.existsSync(exePath) || !fs.existsSync(asarPath)) {
    console.log('  FAIL  no build found — run "npm run build:win" first');
    process.exit(1);
  }
  const extracted = path.join(work, 'asar');
  asar.extractAll(asarPath, extracted);

  checkPackages(extracted);
  await checkRealExe(extracted);
  checkFeatures();

  try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) { /* temp files, ignore */ }
  console.log(failed
    ? `\n✖ BUILD ${version} FAILED VERIFICATION — do NOT give this installer to the client.\n`
    : `\n✔ BUILD ${version} VERIFIED — release\\Zerivo Setup ${version}.exe is safe to install.\n`);
  process.exit(failed ? 1 : 0);
})();
