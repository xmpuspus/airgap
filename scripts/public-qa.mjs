#!/usr/bin/env node
import {browserRuntime, run} from './public-browser-runtime.mjs';

const runtime = browserRuntime();
run(process.execPath, ['scripts/build-public-service.mjs', '--check']);
run(runtime.python, ['-B', 'scripts/public-browser.py'], runtime.env);
