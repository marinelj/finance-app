import { loadConfig } from './config.js';
import { createPool, migrate } from './db.js';

const pool = createPool(loadConfig().db);
try {
  await migrate(pool, console.log);
  console.log('Database is up to date.');
} finally {
  await pool.end();
}
