const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,  // lazy-load modules — faster startup
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
