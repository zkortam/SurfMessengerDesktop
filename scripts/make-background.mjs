/**
 * Draws the backdrop of the mounted disk image: the ground the app icon and the Applications
 * folder sit on, and the arrow between them that says what to do with them.
 */
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

/** Matches WINDOW in make-dmg.mjs — the drawing and the window it fills are one layout. */
export const WINDOW = { width: 640, height: 400 };
/** Icon centres. The arrow runs between them, so both live here rather than in two files. */
export const SLOTS = { app: { x: 168, y: 188 }, applications: { x: 472, y: 188 } };

/** Light, because the drop target is not ours to draw: macOS renders the Applications folder and
 *  both icon labels for a light ground, and on a dark one the folder someone is aiming at
 *  disappears into it. The brand shows in the app icon, which is the thing being dragged. */
const PLATE = '#f4f3f8';
const ARROW = '#1c1b22';

/** Clear of both icons, which are 128px wide and labelled underneath. */
const ARROW_START = SLOTS.app.x + 92;
const ARROW_END = SLOTS.applications.x - 92;
const ARROW_Y = SLOTS.app.y;
const HEAD = 13;

const backdrop = (tint, { width, height }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${WINDOW.width} ${WINDOW.height}">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0" stop-color="${tint}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${PLATE}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WINDOW.width}" height="${WINDOW.height}" fill="${PLATE}"/>
  <rect width="${WINDOW.width}" height="${WINDOW.height}" fill="url(#glow)"/>
  <g stroke="${ARROW}" stroke-opacity="0.42" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${ARROW_START} ${ARROW_Y} H${ARROW_END}"/>
    <path d="M${ARROW_END - HEAD} ${ARROW_Y - HEAD} L${ARROW_END} ${ARROW_Y} L${ARROW_END - HEAD} ${ARROW_Y + HEAD}"/>
  </g>
</svg>`;

/** Writes background.tiff next to the build, carrying both renderings: one TIFF is how Finder is
 *  told a backdrop has a retina version. */
export async function makeBackground(product, dir) {
  mkdirSync(dir, { recursive: true });
  const png = (scale, out) => sharp(Buffer.from(backdrop(product.tint, {
    width: WINDOW.width * scale,
    height: WINDOW.height * scale,
  }))).png({ compressionLevel: 9 }).toFile(out);

  await png(1, `${dir}/background.png`);
  await png(2, `${dir}/background@2x.png`);
  execFileSync('tiffutil', [
    '-cathidpicheck', `${dir}/background.png`, `${dir}/background@2x.png`,
    '-out', `${dir}/background.tiff`,
  ]);
  return `${dir}/background.tiff`;
}
