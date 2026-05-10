import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { initializeAppSchema } from '../appSchema';

describe('initializeAppSchema', () => {
  it('creates users table with approval fields', () => {
    const db = new Database(':memory:');

    initializeAppSchema(db);

    const columns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    expect(columns.map(column => column.name)).toEqual(expect.arrayContaining([
      'id',
      'username',
      'email',
      'google_id',
      'display_name',
      'picture',
      'is_admin',
      'status',
      'created_at',
      'updated_at'
    ]));
  });

  it('is safe to run more than once', () => {
    const db = new Database(':memory:');

    initializeAppSchema(db);
    initializeAppSchema(db);

    const result = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
    expect(result).toEqual({ name: 'users' });
  });

  it('adds missing columns and indexes to an existing partial users table', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL
      );
    `);

    initializeAppSchema(db);

    const columns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    expect(columns.map(column => column.name)).toEqual(expect.arrayContaining([
      'id',
      'username',
      'email',
      'google_id',
      'display_name',
      'picture',
      'is_admin',
      'status',
      'created_at',
      'updated_at'
    ]));

    const indexes = db.prepare('PRAGMA index_list(users)').all() as Array<{ name: string }>;
    expect(indexes.map(index => index.name)).toEqual(expect.arrayContaining([
      'idx_users_email',
      'idx_users_google_id',
      'idx_users_status'
    ]));

    db.prepare('INSERT INTO users (username, email) VALUES (?, ?)').run('existing', 'existing@example.com');
    const row = db.prepare('SELECT is_admin, status FROM users WHERE email = ?').get('existing@example.com');
    expect(row).toEqual({ is_admin: 0, status: 'pending' });
  });
});
