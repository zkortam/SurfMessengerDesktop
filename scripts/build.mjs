/**
 * Builds one product for one platform: `node scripts/build.mjs surf mac`.
 *
 * electron-builder reads a config, not arguments, so the config is generated from products.mjs
 * rather than kept as a second copy of it per app.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, statSync, renameSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { product } from '../products.mjs';
import { makeDmg } from './make-dmg.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const [key, platform = 'mac'] = process.argv.slice(2);
const app = product(key);
const dist = join(ROOT, 'dist', app.key);
const buildDir = join(ROOT, 'build', app.key);

mkdirSync(dist, { recursive: true });
mkdirSync(buildDir, { recursive: true });

// The packaged app reads this to know which product it is.
writeFileSync(join(ROOT, 'src', 'product.json'), JSON.stringify({
  name: app.name, origin: app.origin, ssoOrigin: app.ssoOrigin, background: app.background,
}, null, 2));

const config = {
  appId: app.appId,
  productName: app.name,
  directories: { output: dist },
  files: ['src/**/*'],
  // Unsigned until there is an Apple Developer ID to sign with; null skips it rather than
  // letting electron-builder pick some other certificate out of the keychain.
  mac: {
    category: 'public.app-category.social-networking',
    target: [{ target: 'dir', arch: ['universal'] }],
    icon: app.icon,
    darkModeSupport: true,
    identity: null,
  },
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: app.icon },
  nsis: { artifactName: `${app.basename}-Setup.\${ext}` },
};
const configPath = join(dist, 'electron-builder.json');
writeFileSync(configPath, JSON.stringify(config, null, 2));

const builder = join(ROOT, 'node_modules', '.bin', 'electron-builder');
const args = platform === 'win'
  ? ['--win', 'nsis', '--x64', '--config', configPath, '--publish', 'never']
  : ['--mac', '--config', configPath, '--publish', 'never'];
execFileSync(builder, args, { cwd: ROOT, stdio: 'inherit' });

if (platform === 'mac') {
  const { path, megabytes } = await makeDmg(app, { dist, buildDir });
  console.log(`\n${path.split('/').pop()}  ${megabytes} MB`);
} else {
  // electron-builder names the installer from artifactName; keep only that one.
  const exe = join(dist, `${app.basename}-Setup.exe`);
  if (!existsSync(exe)) throw new Error(`expected ${exe}`);
  console.log(`\n${exe.split('/').pop()}  ${(statSync(exe).size / 1e6).toFixed(1)} MB`);
}
