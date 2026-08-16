const { app, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

/** Reopening at the default size every launch is the thing that makes a wrapper feel like a wrapper. */
const STATE_FILE = () => path.join(app.getPath('userData'), 'window-state.json');
const DEFAULT_STATE = { width: 1100, height: 760 };
/** Debounce: resize and move fire continuously while the mouse is down. */
const WRITE_DELAY_MS = 400;

/** Ignores a saved position that no longer lands on a connected display. */
function isOnScreen({ x, y }) {
  if (x === undefined || y === undefined) return false;
  return screen.getAllDisplays().some(({ workArea }) =>
    x >= workArea.x && y >= workArea.y
    && x < workArea.x + workArea.width && y < workArea.y + workArea.height);
}

function readWindowState() {
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8'));
    const { width, height, x, y } = saved;
    if (!width || !height) return DEFAULT_STATE;
    return isOnScreen(saved) ? { width, height, x, y } : { width, height };
  } catch {
    return DEFAULT_STATE;
  }
}

function persistWindowState(window) {
  let timer = null;
  const write = () => {
    if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return;
    const { width, height, x, y } = window.getNormalBounds();
    try {
      fs.writeFileSync(STATE_FILE(), JSON.stringify({ width, height, x, y }));
    } catch { /* a window that cannot remember its size is not worth a crash */ }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, WRITE_DELAY_MS);
  };

  window.on('resize', schedule);
  window.on('move', schedule);
  window.on('close', write);
}

module.exports = { readWindowState, persistWindowState };
