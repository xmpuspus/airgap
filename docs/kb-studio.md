# KB Studio Lite

`scripts/kb-studio.js` is an interactive command-line walk-through that
takes an operator from a CSV of KB entries to a populated industry
knowledge base, then chains into the journey runner so they can see
their answers behave end-to-end.

It uses the same parser and validator that `kb-validate` and `kb-import`
use, so anything that flies through the studio also flies through the
existing CI checks.

## When to use it

Reach for this when:

- You want to add or refresh KB content without writing JSON by hand.
- You are onboarding a non-engineer to the KB authoring loop.
- You want a fast feedback loop: "did this query land on the right
  doc?" without booting the mobile app.

If you only need to validate an existing KB directory, run
`npm run kb:validate` instead. If you have a clean CSV and want a
non-interactive import, use `npm run kb:import path/to/file.csv`.

## CSV format

The studio expects a CSV with these columns (case-insensitive header):

```
id,category,title,content,keywords,tags
```

`keywords` and `tags` are semicolon-delimited so a single CSV cell can
hold a list (`plan;data;promo`). Quoted fields can contain commas and
newlines.

## Walk-through

```
$ npm run kb:studio
KB Studio Lite

== 1. Pick a CSV ==
Path to CSV (relative to repo root or absolute): tmp/new-plans.csv
Parsed 14 rows; skipped 0.

== 2. Validate ==
All rows pass schema validation.

== 3. Preview MiniSearch hits ==
Try a query (blank to skip): cheapest plan
  [plan] Super Surf 99  (score 4.21)
  [plan] AllNet 30      (score 3.84)
  [promo] Friend Bundle (score 1.20)
Try a query (blank to skip):

== 4. Export to industry KB ==
Available industries:
  1. airline
  2. banking
  3. electric-utility
  4. healthcare
  5. insurance
  6. telco
  7. water-utility
  8. <custom path>
Choose [1-8]: 6
examples/telco/knowledge is not empty. Overwrite? [y/N] y
Wrote 4 file(s) to examples/telco/knowledge.

== 5. Run journey suite ==
Run the industry journey suite? [Y/n] y
[PASS] telco: 10/10 (118 KB entries)
...
```

Each step is independent and resumable. If the journey suite fails,
your KB is still on disk and you can inspect `examples/<industry>/knowledge/*.json`
directly.

## Reset

If you overwrote a vertical's KB and want to roll back, the recordings
in git let you:

```
git checkout -- examples/<industry>/knowledge
```

## Programmatic use

The shared parser, validator, and exporter live at `scripts/lib/kb.js`.
Other tooling can import them directly:

```js
const {
  csvToDocs,
  validateDocs,
  splitByCategory,
  exportToDir,
} = require('./scripts/lib/kb');
```
