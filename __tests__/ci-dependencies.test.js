const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('installs FFmpeg before validating release recordings', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
  const install = workflow.indexOf('apt-get install --yes ffmpeg');
  const validation = workflow.indexOf('npm run recordings:validate');

  expect(install).toBeGreaterThan(-1);
  expect(validation).toBeGreaterThan(install);
});

test('declares the Ruby nkf compatibility gem that provides kconv', () => {
  const gemfile = fs.readFileSync(path.join(root, 'Gemfile'), 'utf8');

  expect(gemfile).toMatch(/^gem 'nkf'$/m);
  expect(gemfile).not.toMatch(/^gem 'kconv'$/m);
});
