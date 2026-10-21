import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import migrations from '../../drizzle/migrations';
import * as schema from './schema';

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
    await connection.execAsync('PRAGMA foreign_keys = ON;');
    const db = drizzle(connection, { schema });
    await migrate(db, migrations);
    sqlite = connection;
    database = db;
    return db;
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
