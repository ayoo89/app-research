const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration — pure React Native (no Expo)
 * https://reactnative.dev/docs/metro
 */
const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    // Explicitly block expo from being resolved if it sneaks into node_modules
    blockList: [/node_modules\/expo\/.*/],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
