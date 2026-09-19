// @vitest-environment happy-dom
import { createElement } from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@openflow/core/roles.ts';
import { RoleMenu } from './RoleMenu.tsx';
afterEach(cleanup);

/**
 * The role picker, and the one rule that is easy to lose.
 *
 * The menu floats in a `Popup` now, which dismisses itself on a pointer
 * elsewhere. That is right everywhere except here: the grid underneath fires a
 * clip on click, so a full-screen shield sits under the panel to be what the
 * dismissing press lands on. If the panel closed on the pointerdown, the shield
 * would be gone before the click arrived — and the click would reach the very
 * thing the shield is there to cover.
 */
const VOCABULARY: Role[] = [
  { name: 'intro', colorIndex: 1 },
  { name: 'chorus', colorIndex: 2 },
];

const menu = (over: Partial<Parameters<typeof RoleMenu>[0]> = {}) => {
  const props = {
    vocabulary: VOCABULARY,
    palette: [0xff0000, 0x00ff00, 0x0000ff],
    anchor: { left: 40, top: 80, bottom: 96 },
    count: 1,
    current: null,
    mixed: false,
    busy: false,
    onPick: vi.fn(),
    onManage: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  return { props, view: render(createElement(RoleMenu, props)) };
};

const shieldOf = (view: ReturnType<typeof render>) =>
  view.container.querySelector('.viewport-overlay') as HTMLElement;

describe('the role menu', () => {
  it('offers the vocabulary and no role, and reports the one picked', () => {
    const { props, view } = menu();
    expect(view.getByText('intro')).toBeTruthy();
    expect(view.getByText('no role')).toBeTruthy();
    fireEvent.click(view.getByText('chorus'));
    expect(props.onPick).toHaveBeenCalledWith('chorus');
  });

  it('floats in the top layer rather than in the grid it covers', () => {
    const { view } = menu();
    const panel = view.container.querySelector('.menu');
    expect(panel?.getAttribute('popover')).toBe('manual');
    expect(panel?.classList.contains('wdg-popup')).toBe(true);
  });

  it('keeps the shield under the whole press, not just its start', () => {
    // The regression this exists for: closing on the pointerdown takes the
    // shield away, and the click lands on a clip.
    const { props, view } = menu();
    const shield = shieldOf(view);
    fireEvent.pointerDown(shield, { pointerId: 1, button: 0 });
    expect(props.onClose).not.toHaveBeenCalled();
    expect(shieldOf(view)).toBeTruthy();
    fireEvent.click(shield);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('stays open when the press was inside it', () => {
    const { props, view } = menu();
    const panel = view.container.querySelector('.menu') as HTMLElement;
    fireEvent.pointerDown(panel, { pointerId: 1, button: 0 });
    fireEvent.click(panel);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('gives up rather than pointing at the wrong row once the grid scrolls', () => {
    // It hangs off a box that was measured when it opened, and a box cannot be
    // asked again where it is.
    const { props } = menu();
    fireEvent.scroll(document, {});
    expect(props.onClose).toHaveBeenCalled();
  });

  it('closes on escape', () => {
    const { props } = menu();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });
});
