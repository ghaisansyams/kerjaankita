# FlowDesk — Design System

The canonical foundation for every screen. This document is the source of truth
for tokens; the implemented values live in `src/app/globals.css`. Where the two
ever disagree, `globals.css` wins and this doc is corrected.

> **Industry-neutral by rule.** FlowDesk serves IT, schools, construction,
> agencies, manufacturing, healthcare, government, property, logistics and
> startups from one UI. The system therefore ships **no industry imagery, no
> domain-specific iconography, and no hard-coded domain words.** Nouns come from
> the tenant's `organization_settings.terminology` map (Project→Site/Case/
> Campaign, Task→Work Order/Activity, Account→Client/Patient/Student…). Colour
> for statuses comes from the tenant's own workflow. The chrome stays constant;
> the vocabulary and workflow adapt.

---

## 1 · Design principles

1. **Calm over loud.** Large surfaces are neutral. Saturated colour is reserved for meaning (status, priority, health) and never decorates.
2. **Content first.** Chrome recedes; the user's work is the brightest thing on screen.
3. **Dense but breathable.** Information-rich like Linear, not cramped. Whitespace is a feature, not a gap.
4. **One primary action per view.** Everything else is secondary or tertiary.
5. **The database is the source of truth, the UI reflects it.** Never invent state the backend can't confirm (health, progress, permissions).
6. **Adapt, don't fork.** The same components render a hospital and a construction firm. Differences are data (terminology, workflow, fields), not layout.
7. **Accessible by default, not as a retrofit.** Contrast, focus, keyboard and motion rules are part of every token below.

---

## 2 · Colour

### 2.1 Model

Colour is expressed as **semantic tokens**, never raw values, so light/dark and
future theming resolve in one place. Values are OKLCH (perceptually uniform);
hex is an approximation for design tools.

### 2.2 Neutral & brand tokens

| Token | Role | Light (hex ≈) | Dark (hex ≈) |
|---|---|---|---|
| `background` | App canvas | `#FFFFFF` | `#0B1120` (slate-950) |
| `foreground` | Primary text | `#0A0F1E` | `#F8FAFC` |
| `card` | Card / panel surface | `#FFFFFF` | `#111827` (slate-900) |
| `popover` | Floating surface | `#FFFFFF` | `#111827` |
| `muted` | Subtle fill (rails, chips) | `#F1F5F9` (slate-100) | `#1E293B` (slate-800) |
| `muted-foreground` | Secondary text | `#64748B` (slate-500) | `#94A3B8` (slate-400) |
| `border` | Hairlines, dividers | `#E2E8F0` (slate-200) | `rgba(255,255,255,.10)` |
| `input` | Field borders | `#E2E8F0` | `rgba(255,255,255,.15)` |
| `primary` | Brand, primary actions, focus ring | `#4F46E5` (indigo-600) | `#6366F1` (indigo-500) |
| `primary-foreground` | Text on primary | `#FFFFFF` | `#FFFFFF` |
| `secondary` | Secondary buttons/fills | `#F1F5F9` | `#1E293B` |
| `accent` | Hover tint (menus, rows) | `#EEF0FF` (indigo-tinted) | `#1E293B` |
| `destructive` | Danger, delete | `#DC2626` | `#F87171` |
| `ring` | Focus outline | `#4F46E5` | `#6366F1` |

**Rules**
- Body text on `background` ≥ 4.5:1. `muted-foreground` is the lightest text permitted for body copy; never go lighter.
- Never pure `#000`/`#FFF` text on the opposite pure background — the tokens above are deliberately softened.
- Indigo is the *only* brand hue. It appears on the primary button, active nav, focus ring, links, and selection — nowhere else at scale.

### 2.3 Functional colour — the only place hue carries meaning

These map 1:1 to database enums so UI and data never drift. Rendered as **soft
tinted chips** (light bg + saturated text), plus a solid dot for dense contexts.

**Status category** (`status_category` — every tenant workflow status maps to one):

| Category | Hue | Meaning |
|---|---|---|
| `backlog` / `todo` | Slate | Not started |
| `in_progress` | Blue | Active work |
| `review` | Indigo/Violet | Awaiting review |
| `done` | Emerald | Complete |
| `blocked` | Rose | Stuck |
| `cancelled` | Slate (dim) | Abandoned |

> A tenant status also carries its **own** `color`. The chip uses the tenant
> colour for its dot; the category drives the fallback tint and all logic.

**Priority** (`priority_level`): none→slate · low→slate · medium→blue · high→amber · critical→rose.

**Project health** (`project_health`): on_track→emerald · at_risk→amber · delayed→rose.

Each functional hue has a light and dark chip recipe (light: `50` bg / `700` text; dark: `950/60` bg / `300` text) so contrast holds in both themes.

### 2.4 Data-visualisation palette

Brand-neutral, ordered for categorical series, checked for deuteranopia distinctness:

`indigo-600 → blue-500 → sky-500 → violet-400 → cyan-600 → slate-400`

- Sequential (one measure): single-hue indigo ramp, light→dark.
- Diverging (e.g. ahead/behind schedule): rose ↔ neutral ↔ emerald.
- Never exceed 6 categorical colours; beyond that, group into "Other".
- Charts must not rely on colour alone — pair with labels/patterns/direct annotation.

### 2.5 Tenant accent

Projects and workspaces store a `color` from a curated 10-swatch palette
(`#4F46E5 #2563EB #0EA5E9 #0891B2 #7C3AED #DB2777 #059669 #D97706 #DC2626 #475569`).
Used only as **small identifiers** — a 2–3px left bar on a project card, a dot in
lists, an avatar tint. Never as a large fill (it would fight the calm neutral canvas and break dark mode).

---

## 3 · Typography

**Families:** `Inter` (UI, variable) · `JetBrains Mono` (IDs, code, keyboard hints, tabular data). System fallbacks: `ui-sans-serif`, `ui-monospace`.

### 3.1 Type scale

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| Display | 30 / 36 | 600 | −0.02em | Auth headlines, empty-state heroes |
| H1 | 24 / 30 | 600 | −0.02em | Page title |
| H2 | 20 / 28 | 600 | −0.01em | Section header |
| H3 | 16 / 24 | 600 | 0 | Card title, dialog title |
| Body | 14 / 20 | 400 | 0 | **Default UI text** |
| Body-strong | 14 / 20 | 500 | 0 | Names, emphasis, labels |
| Small | 13 / 18 | 400 | 0 | Secondary text |
| Caption | 12 / 16 | 400 | 0 | Timestamps, metadata |
| Micro | 11 / 14 | 500 | 0.02em | Badges, group labels, `kbd` |
| Mono | 13 / 18 | 400 | 0 | `WEB-42`, hashes, counts |

### 3.2 Rules
- **14px base.** Never below **12px** anywhere. Mobile form inputs render at **16px** to prevent iOS zoom.
- Body line-height 1.5; headings 1.25.
- Reading measure capped at ~70 characters (prose, descriptions, comments).
- **Tabular figures** for any aligned numbers (tables, metrics, timers) so digits don't jitter.
- Headings use `text-wrap: balance`; long body uses `text-wrap: pretty`.
- Never communicate with weight alone below 13px — pair with colour/space.

---

## 4 · Spacing

4px base unit. Named steps:

| Step | px | Typical use |
|---|---|---|
| 0.5 | 2 | Icon optical nudges |
| 1 | 4 | Chip inner padding |
| 2 | 8 | Inline gaps, label→control |
| 3 | 12 | Compact card padding, list row gaps |
| 4 | 16 | Default gap; mobile page padding |
| 5 | 20 | — |
| 6 | 24 | Card padding; gap between sections |
| 8 | 32 | Desktop page padding |
| 12 | 48 | Major section separation |
| 16 | 64 | Empty-state vertical breathing room |

**Layout rules:** page padding `16 → 24 → 32` (mobile → tablet → desktop). Card padding `24` (compact variants `12–16`). Vertical rhythm between page sections `24`. Related controls `8`; unrelated groups `16–24`.

---

## 5 · Radius

Base `10px`. Consistent rounding is a big part of the "modern SaaS" read.

| Token | px | Applied to |
|---|---|---|
| sm | 6 | Badges, chips, `kbd`, small tags |
| md | 8 | Buttons, inputs, select, menu items |
| lg | 10 | **Cards, dropdowns, popovers** (default) |
| xl | 14 | Dialogs, sheets, large panels |
| 2xl | 18 | Auth card, marketing/hero surfaces |
| full | 9999 | Avatars, dots, progress rings, pills |

Nested radii step down (a control inside a card uses `md`, the card uses `lg`) so corners stay concentric.

---

## 6 · Elevation & depth

Structure comes from **borders and surface tint**, not shadow. Shadow is reserved
for genuinely floating layers, and is progressive.

| Level | Shadow | Used by | Dark-mode treatment |
|---|---|---|---|
| 0 | none (1px border) | Cards, table, inputs at rest | Border + `card` surface only |
| 1 | xs (barely-there) | Hover on interactive card/row | Slightly lighter surface, no real shadow |
| 2 | sm | Dropdown, popover, select, tooltip | Lighter surface + stronger border |
| 3 | md | Drawer / side sheet | Surface `card`, 1px left border |
| 4 | md-lg | Dialog / modal | Surface `popover` + scrim |
| 5 | lg | Command palette | Highest surface + scrim + blur |

**Dark-mode depth rule:** shadows are nearly invisible on dark backgrounds, so
depth is conveyed by **surface lightness** (each level a step lighter than the
one behind) plus a slightly more visible border — not by heavier shadow.

### Z-index scale
`base 0` · `sticky header 30` · `dropdown/menu 40` · `overlay scrim 50` · `dialog/sheet 50` · `popover/tooltip 60` · `toast 70` · `command palette 80`. Nothing invents values outside this ladder.

---

## 7 · Iconography

- **Library:** Lucide, one set, no mixing. No emoji as UI icons, ever.
- **Grid:** 24×24 viewBox. Sizes: `16` (inline, dense), `18` (buttons), `20` (nav, section headers), `24` (empty-state, feature). Stroke `1.5–2px`, consistent within a context.
- **Colour:** inherit text colour by default; `muted-foreground` for decorative, `primary` for active/selected, functional hue only when the icon *is* the status.
- **Rules:** every icon-only control has an accessible label. Decorative icons are hidden from assistive tech. Icon + text share vertical centre with an `8px` gap. Don't resize a glyph mid-list.

### Canonical icon vocabulary (stable across all tenants)
Dashboard · My Work (list-todo) · Projects (folder-kanban) · Timeline (gantt) · Calendar · Reports (bar-chart) · Files (folder-open) · Team (users) · Members (user) · Clients/Accounts (building) · Settings (gear) · Search · Notifications (bell) · Comment (message) · Attachment (paperclip) · Blocked (octagon-alert) · Add (plus) · More (ellipsis) · Guest (external identity).

---

## 8 · Grid & layout

### Breakpoints
| Name | Min width | Shell behaviour |
|---|---|---|
| base | 0 | Single column, off-canvas nav, tables→cards, dialogs→bottom sheets |
| sm | 640 | Two-column forms where sensible |
| md | 768 | Sidebar collapses to icon rail; split views appear |
| lg | 1024 | Full sidebar; multi-column dashboards; list+detail split |
| xl | 1280 | Wider content, timeline shows more span |
| 2xl | 1536 | Max content width caps; extra margin |

### App shell grid
`[ sidebar 264px | content 1fr ]`; sidebar collapses to `56px` icon rail. Content region: sticky 56px topbar + scrolling main. Main content max-width ~`1200px` centred on ultrawide; **prose/reading** regions (descriptions, comments) capped at ~`720px`.

### Content grid
12-column, `24px` gutters within a page region. Common compositions: dashboard KPI row `1 / 2 / 4` columns by breakpoint; project list cards `1 / 2 / 3`; detail pages `2fr / 1fr` (main + meta rail) collapsing to stacked on `< lg`.

---

## 9 · Buttons

| Variant | Use | Appearance |
|---|---|---|
| Primary | The single main action of a view | Indigo fill, white text |
| Secondary | Supporting action | Slate fill |
| Outline | Toolbar, tertiary, "Cancel" in toolbars | Border + transparent |
| Ghost | Icon buttons, menu triggers, low emphasis | Transparent, tinted hover |
| Destructive | Delete / irreversible | Red fill; always behind confirmation |
| Link | Inline navigation inside text | Underline on hover |

**Sizes:** sm `32px` · default `36px` · lg `40px` · icon `36×36`. **Mobile touch target ≥ 44px** (expand hit-area even if the visual stays 36).

**States:** default · hover (tint/fill shift, never scale — scaling shifts layout) · active (slightly pressed) · focus-visible (2px indigo ring, 2px offset) · disabled (reduced opacity, no pointer) · **loading** (leading spinner, disabled, label becomes the present-tense verb — "Save"→"Saving…").

**Rules:** exactly one Primary per view. Labels are verbs ("Create project", not "OK"). Icon-only buttons require `aria-label`. Destructive actions never one-click.

---

## 10 · Tables

- **Header:** 12px, 500 weight, `muted-foreground`, no uppercase-shouting; sortable headers show a direction caret.
- **Row:** 48px default (comfortable), 40px compact mode; 1px bottom border; hover `accent`. Zebra striping off by default (borders suffice); optional for very wide tables.
- **Columns:** first column is the identifier and links to detail. Numerics right-aligned, tabular. Status/priority render as chips. Avatars for people.
- **Row actions:** trailing `⋯` menu; primary inline action may be shown on row hover.
- **Selection:** leading checkbox column; a selection toolbar replaces the header when ≥1 row is selected (count + bulk actions).
- **Structure:** sticky header on scroll; sticky first column on horizontal scroll for wide tables; pagination or "load more" at the foot.
- **Mobile:** tables **become card lists** below `md`. Horizontal-scrolling data tables are a failure state, not a plan. Wide, unavoidable tables scroll inside their own container — the page body never scrolls sideways.

---

## 11 · Forms

- **Label** above control, `Body-strong`, `8px` gap. Never placeholder-as-label.
- **Field spacing** `16px`; grouped fields in a titled section with `24px` between groups.
- **Help text** below the control in `muted-foreground` `Small`.
- **Required** marked on the label (a subtle marker + `aria-required`), not by colour alone.
- **Validation:** on blur and on submit — never on every keystroke. Error shows **below** the field in `destructive`, with an icon, and the field border turns `destructive`; the field gains `aria-invalid` and is linked to the message via `aria-describedby`. First error is focused/scrolled into view on submit.
- **Inputs:** 36px height (40px on touch), `md` radius, `input` border, 2px indigo focus ring. Disabled = muted surface + no pointer; readonly = no border emphasis.
- **Async submit:** button shows loading; the form disables; success routes/toasts, failure surfaces a banner above the form (plus inline field errors when the server returns them).
- **Destructive / irreversible forms** require explicit confirmation (typed name for high-risk deletes).

---

## 12 · Motion

- Micro-interactions `150–200ms`; overlays (dialog/sheet/menu) `200–300ms`; easing `ease-out` entering, `ease-in` leaving.
- Animate **`transform` and `opacity` only** (GPU-cheap, no layout thrash).
- No animation on data values — a number that flashes/slides reads as an error.
- **`prefers-reduced-motion`**: replace slides/scales with instant or simple fades; disable parallax and auto-playing motion. Honoured globally.

---

## 13 · Dark mode rules

1. **Class strategy:** dark is a `.dark` class on the root; default follows the OS (`prefers-color-scheme`), overridable by a user toggle whose choice persists.
2. **Every token has a dark value** (§2.2). Components never hard-code a colour — they reference tokens, so dark "just works".
3. **Depth via surface, not shadow** (§6): each elevation level is a step lighter; borders are slightly more visible than in light mode.
4. **Softened extremes:** background is slate-950 (not `#000`), text is slate-50 (not `#FFF`). Pure black/white cause halation on OLED and eye strain.
5. **Desaturated status tints:** chips switch to `950/60` fills with `300` text so they glow gently instead of vibrating.
6. **Media:** images get a subtle border to separate from the dark canvas; illustrations avoid large white fields; charts swap gridlines to low-opacity light and keep series colours (already dark-safe).
7. **Contrast re-checked in dark**, not assumed — muted text must still clear 4.5:1 against `card` and `background`.
8. **No pure-white overlays/scrims** — scrims are black at ~50–60% in both themes; surfaces do the lightening.

---

## 14 · Accessibility floor (non-negotiable, applies everywhere)

- Text contrast ≥ 4.5:1 (≥ 3:1 for ≥ 18px / bold).
- Visible `focus-visible` ring on **every** interactive element; focus order matches visual order.
- Full keyboard operability; no hover-only actions; no keyboard traps (except intended focus-trapped modals, which return focus on close).
- Colour is never the sole signal — status pairs a dot/label, errors pair an icon/text.
- All images have alt text (empty alt for decorative); icon-only controls are labelled.
- Semantic landmarks (`header`/`nav`/`main`/`aside`), correct heading order, one `h1` per page.
- Live regions announce toasts, async results, and validation summaries.
- Target size ≥ 44×44px on touch. Respect `prefers-reduced-motion` and `prefers-contrast`.
