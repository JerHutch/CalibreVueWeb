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
});
