const { app, BrowserWindow, shell, session } = require('electron');
const path = require('node:path');
const { readWindowState, persistWindowState } = require('./window-state');
/** Written by scripts/build.mjs from products.mjs, so one program serves every product. */
const PRODUCT = require('./product.json');

/** Calls need the camera and microphone; nothing else is granted. */
const GRANTED_PERMISSIONS = new Set(['media', 'notifications', 'clipboard-sanitized-write']);

const IN_APP_ORIGINS = [PRODUCT.origin, PRODUCT.ssoOrigin].filter(Boolean);
const isInApp = (url) => IN_APP_ORIGINS.some((origin) => url.startsWith(origin));

function createWindow() {
  const window = new BrowserWindow({
    ...readWindowState(),
    minWidth: 380,
    minHeight: 520,
    title: PRODUCT.name,
    backgroundColor: PRODUCT.background,
    // Inset traffic lights: the app draws its own chrome, so a title bar would be a second one.
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
  void window.loadURL(PRODUCT.origin);

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
