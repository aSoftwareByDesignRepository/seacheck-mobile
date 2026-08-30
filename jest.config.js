module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // Timers that outlive tests are a bug — do not paper over with forceExit.
  // Download map linger/teardown delays are zeroed under NODE_ENV=test.
  forceExit: false,
  // Opt-in diagnostics: SEACHECK_DETECT_OPEN_HANDLES=1 npm test
  detectOpenHandles: process.env.SEACHECK_DETECT_OPEN_HANDLES === '1',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@shopify/flash-list)',
  ],
};
