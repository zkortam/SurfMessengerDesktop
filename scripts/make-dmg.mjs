/**
 * Packages a built .app into the disk image someone actually opens: a window showing the app, the
 * Applications folder, and the arrow between them.
 *
 * electron-builder's own dmg target shells out to a vendored dmgbuild needing Python 2's biplist,
 * and appdmg needs a native module needing distutils; no current macOS supplies either. Finder
 * writes the window layout instead, which is what both of those were asking it to do anyway.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, mkdirSync, existsSync, symlinkSync, statSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { WINDOW, SLOTS, makeBackground } from './make-background.mjs';

/** Finder's own chrome sits above the content, so the window is taller than the backdrop. */
const TITLE_BAR = 28;
const ICON_SIZE = 128;

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

export async function makeDmg(product, { dist, buildDir }) {
  const built = join(dist, 'mac-universal');
  if (!existsSync(built)) throw new Error(`no build at ${built}`);
  const app = readdirSync(built).find((entry) => entry.endsWith('.app'));
  if (!app) throw new Error(`no .app inside ${built}`);

  const background = await makeBackground(product, buildDir);

  // The staging folder IS the window: whatever is in it is what the volume shows.
  const staging = join(dist, 'staging');
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(join(staging, '.background'), { recursive: true });
  run('cp', ['-R', join(built, app), join(staging, app)]);
  symlinkSync('/Applications', join(staging, 'Applications'));
  cpSync(background, join(staging, '.background', 'background.tiff'));

  const volume = product.name;
  const readWrite = join(dist, 'rw.dmg');
  const out = join(dist, `${product.basename}.dmg`);
  rmSync(readWrite, { force: true });
  rmSync(out, { force: true });

  // Writable first: Finder cannot arrange icons on a read-only volume. Not -nobrowse either,
  // which hides the volume from Finder, which then cannot address it to lay it out.
  run('hdiutil', ['create', '-srcfolder', staging, '-volname', volume, '-format', 'UDRW', '-quiet', readWrite]);
  run('hdiutil', ['attach', readWrite, '-quiet']);
  run('osascript', ['-e', `tell application "Finder" to repeat until disk "${volume}" exists
  delay 0.2
end repeat`]);

  const layout = `
tell application "Finder"
  tell disk "${volume}"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {200, 140, ${200 + WINDOW.width}, ${140 + WINDOW.height + TITLE_BAR}}
    set theViewOptions to the icon view options of container window
    set arrangement of theViewOptions to not arranged
    set icon size of theViewOptions to ${ICON_SIZE}
    set background picture of theViewOptions to file ".background:background.tiff"
    set position of item "${app}" of container window to {${SLOTS.app.x}, ${SLOTS.app.y}}
    set position of item "Applications" of container window to {${SLOTS.applications.x}, ${SLOTS.applications.y}}
    update without registering applications
    close
  end tell
end tell`;

  try {
    run('osascript', ['-e', layout]);
  } catch (error) {
    run('hdiutil', ['detach', `/Volumes/${volume}`, '-quiet', '-force']);
    throw new Error(
      'Finder refused the window layout. macOS asks once for permission to control Finder — '
      + `approve it and run this again.\n${error.stderr?.toString() ?? error.message}`,
    );
  }

  // Finder writes .DS_Store lazily; detaching before it lands ships a window with no layout.
  run('sync', []);
  run('hdiutil', ['detach', `/Volumes/${volume}`, '-quiet']);
  run('hdiutil', ['convert', readWrite, '-format', 'UDZO', '-imagekey', 'zlib-level=9', '-quiet', '-o', out]);
  rmSync(readWrite, { force: true });
  rmSync(staging, { recursive: true, force: true });

  return { path: out, megabytes: (statSync(out).size / 1e6).toFixed(1) };
}
