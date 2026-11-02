import { createServer } from 'node:http';

import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool, migrate } from './db.js';

const config = loadConfig();
const pool = createPool(config.db);
await migrate(pool, (message) => console.log(message));

const server = createServer(createApp({ pool, config }));
server.requestTimeout = 60_000;
server.listen(config.port, config.host, () => {
  console.log(`Finance API listening on http://${config.host}:${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => void pool.end().then(() => process.exit(0)));
  });
}
