module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  modulePathIgnorePatterns: [
    '<rootDir>/packages/create-airgap-bot/template/',
    '<rootDir>/.worktrees/',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '__tests__/run-',
    '<rootDir>/.claude/',
    '<rootDir>/.worktrees/',
    '__tests__/golden/',
  ],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/__tests__/**/*.test.js',
  ],
  setupFiles: ['<rootDir>/__tests__/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-mmkv|react-native-fs|react-native-get-random-values|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-nitro-modules|minisearch|llama.rn)/)',
  ],
};
