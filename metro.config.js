const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const exclusionList = require('metro-config/private/defaults/exclusionList').default;

const escaped = path.resolve(__dirname, 'tmp').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Recording takes write screenshots and video under tmp/. A watched write there
 * makes Metro send an update and the app paints a "Refreshing..." banner into
 * the footage, so the watcher ignores that directory.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: exclusionList([new RegExp(`${escaped}/.*`)]),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
