#!/usr/bin/env node
import {
  browserRuntime,
  mediaRuntime,
  requireCommittedCaptureSource,
  run,
} from './public-browser-runtime.mjs';
import {syncPublicSiteAssets} from './public-site-assets.mjs';

// Explicit asset creation only. Acceptance QA never calls this command.
requireCommittedCaptureSource();
mediaRuntime();
run(process.execPath, ['scripts/build-public-service.mjs', '--check']);
const runtime = browserRuntime();
run(runtime.python, ['-B', 'scripts/public-browser.py', '--capture'], runtime.env);
syncPublicSiteAssets();
