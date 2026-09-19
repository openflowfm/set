// Clips have no stable id in the LOM, so within a session they're addressed by
// (track index, scene index). See README — cross-session identity is a separate
// problem that lands with song segmentation.

export type ClipKey = string;

export function clipKey(t: number, s: number): ClipKey {
  return `${t}:${s}`;
}

export function parseClipKey(key: ClipKey): { t: number; s: number } {
  const [t, s] = key.split(':');
  return { t: Number(t), s: Number(s) };
}
