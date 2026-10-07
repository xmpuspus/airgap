const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const escaped = path.resolve(__dirname, 'tmp').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Recording takes write screenshots and video under tmp/. A watched write there
 * makes Metro send an update and the app paints a "Refreshing..." banner into
 * the footage, so the watcher ignores that directory.
 *
 * Setting blockList replaces Metro's default list, which blocks __tests__/
 * folders, so that pattern is listed again here.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: [new RegExp(`${escaped}[/\\\\].*`), /[/\\]__tests__[/\\].*/],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
