/**
 * Packages each built .app into a DMG.
 *
 * electron-builder's own dmg target shells out to a vendored dmgbuild that needs Python 2's
 * biplist, which no current macOS can supply. hdiutil is already on the machine and is what
 * dmgbuild would have called anyway.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, mkdirSync, existsSync, symlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const VOLUME = 'Surf Messenger';
/** Where electron-builder leaves each arch, and the suffix that names the download. */
const BUILDS = [
  { dir: 'mac-arm64', suffix: 'arm64' },
  { dir: 'mac', suffix: 'x64' },
];

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

for (const { dir, suffix } of BUILDS) {
  const built = join(DIST, dir);
  if (!existsSync(built)) continue;
  const app = readdirSync(built).find((entry) => entry.endsWith('.app'));
  if (!app) continue;

  // hdiutil takes a folder, and the folder is what the mounted window shows: the app beside
  // the Applications folder someone drags it into.
  const staging = join(DIST, `staging-${suffix}`);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  run('cp', ['-R', join(built, app), join(staging, app)]);
  symlinkSync('/Applications', join(staging, 'Applications'));

  const version = JSON.parse(
    run('cat', [new URL('../package.json', import.meta.url).pathname]).toString(),
  ).version;
  const out = join(DIST, `SurfMessenger-${version}-${suffix}.dmg`);
  rmSync(out, { force: true });
  // UDZO is compressed and read-only, which is what a download should be.
  run('hdiutil', ['create', '-srcfolder', staging, '-volname', VOLUME, '-format', 'UDZO', '-quiet', out]);
  rmSync(staging, { recursive: true, force: true });

  console.log(`${out.split('/').pop()}  ${(statSync(out).size / 1e6).toFixed(1)} MB`);
}
