import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import migrations from '../../drizzle/migrations';
import * as schema from './schema';
import { migrateDatabase } from './migrate';

export const DATABASE_NAME = 'finance.db';

export type AppDatabase = ExpoSQLiteDatabase<typeof schema>;

let sqlite: SQLiteDatabase | null = null;
let database: AppDatabase | null = null;
let opening: Promise<AppDatabase> | null = null;

/**
 * Opens the on-device database and brings its schema up to date. Called once at startup; the
 * async open also warms up the web worker so the synchronous queries that follow are fast.
 * Change events are on so live queries refresh after every write.
 */
export function openDatabase(): Promise<AppDatabase> {
  opening ??= (async () => {
    const connection = await openDatabaseAsync(DATABASE_NAME, { enableChangeListener: true });
    try {
      await connection.execAsync('PRAGMA foreign_keys = ON;');
      await migrateDatabase(connection, migrations);
      const db = drizzle(connection, { schema });
      sqlite = connection;
      database = db;
      return db;
    } catch (error) {
      await connection.closeAsync().catch(() => {});
      throw error;
    }
  })();
  opening.catch(() => {
    opening = null;
  });
  return opening;
}

/** The open database. Screens only render after `openDatabase()` resolved, so this is safe there. */
export function getDb(): AppDatabase {
  if (!database) throw new Error('The database is not open yet.');
  return database;
}

export function getSqlite(): SQLiteDatabase {
  if (!sqlite) throw new Error('The database is not open yet.');
  return sqlite;
}
