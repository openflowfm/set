import type { ReactNode } from 'react';
import { Chain } from '@openflow/widgets/chrome/Chain.tsx';
import { Faceplate } from '../src/components/devices/Faceplate.tsx';
import { Eq8 } from '../src/components/devices/eq8/Eq8.tsx';
import { Plugin } from '../src/components/devices/plugin/Plugin.tsx';
import { DEVICE_SHAPES, useFakeDevice } from './fixtures.ts';

/**
 * Every device face the app draws, with no Live behind them.
 *
 * The widget bench proves the parts; this proves the arrangements. They can't
 * be one page: a face is composed in `set/` out of `widgets/`, and the widget
 * bench may import `widgets/src` and nothing else — which is the rule that
 * keeps that module from learning what an EQ Eight is.
 *
 * Nothing here needs a bridge, a socket or a set: a face reads a `ChainDevice`
 * and a list of parameters, and [`fixtures.ts`](./fixtures.ts) is a device that
 * answers like Live without being it. That is what makes this page worth
 * having — a face can be looked at in every state, including the ones that are
 * a nuisance to reach in a real set, and the app can't show any of them until
 * a track happens to have that device on it.
 */

function Face({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <section>
      <h2>{name}</h2>
      <div className="stage">{children}</div>
      <p className="note">{note}</p>
    </section>
  );
}

export function Bench() {
  const eq8 = useFakeDevice('Eq8', 'EQ Eight', DEVICE_SHAPES.eq8);
  const plugin = useFakeDevice('PluginDevice', 'Plug-In', DEVICE_SHAPES.plugin);
  const chained = useFakeDevice('Eq8', 'EQ Eight', DEVICE_SHAPES.eq8);
  const unknown = useFakeDevice('Overdrive', 'Overdrive', DEVICE_SHAPES.plugin);

  return (
    <div className="bench">
      <header>
        <h1>Device bench</h1>
        <p>
          The faces in <code>set/src/components/devices/</code>, drawn with the app's palette
          and no connection to Live. Each one is fed a fixture that answers like a device:
          moving a control writes the fixture and the face re-reads it, the way a control in
          the app writes Live and waits for the readback.
        </p>
      </header>

      <main>
        <Face
          name="EQ Eight"
          note="Eight parameter lanes on a shared row grid, an analyzer plate and an output plate. Controls drawn dead are slots the matcher found no parameter for, or ones the LOM doesn't expose — the display Live draws above the lanes is missing, and is what XYPad is for."
        >
          <Eq8 {...eq8} />
        </Face>

        <Face
          name="Plug-In"
          note="The container Live draws around a plug-in it can't draw itself: an X-Y control and the two choosers naming which parameters it moves. The plainest caller of XYPad there is — a plane with nothing behind it. Assign both axes and drag: those are real writes on the fixture's parameters."
        >
          <Plugin {...plugin} />
        </Face>

        <Face
          name="Faceplate"
          note="What a device with no face of its own gets: whatever controls it reports, in the order it reports them. Nearly every device in a set draws this, so it is the one worth looking at most."
        >
          <Faceplate {...unknown} />
        </Face>

        <Face
          name="In a chain"
          note="Where a face actually lands: in the run along the bottom of the window, between shells it has to sit level with. A device is never narrower than it is tall there, and the chain — not the face — owns the order."
        >
          <Chain>
            <Plugin {...plugin} />
            <Eq8 {...chained} />
          </Chain>
        </Face>
      </main>
    </div>
  );
}
