import { hex } from '@openflow/core/color.ts';
import { ControlButton } from './Control.tsx';
import './SwatchGrid.css';

interface Props {
  palette: number[];
  /** The index shown as chosen, or null/-1 for none. */
  current: number | null;
  /**
   * Multi-select: every member draws as chosen and `current` is ignored. For
   * picking a *set* of colors — which of them a rule may hand out — rather than
   * the one thing a swatch usually means.
   */
  chosen?: ReadonlySet<number>;
  onPick: (index: number) => void;
  disabled?: boolean;
  /** Tooltip per swatch. Defaults to `index N`. */
  titleFor?: (index: number, rgb: number) => string;
}

/**
 * The palette as a grid of clickable swatches — clip color, song color and
 * role color all render the same Live palette the same way.
 */
export function SwatchGrid({
  palette,
  current,
  chosen,
  onPick,
  disabled,
  titleFor,
}: Props) {
  return (
    <div className="swatches">
      {palette.map((rgb, i) => (
        <ControlButton
          key={i}
          type="button"
          className={`sw${(chosen ? chosen.has(i) : current === i) ? ' on' : ''}${
            chosen && !chosen.has(i) ? ' out' : ''
          }`}
          style={{ background: hex(rgb) }}
          title={titleFor ? titleFor(i, rgb) : `index ${i}`}
          aria-label={titleFor ? titleFor(i, rgb) : `index ${i}`}
          disabled={disabled}
          onClick={() => onPick(i)}
        />
      ))}
    </div>
  );
}
