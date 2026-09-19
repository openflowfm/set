import { useCallback, useRef, useState } from 'react';
import { hex } from '@openflow/core/color.ts';
import { Popup, type Dismissal } from '@openflow/widgets/chrome/Popup.tsx';
import { SwatchGrid } from './SwatchGrid.tsx';
import { ControlButton } from './Control.tsx';
import './ColorSelect.css';

interface Props {
  palette: number[];
  /** The palette slot shown in the closed control, or null/-1 when unknown. */
  current: number | null;
  onPick: (index: number) => void;
  /** Optional "No color" choice for draft values that have not been written yet. */
  onClear?: () => void;
  disabled?: boolean;
  /** Visible label, accessible name and the small heading over the open palette. */
  label: string;
  /** Another field supplies the visible label, as in the song-name row. */
  showLabel?: boolean;
  titleFor?: (index: number, rgb: number) => string;
}

/**
 * A compact, single-select color control.
 *
 * The full palette only appears while choosing. A swatch commits immediately
 * and closes the popup, preserving the write-on-click behavior of the old
 * always-open grid without making the rail carry all seventy colors at once.
 *
 * The palette floats in [`Popup`](@openflow/widgets/chrome/Popup.tsx) rather
 * than in a portal to `document.body`. A portalled div wins its layer with a
 * `z-index`, and there is no number that puts one above a `<dialog>` — so a
 * picker opened from a modal would have been drawn behind the sheet that opened
 * it. The top layer is not something to bid for.
 */
export function ColorSelect({
  palette,
  current,
  onPick,
  onClear,
  disabled,
  label,
  showLabel = true,
  titleFor,
}: Props) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const rgb = current !== null && current >= 0 ? palette[current] : undefined;

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  // A pointer elsewhere has already chosen where it is going; escape has not.
  const dismiss = useCallback((how: Dismissal) => {
    setOpen(false);
    if (how === 'escape') trigger.current?.focus();
  }, []);

  const button = (
    <ControlButton
      ref={trigger}
      type="button"
      className={`color-select${rgb === undefined ? ' empty' : ''}`}
      style={rgb === undefined ? undefined : { background: hex(rgb) }}
      disabled={disabled || palette.length === 0}
      aria-label={`Choose ${label.toLowerCase()}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={
        palette.length === 0
          ? 'Built-in palette unavailable'
          : rgb === undefined
            ? `Choose ${label.toLowerCase()}`
            : `Change ${label.toLowerCase()} — index ${current}`
      }
      onClick={() => setOpen((was) => !was)}
    />
  );

  return (
    <>
      {showLabel ? (
        <div className="color-select-row">
          <span className="lbl">{label}</span>
          {button}
        </div>
      ) : (
        button
      )}

      {open && (
        <Popup
          anchor={trigger}
          onDismiss={dismiss}
          className="color-select-popover"
          role="dialog"
          label={label}
        >
          <div className="color-select-heading">{label}</div>
          <SwatchGrid
            palette={palette}
            current={current}
            titleFor={titleFor}
            onPick={(index) => {
              close();
              onPick(index);
            }}
          />
          {onClear && (
            <ControlButton
              type="button"
              className="color-select-none"
              onClick={() => {
                close();
                onClear();
              }}
            >
              No color
            </ControlButton>
          )}
        </Popup>
      )}
    </>
  );
}
