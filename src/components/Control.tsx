import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  LabelHTMLAttributes,
  Ref,
  SelectHTMLAttributes,
} from 'react';
import './Control.css';

function classes(...names: Array<string | false | undefined>): string {
  return names.filter(Boolean).join(' ');
}

interface ControlButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  icon?: boolean;
  intent?: 'default' | 'primary';
  pressed?: boolean;
  ref?: Ref<HTMLButtonElement>;
  surface?: 'clear' | 'filled';
}

/** One button, standalone or as a direct child of ControlGroup. */
export function ControlButton({
  className,
  icon = false,
  intent = 'default',
  pressed,
  surface = 'clear',
  type = 'button',
  ...props
}: ControlButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-pressed={pressed}
      className={classes(
        'control-button',
        icon && 'control-button-icon',
        intent === 'primary' && 'control-button-primary',
        surface === 'filled' && 'control-button-filled',
        pressed !== undefined && 'control-button-toggle',
        pressed && 'control-button-on',
        className,
      )}
    />
  );
}

interface ControlGroupProps extends HTMLAttributes<HTMLDivElement> {
  appearance?: 'segmented' | 'bare';
  label: string;
  surface?: 'clear' | 'filled';
}

/** A labelled control group, segmented by default or bare for custom layouts. */
export function ControlGroup({
  appearance = 'segmented',
  children,
  className,
  label,
  surface = 'clear',
  ...props
}: ControlGroupProps) {
  return (
    <div
      {...props}
      className={classes(
        'control-group',
        appearance === 'bare' && 'control-group-bare',
        surface === 'filled' && 'control-group-filled',
        className,
      )}
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );
}

interface ControlSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  appearance?: 'compact' | 'native';
  containerClassName?: string;
}

/** A native select, with shared compact chrome or its surrounding field's styling. */
export function ControlSelect({
  appearance = 'compact',
  children,
  className,
  containerClassName,
  ...props
}: ControlSelectProps) {
  if (appearance === 'native') {
    return (
      <select {...props} className={className}>
        {children}
      </select>
    );
  }

  return (
    <div className={classes('control-select', containerClassName)}>
      <select {...props} className={className}>
        {children}
      </select>
      <span className="control-select-caret" aria-hidden="true" />
    </div>
  );
}

/** A non-button item inside a group, such as the tempo editor. */
export function ControlField({
  children,
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label {...props} className={classes('control-field', className)}>
      {children}
    </label>
  );
}
