export const CLIPS = [
  { id: 'dribble', label: 'Basketball dribble' },
  { id: 'kick', label: 'Football kick' },
  { id: 'skate', label: 'Skateboard ramp' },
] as const;

export type ClipId = (typeof CLIPS)[number]['id'];

export function resolveClipId(fromUrl: string | null): ClipId {
  const match = CLIPS.find((entry) => entry.id === fromUrl);
  return match?.id ?? 'dribble';
}
