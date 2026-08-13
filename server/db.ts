import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { Database } from 'sql.js';

const DATA_DIR = path.join(process.cwd(), 'server-data');
const DB_PATH = path.join(DATA_DIR, 'avasurface.sqlite');

let db: Database | null = null;
let dbInit: Promise<Database> | null = null;

async function createDatabase(): Promise<Database> {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file)
  });

  const database = fs.existsSync(DB_PATH)
    ? new SQL.Database(new Uint8Array(fs.readFileSync(DB_PATH)))
    : new SQL.Database();

  database.run(`
    CREATE TABLE IF NOT EXISTS app_data (
      entity TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return database;
}

export async function getDatabase(): Promise<Database> {
  if (db) return db;
  if (!dbInit) dbInit = createDatabase();
  db = await dbInit;
  return db;
}

export async function persistDatabase(): Promise<void> {
  const database = await getDatabase();
  const bytes = database.export();
  fs.writeFileSync(DB_PATH, Buffer.from(bytes));
}

export async function getEntity<T>(entity: string, fallback: T): Promise<T> {
  const database = await getDatabase();
  const result = database.exec('SELECT payload FROM app_data WHERE entity = ?', [entity]);
  if (!result.length || !result[0].values.length) return fallback;
  return JSON.parse(String(result[0].values[0][0])) as T;
}

export async function saveEntity<T>(entity: string, value: T): Promise<void> {
  const database = await getDatabase();
  database.run(
    `INSERT INTO app_data(entity, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(entity) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    [entity, JSON.stringify(value), new Date().toISOString()]
  );
  await persistDatabase();
}
