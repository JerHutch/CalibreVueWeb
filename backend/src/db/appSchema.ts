import Database from 'better-sqlite3';

const REQUIRED_USER_COLUMNS = [
  { name: 'google_id', definition: 'TEXT' },
  { name: 'display_name', definition: 'TEXT' },
  { name: 'picture', definition: 'TEXT' },
  { name: 'is_admin', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'status', definition: "TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied'))" },
  { name: 'created_at', definition: 'TEXT' },
  { name: 'updated_at', definition: 'TEXT' }
];

interface TableColumn {
  name: string;
}

export function initializeAppSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      google_id TEXT UNIQUE,
      display_name TEXT,
      picture TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureUserColumns(db);
  backfillUserTimestamps(db);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
  `);
}

function ensureUserColumns(db: Database.Database) {
  const columns = db.prepare('PRAGMA table_info(users)').all() as TableColumn[];
  const existingColumnNames = new Set(columns.map(column => column.name));

  for (const column of REQUIRED_USER_COLUMNS) {
    if (!existingColumnNames.has(column.name)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
}

function backfillUserTimestamps(db: Database.Database) {
  db.exec(`
    UPDATE users
    SET
      created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
      updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
    WHERE created_at IS NULL OR updated_at IS NULL;
  `);
}
