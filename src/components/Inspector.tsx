import { hex } from '@openflow/core/color.ts';
import { DEFAULT_CLIP_PATTERN, TOKENS, unknownTokens } from '@openflow/core/pattern.ts';
import { ColorSelect } from './ColorSelect.tsx';
import { ControlButton } from './Control.tsx';

interface Props {
  palette: number[];
  /** Last color written, for the swatch highlight only. */
  chosenIndex: number | null;
  onColor: (index: number) => void;
  pattern: string;
  onPattern: (s: string) => void;
  selectedCount: number;
  /** Clips the role-color action would actually write. */
  roleColorCount: number;
  /** Clips the pattern would actually change — excludes ones already named that. */
  renameCount: number;
  preview: string | null;
  busy: boolean;
  progress: { done: number; total: number } | null;
  undoDepth: number;
  onRename: () => void;
  onColorClips: () => void;
  onUndo: () => void;
  onClear: () => void;
}

export function Inspector({
  palette,
  chosenIndex,
  onColor,
  pattern,
  onPattern,
  selectedCount,
  roleColorCount,
  renameCount,
  preview,
  busy,
  progress,
  undoDepth,
  onRename,
  onColorClips,
  onUndo,
  onClear,
}: Props) {
  const bad = unknownTokens(pattern);
  const none = selectedCount === 0;

  // A fragment, not the <aside>: App owns the rail so the roles panel can sit
  // in the same scrolling column above this one.
  return (
    <>
      <div className="lbl facet-title">
        <span>Clips</span>
        <span className="facet-summary">
          {none
            ? 'select clips'
            : `${selectedCount} clip${selectedCount === 1 ? '' : 's'} selected`}
        </span>
      </div>

      {/* Direct color first: it writes on click and is the common case. */}
      {palette.length === 0 ? (
        <div className="hint">Built-in palette unavailable — rebuild the app.</div>
      ) : (
        <>
          <ColorSelect
            palette={palette}
            current={chosenIndex}
            disabled={none || busy}
            label="Color"
            titleFor={(i, rgb) =>
              `index ${i} — ${hex(rgb)}${none ? '' : ` — apply to ${selectedCount} clips`}`
            }
            onPick={onColor}
          />
          <div className="hint">
            {none
              ? 'Click a scene name to select its clips.'
              : 'Clicking a swatch writes it straight away.'}
          </div>
        </>
      )}

      {/* A role colors clips and nothing else. Scene rows keep the song color,
          while every clip in a selected scene takes that scene's role color. */}
      <ControlButton
        intent="primary"
        disabled={roleColorCount === 0 || busy}
        title="Color every clip in the selected scenes with its own scene's role color"
        onClick={onColorClips}
      >
        Color {roleColorCount} clip{roleColorCount === 1 ? '' : 's'} by role
      </ControlButton>

      <div className="lbl">Rename selected</div>
      <input
        type="text"
        value={pattern}
        placeholder={DEFAULT_CLIP_PATTERN}
        onChange={(e) => onPattern(e.target.value)}
        spellCheck={false}
      />
      <div className="hint">
        {bad.length > 0 ? (
          <span className="bad">
            unknown token{bad.length > 1 ? 's' : ''}: {bad.join(', ')}
          </span>
        ) : (
          <>Tokens: {TOKENS.map((t) => `{${t}}`).join(' ')}</>
        )}
      </div>
      {preview !== null && (
        <div className="hint">
          Preview <span className="preview">{preview || '(empty)'}</span>
        </div>
      )}
      <ControlButton
        intent="primary"
        onClick={onRename}
        disabled={renameCount === 0 || busy}
      >
        {progress ? `${progress.done} / ${progress.total}` : `Rename ${renameCount}`}
      </ControlButton>

      <div className="spacer" />

      <ControlButton onClick={onUndo} disabled={undoDepth === 0 || busy}>
        Undo last write
      </ControlButton>
      <ControlButton onClick={onClear} disabled={none}>
        Clear selection
      </ControlButton>
    </>
  );
}
