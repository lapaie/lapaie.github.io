# Domain

Pay rules, deductions, employer contributions, and wording guidelines are in [QC.md](QC.md).

## Product

A free, static web app (GitHub Pages) that lets Quebec employers produce valid pay stubs.

## Constraints

- Static site only. No backend. Deploy artifact is a self-contained directory per year.
- No build step. Source is the deployed artifact.
- No external runtime dependencies. No npm packages. No CDN imports.
- Flag images in `/img/` are shared across years (they don't change).
- French only.
- 2026 rates only. No multi-year support at runtime.
- Each year is a frozen, self-contained directory. No shared code between years. Previous years never break because the current year changed.
- Versioning: `/2026/` = current year directory. Archived in place — never modified once the next year starts.
- v1: all field values entered manually. v2: statutory deductions auto-computed with manual override.
- Data fully importable/exportable (JSON).

## Layout

Single page, no tabs:
1. **Top**: employer name, pay period dates, payment date (shared by all employees).
2. **Below**: accordion list of employees. Click name to expand/collapse pay details.
3. **Per employee**: hours, gross pay, deductions, employer costs, extras (dynamic rows).
4. **Print button** per employee: renders clean employee-facing stub (one per page).
5. **Bottom**: export JSON, import JSON.

## Assumptions

- Target user is a small Quebec employer who currently has no tooling.
- v1: user knows their deduction amounts. v2: app computes all deductions (statutory + income tax).
- No authentication needed.
- No data stored server-side; browser localStorage + JSON export is sufficient.
- Open source. Computation code should be readable and verifiable by accountants, developers, or government employees checking against official publications.
- Minimal maintenance: no dependency upgrades, no breaking changes from upstream. A 2026 artifact should work unchanged in 2035.

## Decisions

- Employer and period are shared (top-level), not per-employee.
- Multiple employees supported. Stored in localStorage, exportable as JSON.
- Print layout: one stub per page per employee.
- YTD cumulative totals computed from all period slots ≤ current period number.
- Per-period storage: each employee has a `periods` object keyed by period number. Navigating between periods shows/edits that slot's data. No finalize step needed.
- Data model: employer fields top-level, employees array with identity fields at root and pay data nested in `periods[n]`.
- Dynamic line items: user adds/removes bonus, indemnity, and custom deduction rows freely. Types managed at employer level.
- Per-employee flags: "Assujetti à l'AE/RRQ/RQAP" (Oui/Non, default Oui). Covers family business (lien de dépendance) and other exclusions. RRQ could auto-detect from age in the future.
- Per-employee field: "Exemption de retenues d'impôt" (Non / Fédéral seulement / Provincial seulement / Les deux) + optional note field. When active, suppresses tax computation for that jurisdiction.
- Per-employee fields for tax claim amounts: federal (TD1) and provincial (TP-1015.3), dollar values, pre-filled with 2026 basic personal amounts. Editable for employees with custom claims.
- Computation approach: period-based (annualized formula from TP-1015.F), spread evenly across periods.
- Annual cap logic: each employer independently caps at maximum insurable earnings from their own payroll. No "cotisé ailleurs" field needed for RQAP/AE — overpayments are refunded via the employee's tax return (ref: Revenu Québec, "Total des cotisations payées").
- Date format: all dates displayed to the user use `yyyy-mm-dd`. Stored internally as `yyyy-mm-dd`.

### Architecture

- Source is multiple files in a flat directory. No build step — source = deployed artifact.
- Structure: `index.html` (UI shell + CSS), `qc.js` (reference module), `app.js` (UI logic/DOM/localStorage).
- `qc.js` is the reference module: constants, computation functions, YTD, and pay stub HTML rendering.
- `app.js` is the UI: DOM binding, localStorage, events, import/export.
- Computation module uses French variable names, comments, and step descriptions mirroring official Revenu Québec / CRA documentation.
- UI code uses English.
- Each program (RRQ, AE, RQAP, FSS, CNESST) has its own constants block and calculation function.
- Functions produce both a result value and an array of explanation steps (prose with inline source links).
- Reading the code is reading the explanation — steps are the logic.

### Computation Module Portability

Goal: the computation module is a reference implementation usable outside the SPA (future CLI, API, embedded engine).

Constraints:
- Pure functions. No DOM, no browser APIs, no `this`.
- No external dependencies.
- Inputs and outputs are plain objects, numbers, and strings. No classes.
- Functions return `{ resultat, etapes }` — fully serializable.
- Compatible with embedded JS engines (Goja, QuickJS) without modification.
- Single file (`qc.js`) loadable via `<script>` tag or directly by an embedded engine.

The SPA consumes this module directly. A future CLI/API in another repo can embed the same JS source.

### Behavior

- All deduction/contribution fields auto-computed by default.
- User can override any computed field (manual override with visual indicator).
- YTD tracking handles annual maximums (RRQ, AE, RQAP caps) based on cumulative gross paid by this employer.
- FSS and CNESST: per-employer rate fields stored at employer level, computation is rate × gross.
- RRQ: one line on stub; detail popover breaks down the two-tier calculation (base+supp1 and supp2).

### Detail Popover

- Each computed field has a clickable popover showing the computation steps.
- Steps are narrative prose in French, with inline links to official sources.
- Example: "Le RRQ est calculé à partir du salaire de base par période de paie. Il y a une exemption annuelle de 3 500 $ distribuée entre les 26 périodes..."

### Constants

- Grouped by program (RRQ, AE, RQAP, FSS, CNESST).
- Each group includes rates, exemptions, maximums, and source URLs.
