# Layout and CSS

Token ownership, which file owns which rule, stacking layers, and the styling conventions.

## CSS ownership

`shared.css` is the single source of truth for color, typography, control-height and
radius tokens, plus the small set of primitives genuinely shared across components:
text fields, labels, modal shells and scrollbars. `Control.tsx` and `Control.css` own every
button and select, segmented-group chrome, pressed and primary states, and the compact
select caret; a bare group or native select keeps component-specific layout and field
styling while retaining the same rendering API. Component-specific rules live beside
their `.tsx` owner and are imported from there. The two bulk workflows share
`BulkWorkflow.css`; the grid's table, scene rows and song rows each own separate files.

Keep a value in a component file when it describes that component's layout. Promote it to
`shared.css` only when changing it should intentionally change the same concept everywhere.
In particular, components use `--radius-*` rather than choosing literal corner radii.

### Stacking layers

Root-level stacking values are tokens in `shared.css`. Grid chrome occupies the low tiers,
the mixer owns 100–102, every viewport-sized interaction backdrop owns 200, and modal
content owns 300. That separation is structural: a sticky table cell must never be able to
paint over a dialog. Small literal `z-index` values are reserved for local paint order
inside a component, such as a meter's rules, marker, invisible input and buttons.

### Widget tokens

[`widgets/`](https://github.com/openflowfm/widgets/blob/main/README.md) carries its own token set in `src/tokens.css`, and
every one of them is written as `var(--host-token, fallback)` — `--wdg-fill` resolves to
`--amber`, `--wdg-caption` to `--caption`, and so on. So a control mounted in this app
inherits `shared.css` and a control on the bench uses its own defaults, without either
side declaring a palette the other has to match.

That is the only sanctioned direction. **`shared.css` never defines a `--wdg-*` token**,
and a widget never reads an app token by name. If a control needs to look different here,
it takes a `className` or a custom property from the component using it.

## Styling

Plain CSS with custom properties in `:root` — dark, IBM Plex where available with
system fallbacks. No CSS framework, no CSS-in-JS. The tokens (`--amber`, `--detail`,
`--bd`, …) come from the original design mocks; reuse them rather than introducing
new values.

Neutral text is the one family with a rule rather than a habit. Five tokens — `--fg`,
`--ui`, `--detail`, `--caption`, `--idle` — are named for the job the text is doing, so
choosing one is a question about the content and not about the shade; `shared.css`
carries the definition of each. No rule invents its own gray, and text recedes by taking
the next step down rather than by growing an `opacity`, which is reserved for a whole
control being disabled.

Scrollbars are chrome, not a component, so `shared.css` styles them once for every
container that scrolls. The thumb is a pill inset inside a transparent border with
`background-clip: padding-box`, which is what keeps a 10px hit target from reading as a
10px stripe against the content beside it: `--scroll-size` is the footprint the layout
pays for and `--scroll-inset` is how much of it is padding, so the visible thumb is 4px at
rest and thickens to 6px under the pointer without the column reflowing. Its three states
come from the neutral ramp — `--idle` at rest, `--focus` on hover, `--detail` while
dragging — because a scrollbar at rest is exactly the control the ramp's `--idle` step
describes. visual[flow]'s [`client/ui/console.css`](https://github.com/openflowfm/visuals/blob/main/client/ui/console.css)
carries the same rules and the same two tokens
scoped to `.console`, which is the one place the two apps are deliberately duplicated
rather than shared, since neither imports the other's CSS.

`--col-w` and `--meta-col-w` are the exception: `:root` carries fallbacks, but `ClipGrid`
sets both on the table element from `columnWidth.ts`, which stays the one place the grid
states a width. Only `--col-w` moves with the S/M/L/Auto/8/16 setting, and it sizes the
Master column along with the tracks. `--role-col-left` is derived from the pair and lives
on `table.grid` rather than `:root`, because it is written against `--gutter`, which does
too — a `calc()` referring to a custom property its own element doesn't define resolves to
nothing at all.
See *Column widths*.
