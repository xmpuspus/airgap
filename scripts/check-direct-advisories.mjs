import {spawnSync} from 'node:child_process';

const result = spawnSync('npm', ['audit', '--json'], {
  cwd: process.cwd(),
  encoding: 'utf8',
});

if (!result.stdout) {
  process.stderr.write(result.stderr || 'npm audit returned no JSON\n');
  process.exit(1);
}

const report = JSON.parse(result.stdout);
const blocking = [];
const upstream = [];

for (const advisory of Object.values(report.vulnerabilities ?? {})) {
  if (!advisory.isDirect || !['high', 'critical'].includes(advisory.severity)) {
    continue;
  }
  const directFindings = advisory.via.filter(
    item =>
      typeof item === 'object' && item !== null && ['high', 'critical'].includes(item.severity),
  );
  if (directFindings.length > 0) {
    blocking.push({name: advisory.name, severity: advisory.severity});
  } else {
    upstream.push({
      name: advisory.name,
      severity: advisory.severity,
      chain: advisory.via.filter(item => typeof item === 'string').join(', '),
    });
  }
}

for (const item of upstream) {
  process.stdout.write(`[upstream] ${item.name}: ${item.severity} through ${item.chain}\n`);
}

if (blocking.length > 0) {
  for (const item of blocking) {
    process.stderr.write(`[blocked] ${item.name}: ${item.severity}\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `No direct high or critical advisory applies to a direct package's own code. ` +
    `${upstream.length} inherited chain(s) remain listed above.\n`,
);
