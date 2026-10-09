#!/usr/bin/env node
import {browserRuntime, run} from './public-browser-runtime.mjs';

const runtime = browserRuntime();
run(process.execPath, ['scripts/build-public-service.mjs', '--check']);
run(process.execPath, ['web/data/build.mjs']);
run(runtime.python, ['-B', 'scripts/public-browser.py'], runtime.env);
