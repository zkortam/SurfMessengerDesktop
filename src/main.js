const { app, BrowserWindow, shell, session } = require('electron');
const path = require('node:path');
const { readWindowState, persistWindowState } = require('./window-state');

/** The messenger runs at its own origin; the desktop app is a window onto it, not a fork. */
const APP_ORIGIN = 'https://web.surfmessenger.com';
/** Signing in leaves the messenger origin for SSO and comes back, so it is trusted in-window too. */
const SSO_ORIGIN = 'https://app.surfsocial.org';
const IN_APP_ORIGINS = [APP_ORIGIN, SSO_ORIGIN];

/** Calls need the camera and microphone; nothing else is granted. */
const GRANTED_PERMISSIONS = new Set(['media', 'notifications', 'clipboard-sanitized-write']);

const isInApp = (url) => IN_APP_ORIGINS.some((origin) => url.startsWith(origin));

function createWindow() {
  const state = readWindowState();

  const window = new BrowserWindow({
    ...state,
    minWidth: 380,
    minHeight: 520,
    title: 'Surf Messenger',
    backgroundColor: '#0c0c0c',
    // Inset traffic lights: the messenger draws its own chrome, so a title bar would be a second one.
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
sandbox: true,
    },
  });

  persistWindowState(window);
  void window.loadURL(APP_ORIGIN);

  // A link to anywhere else is the web, and the web belongs in a browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isInApp(url)) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isInApp(url)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  return window;
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(GRANTED_PERMISSIONS.has(permission));
  });

  createWindow();

  // macOS keeps the process alive with no windows; the dock icon has to be able to open one.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
