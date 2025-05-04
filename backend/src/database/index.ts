import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import { promisify } from 'util';

// Create a single database instance
const sqliteDb = new sqlite3.Database(process.env.DB_FILENAME || ':memory:');

// Promisify database methods with proper typing
const dbRun = (sql: string, params?: any[]) => new Promise<void>((resolve, reject) => {
  sqliteDb.run(sql, params, (err) => {
    if (err) reject(err);
    else resolve();
  });
});

const dbGet = (sql: string, params?: any[]) => new Promise<any>((resolve, reject) => {
  sqliteDb.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const dbAll = (sql: string, params?: any[]) => new Promise<any[]>((resolve, reject) => {
  sqliteDb.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

// Initialize database
const initDb = async () => {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      isAdmin INTEGER DEFAULT 0,
      isApproved INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // Create initial admin user if not exists
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const existingAdmin = await dbGet('SELECT * FROM users WHERE email = ?', [adminEmail]);
    if (!existingAdmin) {
      await dbRun(
        `INSERT INTO users (id, name, email, isAdmin, isApproved, createdAt, updatedAt)
         VALUES (?, ?, ?, 1, 1, ?, ?)`,
        [
          'admin',
          'Admin User',
          adminEmail,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );
    }
  }
};

initDb().catch(console.error);

export const db = {
  run: dbRun,
  get: dbGet,
  all: dbAll
}; 