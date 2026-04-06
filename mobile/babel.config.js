module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Reanimated must be last
    'react-native-reanimated/plugin',
  ],
  env: {
    production: {
      plugins: [
        // Strip console.log/debug/info in production builds
        'transform-remove-console',
      ],
    },
  },
};
