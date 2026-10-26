// Expo serves public/index.html before Metro's enhanceMiddleware sees `/`.
// Add isolation headers at the HTTP response layer in the web dev process.
const http = require('node:http');

const originalWriteHead = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function writeHeadWithIsolation(...args) {
  if (!this.headersSent) {
    this.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    this.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  }
  return originalWriteHead.apply(this, args);
};
