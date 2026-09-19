// One-time migration for the browser-owned allowed-color setting.
//
// Live 12.4.3 reports 70, and a set list that uses eight of them deliberately
// reads better than one that uses all seventy: several of Live's colors are hard
// to tell apart at the size a scene row draws them, and a band you can't
// distinguish from the band above it isn't doing the job the color exists for.
//
// **`null` means "all of them", and that isn't the same as a list of every
// index.** A stored list is a choice, and a choice made against a 70-color
// palette shouldn't silently exclude colors 70+ if a later Live ships more. Not
// having chosen stays not having chosen.
//
// New writes go to the bridge device's Stored Only parameter and travel inside
// the .als. This key is read only when an older device state has no
// `allowedColors` field, then removed after the bridge confirms the migration.

const KEY = 'bsv.allowedColors';

/** The old chosen slots, or `undefined` when this origin never stored a list. */
export function loadLegacyAllowedColors(): number[] | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    // An empty list is kept as an empty list, not read as "all". The picker can
    // get you there — it's how you start from nothing and choose the few you
    // want — and coming back to a set of colors you didn't choose would be a
    // stranger answer than coming back to none.
    return parsed.filter((v): v is number => Number.isInteger(v) && (v as number) >= 0);
  } catch {
    return undefined;
  }
}

export function clearLegacyAllowedColors(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // The embedded webview may not expose storage. Absence already means there
    // is nothing to migrate, so this is harmless.
  }
}

/**
 * The slots a rule may use, resolved against the palette we actually have.
 *
 * Ascending, so `rainbow` walks Live's own picker order — its grid is row-major
 * and roughly a hue sweep, which is what makes the rule look like a rainbow
 * rather than like a shuffle.
 */
export function resolveAllowed(stored: number[] | null, paletteSize: number): number[] {
  if (stored === null) return Array.from({ length: paletteSize }, (_, i) => i);
  return [...new Set(stored)].filter((i) => i < paletteSize).sort((a, b) => a - b);
}
