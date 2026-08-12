const config = require('../jest.config');

test('excludes nested worktrees from Jest discovery', () => {
  expect(config.modulePathIgnorePatterns).toContain('<rootDir>/.worktrees/');
  expect(config.testPathIgnorePatterns).toContain('<rootDir>/.worktrees/');
});
