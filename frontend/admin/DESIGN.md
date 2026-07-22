# Design System Analysis: Railboard Admin

Railway data administration interface. Operational SaaS dashboard with precise tables, structured forms, route validation, station ordering, JSON data management, and railway dataset reload workflows.

Railboard Admin takes railway operations as its conceptual base, then translates it into a clean technical back-office interface. It works best for managing structured railway networks, commuter rail lines, routes, stations, data imports, and validation workflows.

This DESIGN.md applies only to the Railboard Admin interface.

## Primary Admin Priorities

The admin UI should be organized around these working areas:

- Responsive sidebar and topbar shell.
- Dashboard KPI cards for routes, stations, networks, operators, displays, and trains.
- Railway networks, lines, routes, and stations tables.
- Route station editor for inspecting and adjusting route station order.
- JSON import workflow with validation before applying changes.
- Validation screen with clear data quality warnings and counts.
- Explicit reload action for the railway dataset.

These priorities take precedence over decorative or marketing-oriented presentation.

It must not be applied to:

- The public Railboard display.
- Passenger-facing screens.
- Station boards.
- Train simulation views.
- Public railway visualizations.
- Marketing pages.
- Landing pages.

The admin should feel like a professional internal tool for maintaining railway data, not like a consumer transport app.

## Visual Identity

Railboard Admin uses a calm, technical, infrastructure-oriented design language.

The interface should communicate:

- Precision.
- Reliability.
- Control.
- Data integrity.
- Operational confidence.
- Railway system awareness.

The product should look like a serious SaaS administration panel for transport data. It should not feel playful, decorative, nostalgic, or overly themed.

Use railway concepts structurally, not decoratively. The interface may use line codes, route direction, station order, validation states, and network metadata, but should avoid unnecessary train illustrations, decorative tracks, excessive gradients, or toy-like visuals.

## Overall Aesthetic

The visual style is:

- Clean.
- Dense but readable.
- Technical.
- Data-first.
- Structured.
- Professional.
- Calm.
- Operational.

The admin should look closer to a modern infrastructure dashboard, logistics control panel, or technical CMS than to a public transport journey planner.

Preferred inspiration:

- SaaS admin dashboards.
- Cloud infrastructure consoles.
- Data management tools.
- Monitoring and validation panels.
- Modern B2B back-office products.

Avoid:

- Bright consumer app aesthetics.
- Heavy gradients.
- Decorative railway imagery.
- Cartoon icons.
- Overly playful microcopy.
- Excessive shadows.
- Oversized empty hero sections.

## Tailwind CSS Implementation

Railboard Admin is implemented with Tailwind CSS.

All visual decisions should be expressed using Tailwind utility classes whenever possible. Do not describe layout, typography, spacing, or responsive behavior using raw `rem` values in implementation guidance.

Use Tailwind classes as the default design language for the admin interface.

Preferred utility patterns:

```html
bg-slate-50 bg-white text-slate-900 text-slate-700 text-slate-500 border-slate-200 rounded-lg rounded-xl shadow-sm p-4 md:p-6 lg:p-8 gap-4
grid flex md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 overflow-x-auto min-w-0 truncate
```

Avoid unnecessary custom CSS unless a component cannot be reasonably implemented with Tailwind utilities.

## Tailwind Breakpoints

Use Tailwind’s default responsive breakpoints:

```text
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

Railboard Admin is desktop-first in terms of product usage, but it must still be responsive.

Recommended responsive behavior:

```text
Base / mobile:
Single-column layout, collapsed navigation, stacked cards, simplified actions.

sm:
Improved spacing and horizontal action groups where space allows.

md:
Tablet layout, two-column forms where useful, better table/card balance.

lg:
Persistent sidebar, full dashboard layout, data tables, desktop topbar.

xl:
Comfortable admin workspace with multi-column summaries and route editor panels.

2xl:
Large-screen optimization for railway data management, wider tables, richer side panels.
```

## Color System

The color system should be restrained and functional.

### Primary Color

Use deep railway blue as the main administrative color.

Recommended Tailwind usage:

```html
bg-blue-900 text-blue-900 border-blue-900 focus:ring-blue-900/20 hover:bg-blue-800
```

Use it for:

- Primary buttons.
- Active sidebar items.
- Main navigation emphasis.
- Selected tabs.
- Important admin actions.
- Focus rings when appropriate.

Do not overuse the primary color as a full-screen background. It should create hierarchy, not dominate the interface.

### Primary Soft Color

Use soft blue backgrounds for low-emphasis selected states.

Recommended Tailwind usage:

```html
bg-blue-50 text-blue-900 border-blue-100
```

Use it for:

- Active navigation backgrounds.
- Subtle callouts.
- Selected filters.
- Informational panels.
- Low-emphasis highlights.

### Secondary Color

Use muted teal for operational and positive secondary states.

Recommended Tailwind usage:

```html
bg-teal-700 text-teal-700 bg-teal-50 text-teal-800
```

Use it for:

- Secondary actions.
- Healthy system indicators.
- Successful imports.
- Data status summaries.
- Railway network metadata.

### Background Colors

Use a light, neutral background.

Recommended Tailwind usage:

```html
bg-slate-50 bg-slate-100 bg-white
```

Typical usage:

- `bg-slate-50` for the main app background.
- `bg-white` for cards, tables, panels, modals, and forms.
- `bg-slate-100` for muted panels, table headers, nested containers, and empty states.

### Border Color

Use subtle borders to define structure.

Recommended Tailwind usage:

```html
border-slate-200 divide-slate-200
```

Prefer borders over heavy shadows.

### Text Colors

Use dark slate for primary text and muted slate for secondary text.

Recommended Tailwind usage:

```html
text-slate-900 text-slate-700 text-slate-500
```

Use:

- `text-slate-900` for headings and important data.
- `text-slate-700` for default body text.
- `text-slate-500` for metadata, helper text, timestamps, and secondary labels.

### State Colors

Use semantic colors consistently.

Recommended Tailwind usage:

```html
bg-green-50 text-green-700 bg-amber-50 text-amber-700 bg-red-50 text-red-700 bg-blue-50 text-blue-700
```

Use them for:

- Validation results.
- Import results.
- Data consistency checks.
- Form errors.
- Destructive actions.

Never rely on color alone. Always include a text label.

## Tailwind Typography

Use Tailwind typography utilities instead of raw font sizes.

Recommended hierarchy:

```html
<!-- Page title -->
<h1 class="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Routes</h1>

<!-- Section title -->
<h2 class="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">Data validation</h2>

<!-- Card title -->
<h3 class="text-base md:text-lg font-semibold text-slate-900">Import summary</h3>

<!-- Body text -->
<p class="text-sm md:text-base text-slate-700 leading-relaxed">Manage railway routes, stations and validation status.</p>

<!-- Metadata / helper text -->
<p class="text-xs md:text-sm text-slate-500">Last reload: 4 minutes ago</p>
```

Typography should remain compact and admin-oriented.

Avoid oversized marketing headings such as:

```html
text-5xl text-6xl font-extrabold
```

unless explicitly required for a special onboarding or empty state.

Use monospace only for technical identifiers, route IDs, station IDs, JSON keys, logs, and import diagnostics.

Recommended usage:

```html
<code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700"> valencia-c1-gandia </code>
```

## Tailwind Spacing

Use Tailwind spacing classes.

Recommended spacing scale:

```text
gap-1
gap-2
gap-3
gap-4
gap-6
gap-8

p-2
p-3
p-4
p-6
p-8

px-3
px-4
px-6

py-2
py-3
py-4
```

Typical page container:

```html
<main class="p-4 md:p-6 lg:p-8 space-y-6">
  <!-- Admin content -->
</main>
```

Typical card:

```html
<section class="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
  <!-- Card content -->
</section>
```

Typical form grid:

```html
<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
  <!-- Form fields -->
</div>
```

Typical KPI grid:

```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <!-- KPI cards -->
</div>
```

Spacing should be comfortable but not excessive. Railboard Admin is a data management tool, so density matters.

## Tailwind Layout

Railboard Admin uses a responsive dashboard layout.

### Mobile Layout

On small screens, the sidebar should be hidden behind a drawer or menu button.

```html
<div class="min-h-screen bg-slate-50">
  <header class="sticky top-0 z-40 border-b border-slate-200 bg-white">
    <!-- Mobile topbar -->
  </header>

  <main class="p-4 space-y-6">
    <!-- Admin content -->
  </main>
</div>
```

Use:

```html
lg:hidden
```

for mobile navigation controls.

### Desktop Layout

From `lg` upwards, use a persistent sidebar.

```html
<div class="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[280px_1fr]">
  <aside class="hidden lg:flex lg:flex-col border-r border-slate-200 bg-white">
    <!-- Sidebar -->
  </aside>

  <div class="flex min-w-0 flex-col">
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <!-- Topbar -->
    </header>

    <main class="p-6 xl:p-8 space-y-6">
      <!-- Main admin content -->
    </main>
  </div>
</div>
```

Use `min-w-0` on main content containers to prevent long station names, route names, or IDs from breaking the layout.

## Tailwind Sidebar Pattern

The sidebar should be persistent on desktop and collapsible on mobile.

Recommended structure:

```html
<aside class="hidden lg:flex lg:w-[280px] lg:flex-col border-r border-slate-200 bg-white">
  <div class="flex h-16 items-center border-b border-slate-200 px-6">
    <span class="text-base font-semibold text-slate-900"> Railboard Admin </span>
  </div>

  <nav class="flex-1 space-y-1 p-4">
    <a class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900">
      Dashboard
    </a>

    <a class="flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900"> Routes </a>
  </nav>
</aside>
```

Active navigation state:

```html
bg-blue-50 text-blue-900 font-semibold
```

Default navigation state:

```html
text-slate-700 hover:bg-slate-100 hover:text-slate-900
```

Recommended admin navigation items:

- Dashboard
- Railway Networks
- Lines
- Routes
- Stations
- Import Data
- Validation
- Settings

## Tailwind Topbar Pattern

The topbar should adapt to screen size.

Recommended structure:

```html
<header class="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
  <div class="flex h-16 items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
    <div class="min-w-0">
      <h1 class="truncate text-lg md:text-xl font-semibold text-slate-900">Routes</h1>
      <p class="hidden sm:block text-xs text-slate-500">Last reload: 4 minutes ago</p>
    </div>

    <div class="flex items-center gap-2">
      <button
        class="hidden sm:inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        View board
      </button>

      <button class="inline-flex rounded-lg bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">Reload data</button>
    </div>
  </div>
</header>
```

On mobile, secondary actions may collapse into a menu.

## Component Style

### Buttons

Buttons should be direct and utilitarian.

Primary buttons are used for the main action on a screen.

Examples:

- Save changes
- Reload data
- Validate JSON
- Import data
- Create route

Recommended primary button:

```html
<button
  class="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 disabled:cursor-not-allowed disabled:opacity-50"
>
  Reload data
</button>
```

Recommended secondary button:

```html
<button
  class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-900/20 disabled:cursor-not-allowed disabled:opacity-50"
>
  View board
</button>
```

Recommended danger button:

```html
<button
  class="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600/20 disabled:cursor-not-allowed disabled:opacity-50"
>
  Delete route
</button>
```

Button styling rules:

- Use `rounded-lg`.
- Use clear labels.
- Use optional icons only when they improve scanning.
- Avoid decorative gradients.
- Provide visible focus states.
- Disabled states must be visually clear.

### Tailwind Cards

Use responsive card layouts.

KPI grid:

```html
<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
  <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p class="text-sm font-medium text-slate-500">Stations</p>
    <p class="mt-2 text-2xl font-bold text-slate-900">1,248</p>
    <p class="mt-1 text-xs text-slate-500">86 updated recently</p>
  </section>
</div>
```

Cards should generally use:

```html
rounded-xl border border-slate-200 bg-white shadow-sm
```

Avoid:

```html
shadow-xl rounded-3xl bg-gradient-to-r
```

unless explicitly required.

Cards are used for:

- KPI summaries.
- Validation status.
- Import summaries.
- Settings groups.
- Route metadata.
- Station metadata.

A card should never look like a marketing feature block.

### Tailwind Tables

Tables are the core admin component.

On desktop and tablet, use real tables.

```html
<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-slate-200">
      <thead class="bg-slate-50">
        <tr>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Line</th>
        </tr>
      </thead>

      <tbody class="divide-y divide-slate-200 bg-white">
        <tr class="hover:bg-slate-50">
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-900">C1</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

Use:

```html
overflow-x-auto min-w-full whitespace-nowrap
```

for wide railway data tables.

On mobile, tables may remain horizontally scrollable, or become cards for complex screens.

Recommended mobile card alternative:

```html
<div class="grid grid-cols-1 gap-3 md:hidden">
  <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-slate-900">C1 · València Nord → Gandia</p>
        <p class="mt-1 text-xs text-slate-500">10 stations · outbound</p>
      </div>

      <span class="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700"> Valid </span>
    </div>
  </article>
</div>
```

Tables should support:

- Search.
- Filtering.
- Sorting when useful.
- Pagination.
- Row actions.
- Empty states.
- Loading states.
- Status badges.

### Tailwind Forms

Forms should use responsive grids.

Basic form layout:

```html
<form class="space-y-6">
  <section class="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div class="space-y-1.5">
        <label class="block text-sm font-medium text-slate-700"> Station name </label>

        <input
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
        />
      </div>
    </div>
  </section>

  <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
    <button class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
      Cancel
    </button>

    <button class="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Save changes</button>
  </div>
</form>
```

Use this pattern for most admin forms:

```html
grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4
```

Use single-column forms for dangerous, focused, or confirmation-based actions.

Forms should:

- Use visible labels above fields.
- Show inline validation errors.
- Use helper text for technical fields.
- Group fields into logical sections.
- Keep primary actions visible and predictable.

### Tailwind Badges

Use compact Tailwind badges.

Success:

```html
<span class="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700"> Valid </span>
```

Warning:

```html
<span class="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"> Warning </span>
```

Error:

```html
<span class="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700"> Error </span>
```

Info:

```html
<span class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"> Info </span>
```

Line code badge:

```html
<span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-bold text-white" style="background-color: #2563EB"> C1 </span>
```

Line badges may use inline style only when the color comes from railway data.

Badges must include text. Do not use color-only dots as the only status indicator.

### Modals

Use modals for:

- Delete confirmations.
- Import confirmation.
- Quick edit actions.
- Validation details.

Modals should be focused and short.

Destructive modals must explain consequences clearly.

Example:

```text
Delete route?

This route will be removed from the admin data model. This action cannot be undone.
```

Recommended modal container:

```html
<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
  <section class="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
    <!-- Modal content -->
  </section>
</div>
```

### Empty States

Empty states should explain what is missing and what to do next.

Example:

```text
No routes have been created yet.

Create a route manually or import railway data from JSON.
```

Recommended actions:

```text
[Create route] [Import JSON]
```

Do not use playful empty-state illustrations unless they are extremely subtle.

### Loading States

Use skeleton rows for tables and skeleton cards for dashboards.

Use blocking loaders only for critical operations, such as:

- Importing JSON.
- Overwriting railway data.
- Running full validation.
- Reloading the entire dataset.

Recommended skeleton style:

```html
<div class="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
  <div class="h-4 w-32 rounded bg-slate-200"></div>
  <div class="mt-4 h-8 w-20 rounded bg-slate-200"></div>
</div>
```

## Screen Patterns

### Dashboard

The dashboard provides a global overview of admin data health.

It should include KPI cards for:

- Railway networks.
- Lines.
- Routes.
- Stations.
- Validation issues.
- Last reload.

Recommended KPI grid:

```html
<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
  <!-- KPI cards -->
</div>
```

It should also include:

- Recent import result.
- Data health summary.
- Critical validation issues.
- Quick actions.

Quick actions:

- Reload railway data.
- Import JSON.
- Run validation.
- View routes.
- View stations.

### Railway Networks

A railway network represents an operational railway system.

Examples:

- Cercanías Madrid
- Cercanías Valencia
- Cercanías Alicante-Murcia
- Cercanías Málaga
- Cercanías Cádiz
- Rodalies Catalunya
- Renfe Cercanías Bilbao
- Renfe Cercanías Asturias
- Renfe Cercanías Galicia

The networks screen should use a table with:

- Name
- Code
- Operator
- Region
- Lines
- Stations
- Status
- Actions

### Lines

A line belongs to one railway network.

Examples:

- C1
- C2
- C3
- C4
- R1
- R2
- R3

The lines screen should use a table with:

- Code
- Name
- Network
- Color
- Routes
- Stations
- Status
- Actions

Each line should display a compact color preview.

Example:

```text
[C1] València Nord - Gandia
```

### Routes

A route is an ordered journey for a line.

The routes screen should use a table with:

- Line
- Origin
- Destination
- Direction
- Stations
- Validation status
- Actions

A route may represent:

- Outbound direction.
- Inbound direction.
- Variant route.
- Short service route.

Route names should be clear and operational.

Example:

```text
C1 · València Nord → Gandia
```

### Route Detail

The route detail screen is one of the most important admin screens.

It should show:

- Route metadata.
- Line information.
- Origin.
- Destination.
- Direction.
- Station count.
- Validation status.
- Ordered station list.

### Tailwind Route Station Editor

The route station editor should be responsive.

Desktop layout:

```html
<div class="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
  <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
    <!-- Ordered station list -->
  </section>

  <aside class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <!-- Route metadata / validation summary -->
  </aside>
</div>
```

Station rows:

```html
<div class="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50">
  <span class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600"> 1 </span>

  <div class="min-w-0 flex-1">
    <p class="truncate text-sm font-medium text-slate-900">València Nord</p>
    <p class="truncate text-xs text-slate-500">VALN · València</p>
  </div>

  <div class="flex items-center gap-1">
    <!-- Move / remove actions -->
  </div>
</div>
```

The ordered station list should allow:

- Move up.
- Move down.
- Remove station.
- Add station.
- Detect duplicates.
- Detect missing station metadata.

Drag and drop may be supported, but it must not be the only way to reorder stations.

Example station order:

```text
1. València Nord
2. Alfafar-Benetússer
3. Massanassa
4. Catarroja
5. Silla
6. Sueca
7. Cullera
8. Tavernes de la Valldigna
9. Xeraco
10. Gandia
```

Each station row should show:

- Position.
- Station name.
- Station code.
- Municipality.
- Validation badge.
- Actions.

Mobile behavior:

- Metadata appears above the station list.
- Row actions may collapse into a menu.
- Station names should truncate safely.
- Drag and drop must not be the only way to reorder stations.

### Stations

The stations screen should use a table with:

- Name
- Code
- Municipality
- Province
- Networks
- Lines
- Coordinates
- Status
- Actions

Station detail should show:

- Basic station data.
- Related routes.
- Related lines.
- Coordinates if available.
- Validation status.

A small map preview is allowed but optional.

### Import Data

The import screen manages JSON-based data reloads.

The flow should be:

```text
Select JSON
Validate structure
Show summary
Confirm import
Reload data
Show result
```

The screen should make the risk of overwriting data clear.

Recommended import statuses:

- Pending
- Validating
- Valid
- Valid with warnings
- Invalid
- Imported
- Failed

Primary actions:

- Validate JSON
- Import data
- Reload railway data
- Cancel import
- Download errors

After import, show a structured summary:

```text
Import completed

Networks created: 4
Lines created: 18
Routes created: 36
Stations created: 412
Stations updated: 86
Warnings: 3
Errors: 0
```

### Validation

The validation screen detects consistency problems.

Minimum validation rules:

- Every line must belong to a network.
- Every route must belong to a line.
- Every route must have at least two stations.
- Every station referenced by a route must exist.
- Routes should not contain duplicated stations.
- Every line should define a color.
- Every network must define a name and code.
- Every station must define a name.
- Coordinates must be valid when present.
- Return routes should exist when applicable.
- IDs must be unique.

Validation table columns:

- Severity
- Entity
- Code
- Message
- Recommended action

Severity examples:

```text
Error
Warning
Info
```

Example validation rows:

```text
Error · Route · valencia-c1-gandia-valencia · The route does not define a destination station.
Warning · Line · madrid-c4 · The line does not define a color.
Info · Station · alzira · The station does not define coordinates.
```

## Responsive Screen Behavior

### Dashboard

Use:

```html
grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4
```

The dashboard should show one column on mobile, two columns on tablet, and four columns on large screens.

### Lists and Tables

For simple lists, use a table from `md` upwards:

```html
hidden md:block
```

Use a mobile card list below `md`:

```html
md:hidden
```

For data-heavy railway tables, horizontal scrolling is acceptable:

```html
overflow-x-auto
```

### Forms

Use:

```html
grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4
```

For narrow or critical forms, use:

```html
max-w-2xl
```

### Detail Screens

Use:

```html
grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6
```

Main content comes first on mobile. Secondary metadata panels move below or above depending on the task.

### Action Bars

Use stacked actions on mobile:

```html
flex flex-col-reverse gap-2 sm:flex-row sm:justify-end
```

Use inline actions on desktop:

```html
flex items-center justify-end gap-2
```

## Interaction Design

Interactions should be fast, predictable, and explicit.

Use:

- Clear hover states.
- Clear focus states.
- Inline validation.
- Toasts for successful non-critical actions.
- Dialogs for destructive or global actions.
- Confirmation before data overwrite.
- Copy buttons for technical IDs.

Avoid:

- Hidden critical actions.
- Ambiguous icon-only buttons.
- Auto-saving destructive changes.
- Unexpected animations.
- Excessive modal nesting.

## Motion

Motion should be minimal and functional.

Use motion for:

- Drawer open/close.
- Modal entry.
- Toast appearance.
- Row expansion.
- Loading transitions.

Recommended Tailwind usage:

```html
transition duration-150 ease-out hover:bg-slate-50
```

Avoid bouncy animations.

## Accessibility

Railboard Admin must be accessible enough for daily operational use.

Requirements:

- Visible focus states.
- Keyboard navigation.
- Sufficient contrast.
- Labels for all inputs.
- `aria-label` for icon-only actions.
- Status labels that do not rely only on color.
- Clear error messages.
- Confirmation for destructive actions.

Validation errors should describe the problem and suggest the next action.

Bad:

```text
Invalid data.
```

Good:

```text
Route C1 references station ID "xativa-old", but that station does not exist.
```

## Responsive Behavior

Desktop is the primary target.

Tablet should be fully usable.

Mobile should be supported for basic review actions, but not necessarily optimized for heavy data editing.

Desktop:

- Persistent sidebar.
- Full-width tables.
- Multi-column forms when useful.
- Route editor with full metadata.

Tablet:

- Collapsible sidebar.
- Tables remain available.
- Forms may become narrower.

Mobile:

- Sidebar becomes drawer.
- Tables may become stacked cards.
- Row actions collapse into menus.
- Forms use a single column.

## Voice and Microcopy

The tone should be:

- Technical.
- Clear.
- Direct.
- Operational.
- Calm.

Use precise language.

Prefer:

```text
Route imported successfully.
```

Avoid:

```text
Awesome! Your route is ready to roll.
```

Prefer:

```text
This route contains duplicated stations.
```

Avoid:

```text
Something looks weird here.
```

Prefer:

```text
The JSON could not be imported because route C1 contains a station ID that does not exist.
```

Avoid:

```text
Something went wrong.
```

## First Version Scope

The first version of the Railboard Admin should include:

- Dashboard.
- Railway networks table.
- Lines table.
- Routes table.
- Stations table.
- Route detail screen.
- Ordered station editor.
- JSON import screen.
- Validation screen.
- Reload railway data button.
- Loading states.
- Empty states.
- Error states.
- Success states.

## Future Scope

Possible future features:

- Station map editor.
- Visual railway network graph.
- JSON version comparison.
- Import history.
- User management.
- Roles and permissions.
- Public board preview.
- Train simulation preview.
- Railway module and layout templates.
- GTFS import.
- Public API import.
- JSON export.
- CSV export.

## Tailwind Implementation Rules

When implementing Railboard Admin:

- Use Tailwind utility classes as the default styling method.
- Use responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`.
- Do not hardcode raw CSS spacing unless necessary.
- Do not use raw `rem` values in component implementation guidance.
- Prefer `bg-slate-50`, `bg-white`, `text-slate-900`, `text-slate-700`, `text-slate-500`, `border-slate-200`.
- Use `rounded-lg` for controls.
- Use `rounded-xl` for cards and panels.
- Use `shadow-sm` sparingly.
- Use `overflow-x-auto` for large tables.
- Use `min-w-0` in flex/grid children that contain long names or IDs.
- Use `truncate` for long station names, route names, and technical IDs.
- Use responsive grids instead of fixed-width layouts.
- Keep desktop admin workflows efficient.
- Keep mobile usable, but do not compromise desktop data density.
- Apply this Tailwind guidance only to the Railboard Admin.
- Do not apply it to the public Railboard board, simulator, station display, or passenger-facing UI.

## Implementation Notes for AI Coding Agents

Use this DESIGN.md only for the Railboard Admin.

Do not apply this design system to the public Railboard display or simulator.

When generating UI:

- Prefer clean dashboard layouts.
- Use tables for data management.
- Use cards for summaries.
- Use precise validation messages.
- Keep actions explicit.
- Keep forms structured.
- Keep railway concepts visible but not decorative.
- Prioritize clarity over visual novelty.
- Use Tailwind utility classes and responsive prefixes.
- Avoid raw CSS values unless strictly necessary.
- Avoid `rem`-based implementation guidance.
- Preserve the existing Railboard data model unless a change is explicitly requested.

Do not invent a playful train-themed interface.

Do not redesign the public Railboard UI.

Do not replace the data model unless specifically requested.

If the current admin already has components, improve them according to this design language instead of replacing everything unnecessarily.
