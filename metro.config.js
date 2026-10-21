// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are plain .sql files bundled as strings.
config.resolver.sourceExts.push('sql');

// expo-sqlite on web: load its WebAssembly build, and allow SharedArrayBuffer (needed for its
// synchronous API) by isolating the page with COOP/COEP headers in the dev server.
config.resolver.assetExts.push('wasm');
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
