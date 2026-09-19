// Runs a hook once, outside a browser.
//
// `react-dom/server` renders a component that calls the hook and returns
// nothing; the value the hook returned is what comes back. No DOM, no
// environment, no dependency — the suite stays `environment: 'node'` and a
// derivation hook costs the same to test as the function it wraps.
//
// **One render, and no state transitions.** `useState` gives its initial value
// and a setter that goes nowhere, because nothing re-renders. That is enough
// for every hook whose job is to derive — and it is not enough for one whose
// job is to *change*, which needs a real renderer and a DOM behind it. Reach
// for that when the hook under test has a gesture in it, rather than bending
// this into something it isn't.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export function firstRender<T>(use: () => T): T {
  let out: T | undefined;
  const Probe = () => {
    out = use();
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  return out as T;
}
