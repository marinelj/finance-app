/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // ESM-only packages (e.g. @noble/*) must be transformed by Babel too.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|@noble/.*)',
  ],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts?(x)'],
  collectCoverageFrom: ['src/domain/**/*.ts', 'src/lib/**/*.ts'],
};
