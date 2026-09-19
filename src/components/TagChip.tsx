import type { CSSProperties } from 'react';
import './TagChip.css';

interface Props {
  tag: string;
  /** CSS color for the outline and text. Falls back to the shared dim color. */
  color?: string;
  /** A disagreement uses the app's warning color, regardless of `color`. */
  clash?: boolean;
  className?: string;
  title?: string;
}

type TagChipStyle = CSSProperties & { '--tag-chip-color'?: string };

/** The shared inverted pill for song tags everywhere they are rendered. */
export function TagChip({ tag, color, clash = false, className = '', title }: Props) {
  if (tag === '') return null;

  const classes = ['tag-chip', clash ? 'clash' : '', className].filter(Boolean).join(' ');
  const style: TagChipStyle | undefined = color ? { '--tag-chip-color': color } : undefined;

  return (
    <span className={classes} style={style} title={title ?? `song tag: ${tag}`}>
      {tag}
    </span>
  );
}
