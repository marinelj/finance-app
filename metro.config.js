// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are plain .sql files bundled as strings.
config.resolver.sourceExts.push('sql');

// expo-sqlite on web: load its WebAssembly build, and allow SharedArrayBuffer (needed for its
// synchronous API) by isolating the page with COOP/COEP headers in the dev server.
config.resolver.assetExts.push('wasm');

// The Expo dev server answers the HTML page itself, before `server.enhanceMiddleware` runs, so
// headers set there never reach the page and the browser build fails with "SharedArrayBuffer
// is not defined". Setting them on every response the dev server writes covers the page too.
// This file is only loaded by the bundler and dev server, never by the app.
const http = require('http');
if (!http.ServerResponse.prototype.__crossOriginIsolated) {
  const writeHead = http.ServerResponse.prototype.writeHead;
  http.ServerResponse.prototype.writeHead = function (...args) {
    if (!this.headersSent) {
      this.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      this.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    }
    return writeHead.apply(this, args);
  };
  http.ServerResponse.prototype.__crossOriginIsolated = true;
}

module.exports = config;
