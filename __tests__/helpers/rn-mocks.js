// Shared jest mock factories for React Native native modules. Tests that
// touch services pulling in react-native-fs, react-native-mmkv, or the
// connectivityService import these from the jest.mock factory:
//
//   jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
//   jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
//   jest.mock('../src/services/connectivityService', () =>
//     require('./helpers/rn-mocks').connectivity());
//
// Each factory returns a fresh module shape; mock state is per-test-file so
// stores never bleed across files.

function rnFs() {
  return {
    DocumentDirectoryPath: '/tmp/airgap-test',
    exists: jest.fn(async () => false),
    mkdir: jest.fn(async () => undefined),
    stat: jest.fn(async () => ({size: 0})),
    downloadFile: jest.fn(() => ({
      jobId: 1,
      promise: Promise.resolve({statusCode: 200}),
    })),
    hash: jest.fn(async () => 'x'),
    moveFile: jest.fn(async () => undefined),
    unlink: jest.fn(async () => undefined),
  };
}

function rnMmkv() {
  const store = new Map();
  return {
    createMMKV: () => ({
      set: (k, v) => store.set(k, v),
      getString: k => (store.has(k) ? String(store.get(k)) : undefined),
      getNumber: k => (store.has(k) ? Number(store.get(k)) : undefined),
      getBoolean: k => (store.has(k) ? Boolean(store.get(k)) : undefined),
      remove: k => store.delete(k),
      contains: k => store.has(k),
      clearAll: () => store.clear(),
    }),
  };
}

function connectivity() {
  return {
    connectivityService: {
      isOnline: jest.fn(() => false),
      addListener: jest.fn(() => () => {}),
    },
  };
}

module.exports = {rnFs, rnMmkv, connectivity};
