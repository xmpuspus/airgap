module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    'node_modules/',
    'android/',
    'ios/',
    'models/',
    '.dev-fixtures/',
    'server/telemetry.jsonl',
    'server/.keys/',
    '__tests__/llm-journey-results.json',
  ],
  rules: {
    // Project-specific overrides. Keep this list short — prefer fixing the
    // underlying code instead of disabling rules.
    '@typescript-eslint/no-require-imports': 'off',
    'react-native/no-inline-styles': 'off',
  },
};
