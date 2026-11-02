// zoom.js - App-controlled screen zoom (Ctrl + / Ctrl - / Ctrl 0, Ctrl + mouse wheel, Admin buttons)
// Electron's built-in zoom shortcuts are unreliable on Windows (zoom-in often does nothing), and Chromium
// saves zoom per install folder, so a reinstall elsewhere "lost" the shop's zoom. Here the app handles the
// keys itself and saves the zoom in its own settings (app_settings.zoomFactor).

const db = require('./database');
const logger = require('./logger');

const SETTING_KEY = 'zoomFactor';
// Allowed sizes; never smaller than 50% or larger than 200%, so the app can't be made unusable
const STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

function nearestStepIndex(factor) {
  let best = 0;
  STEPS.forEach((s, i) => { if (Math.abs(s - factor) < Math.abs(STEPS[best] - factor)) best = i; });
  return best;
}

function getSaved() {
  const value = parseFloat(db.getSetting(SETTING_KEY));
  return Number.isFinite(value) ? STEPS[nearestStepIndex(value)] : null;
}

function apply(win, factor) {
  const clamped = STEPS[nearestStepIndex(factor)];
  if (!win || win.isDestroyed()) return clamped;
  win.webContents.setZoomFactor(clamped);
  db.setSetting(SETTING_KEY, String(clamped));
  win.webContents.send('zoom-changed', clamped);
  return clamped;
}

function step(win, direction) {
  const current = win.webContents.getZoomFactor();
  const i = nearestStepIndex(current);
  const next = direction > 0 ? Math.min(i + 1, STEPS.length - 1) : Math.max(i - 1, 0);
  return apply(win, STEPS[next]);
}

/**
 * Attach zoom handling to the main window
 */
function attach(win) {
  // Restore the saved zoom on every page load. First start of this version: keep the zoom the PC
  // already had (Chromium's own saved value), then save it in the app settings from now on.
  win.webContents.on('did-finish-load', () => {
    const saved = getSaved();
    const factor = saved !== null ? saved : win.webContents.getZoomFactor();
    const applied = apply(win, factor);
    logger.log(`🔍 Screen zoom ${Math.round(applied * 100)}%${saved === null ? ' (kept from before)' : ''}`, 'INFO');
  });

  // Keyboard: handled here, before the page and before Electron's menu shortcuts
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return;
    const { key, code } = input;
    if (key === '=' || key === '+' || code === 'Equal' || code === 'NumpadAdd') {
      event.preventDefault();
      step(win, +1);
    } else if (key === '-' || key === '_' || code === 'Minus' || code === 'NumpadSubtract') {
      event.preventDefault();
      step(win, -1);
    } else if (key === '0' || code === 'Digit0' || code === 'Numpad0') {
      event.preventDefault();
      apply(win, 1);
    }
  });

  // Ctrl + mouse wheel
  win.webContents.on('zoom-changed', (event, direction) => {
    step(win, direction === 'in' ? +1 : -1);
  });
}

/**
 * IPC for the Admin "Screen Size" card
 */
function registerIpc(ipcMain, getWindow) {
  ipcMain.handle('zoom:get', () => {
    const win = getWindow();
    return win ? win.webContents.getZoomFactor() : 1;
  });
  ipcMain.handle('zoom:step', (event, direction) => step(getWindow(), direction > 0 ? 1 : -1));
  ipcMain.handle('zoom:reset', () => apply(getWindow(), 1));
}

module.exports = { attach, registerIpc, STEPS };
