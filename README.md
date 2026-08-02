# lapaie

Free, open-source pay stub generator for small Quebec employers.

Static web app — no server, no dependencies, no sign-up.
Data stays in your browser.

## Features

- Automatic statutory deduction calculations (QPP, EI, QPIP, federal tax, provincial tax)
- Employer contributions (QPP, EI, QPIP, HSF, CNESST)
- Year-to-date cumulative totals with automatic caps
- Printable pay stubs compliant with CNESST requirements
- Multiple employees, multiple pay periods
- Manual override of any computed field
- Detailed explanation of each calculation with links to official sources
- JSON export/import for backup and portability
- Works offline once loaded

## Usage

Open `2026/index.html` in a browser. That's it.

No installation, no `npm install`, no build step.

## Structure

```
2026/               ← self-contained directory for the 2026 tax year
  index.html        ← UI (HTML + CSS)
  qc.js             ← computation module (constants, formulas, YTD)
  app.js            ← UI logic (DOM, localStorage, events)
  qc-stub.html      ← printed stub template
  tests.js          ← automated tests + sample data
img/                ← flags (shared across years)
DOMAIN.md           ← domain documentation and architecture decisions
QC.md               ← Quebec payroll glossary and legal field requirements
```

Each year is a frozen, self-contained directory.
No code is shared between years — an archive never breaks.

## Computation module

`qc.js` is a reference implementation usable outside the web app:

- Pure functions, no DOM, no dependencies
- Compatible with embedded JS engines (Goja, QuickJS)
- Each function returns `{ resultat, etapes }` — fully serializable
- French variable names and step descriptions matching official publications

## Tests

Open the app in a browser and click "Exécuter les tests" at the bottom of the page.
Results display in an alert.

Or via Node:

```sh
node -e "
global.window = {};
var fn = new Function(require('fs').readFileSync('2026/qc.js','utf8') + '; return QC;');
global.QC = fn();
eval(require('fs').readFileSync('2026/tests.js','utf8'));
var r = window.runTests();
process.exit(r.failed > 0 ? 1 : 0);
"
```

## License

MIT
