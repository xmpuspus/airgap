#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {root} from './public-service.mjs';
import {
  browserRuntime,
  mediaRuntime,
  requireCommittedCaptureSource,
  run,
} from './public-browser-runtime.mjs';
import {syncPublicSiteAssets} from './public-site-assets.mjs';
requireCommittedCaptureSource();
const flag = process.argv.indexOf('--model');
const model = flag >= 0 ? process.argv[flag + 1] : process.env.PUBLIC_MODEL_PATH;
if (!model || !fs.existsSync(model))
  throw new Error(
    'Supply --model /path/to/local-gemma-3.gguf. The kit never downloads a model or calls a paid API.',
  );
if (!fs.existsSync(path.join(root, 'node_modules/typescript/lib/typescript.js')))
  run('npm', ['ci', '--cache', 'tmp/public-showcase/npm-cache']);
mediaRuntime();
const runtime = browserRuntime();
run(process.execPath, ['scripts/public-service.mjs', 'replay', '--json']);
run(process.execPath, ['scripts/public-experiment.mjs', '--model', model]);
run(process.execPath, ['scripts/build-public-service.mjs']);
run(runtime.python, ['-B', 'scripts/public-browser.py', '--capture'], runtime.env);
syncPublicSiteAssets();
process.stdout.write(
  'Captured all five features. Inspect the screenshots and full loops before approving derived media.\n',
);
