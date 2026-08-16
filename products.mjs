/**
 * The two apps this repo builds. They are the same program pointed at different origins, so
 * everything that differs between them lives here and nothing is duplicated to add a third.
 */
export const PRODUCTS = {
  messenger: {
    name: 'Surf Messenger',
    appId: 'org.surfplatforms.messenger',
    /** The origin the window opens, and the one it treats as in-app. */
    origin: 'https://web.surfmessenger.com',
    /** Signing in leaves for SSO and comes back, so that origin is in-app too. */
    ssoOrigin: 'https://app.surfsocial.org',
    /** Behind the window before the first paint, and the wash on the disk image backdrop. */
    background: '#0c0c0c',
    tint: '#5c28b7',
    /** Square source ≥512, plate and glyph already locked up. */
    icon: 'build/messenger-icon.png',
    /** Names the download, so it is the app rather than a build artifact. */
    basename: 'Surf-Messenger',
  },
  surf: {
    name: 'Surf',
    appId: 'org.surfplatforms.surf',
    origin: 'https://app.surfsocial.org',
    /** Already the sign-in origin; there is nowhere else to come back from. */
    ssoOrigin: null,
    background: '#0c0c0c',
    tint: '#2563eb',
    icon: 'build/surf-icon.png',
    basename: 'Surf',
  },
};

export function product(key) {
  const found = PRODUCTS[key];
  if (!found) throw new Error(`unknown product "${key}" — one of ${Object.keys(PRODUCTS).join(', ')}`);
  return { key, ...found };
}
