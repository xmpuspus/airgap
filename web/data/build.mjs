#!/usr/bin/env node
// Assemble web/data/<vertical>.json for the static project site.
//
// Inputs:
//   examples/<vertical>/airgap.config.json
//   examples/<vertical>/knowledge/*.json
//   demo/industry-<vertical>.gif (referenced by path; not copied here,
//     deploy workflow places them into web/assets/gifs/ at deploy time)
//
// Output: web/data/<vertical>.json, a small JSON object the client app.js
// reads to render the brand block, theme swatches, condensed config
// snippet, and KB stats per vertical.
//
// CLI:
//   node web/data/build.mjs            # default repo root
//   node web/data/build.mjs --root DIR # for tests / fixtures

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const KNOWN_VERTICALS = [
  'airline',
  'banking',
  'electric-utility',
  'healthcare',
  'insurance',
  'telco',
  'water-utility',
];

// telco demo GIFs are filed as industry-telco.gif, etc. The slug used in
// the demo/ folder collapses the `electric-utility` -> `electric` and
// `water-utility` -> `water` because that's how the existing recordings
// are named. Keep this mapping in lockstep with that fact.
const GIF_SLUGS = {
  airline: 'airline',
  banking: 'banking',
  'electric-utility': 'electric',
  healthcare: 'healthcare',
  insurance: 'insurance',
  telco: 'telco',
  'water-utility': 'water',
};

function parseArgs(argv) {
  const out = {root: null};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') {
      out.root = argv[i + 1];
      i++;
    }
  }
  return out;
}

function defaultRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function summarizeKnowledge(kbDir) {
  const out = {totalDocs: 0, categories: {}};
  if (!fs.existsSync(kbDir)) return out;
  const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const docs = readJson(path.join(kbDir, file));
    if (!Array.isArray(docs)) continue;
    out.totalDocs += docs.length;
    const category = path.basename(file, '.json');
    out.categories[category] = docs.length;
  }
  return out;
}

function condenseConfig(cfg) {
  // Produces a small, human-readable JSON snippet for the project site.
  // Skips long fields like full prompts and KB content.
  return {
    brand: cfg.brand,
    theme: {
      primary: cfg.theme.primary,
      secondary: cfg.theme.secondary,
      background: cfg.theme.background,
    },
    locale: cfg.locale,
    llm: cfg.llm ?? {mode: 'prefer-offline'},
    quickReplies: (cfg.quickReplies ?? []).slice(0, 4),
    toolCount: (cfg.tools ?? []).length,
  };
}

function buildVertical(root, vertical) {
  const cfgPath = path.join(root, 'examples', vertical, 'airgap.config.json');
  const cfg = readJson(cfgPath);
  const knowledge = summarizeKnowledge(path.join(root, 'examples', vertical, 'knowledge'));
  const slug = GIF_SLUGS[vertical] ?? vertical;
  return {
    vertical,
    label: cfg.brand?.name ?? vertical,
    botName: cfg.brand?.botName ?? '',
    tagline: cfg.brand?.tagline ?? '',
    theme: {
      primary: cfg.theme?.primary ?? '#0891B2',
      primaryDark: cfg.theme?.primaryDark ?? cfg.theme?.primary ?? '#0E7490',
      secondary: cfg.theme?.secondary ?? '#F97316',
      background: cfg.theme?.background ?? '#F8FAFC',
      surface: cfg.theme?.surface ?? '#FFFFFF',
      text: cfg.theme?.text ?? '#0F172A',
      botBubble: cfg.theme?.botBubble ?? '#F1F5F9',
      userBubble: cfg.theme?.userBubble ?? cfg.theme?.primary ?? '#0E7490',
    },
    locale: cfg.locale ?? {currency: 'PHP', region: 'PH'},
    knowledge,
    config: condenseConfig(cfg),
    gif: `assets/gifs/industry-${slug}.gif`,
  };
}

function copyGifs(root) {
  const srcDir = path.join(root, 'demo');
  const destDir = path.join(root, 'web', 'assets', 'gifs');
  fs.mkdirSync(destDir, {recursive: true});
  let copied = 0;
  for (const vertical of KNOWN_VERTICALS) {
    const slug = GIF_SLUGS[vertical];
    const src = path.join(srcDir, `industry-${slug}.gif`);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(destDir, `industry-${slug}.gif`);
    fs.copyFileSync(src, dest);
    copied += 1;
  }
  const primary = path.join(srcDir, 'airgap-demo.gif');
  if (fs.existsSync(primary)) {
    fs.copyFileSync(primary, path.join(destDir, 'airgap-demo.gif'));
  }
  return copied;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root ? path.resolve(args.root) : defaultRoot();
  const outDir = path.join(root, 'web', 'data');
  fs.mkdirSync(outDir, {recursive: true});

  const packageJson = readJson(path.join(root, 'package.json'));
  const manifest = {release: packageJson.version, verticals: []};
  for (const vertical of KNOWN_VERTICALS) {
    const data = buildVertical(root, vertical);
    fs.writeFileSync(path.join(outDir, `${vertical}.json`), JSON.stringify(data, null, 2) + '\n');
    manifest.verticals.push({
      vertical,
      label: data.label,
      tagline: data.tagline,
      primary: data.theme.primary,
      kbDocs: data.knowledge.totalDocs,
    });
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const copiedGifs = copyGifs(root);
  // eslint-disable-next-line no-console
  console.log(
    `[web] wrote ${KNOWN_VERTICALS.length} vertical files + manifest to ${outDir}; copied ${copiedGifs} GIFs to assets/gifs/`,
  );
}

main();
