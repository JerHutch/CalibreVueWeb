import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LOG_FILE_PATTERN, logFileName, deleteExpiredLogs } from '../../src/utils/logRetention';

describe('logRetention', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-retention-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('formats local file names', () => {
    expect(logFileName(new Date(2026, 9, 18, 14, 30, 5))).toBe('app-2026-10-18T14-30-05.log');
  });

  it('matches only generated names', () => {
    expect(LOG_FILE_PATTERN.test('app-2026-10-18T14-30-05.log')).toBe(true);
    expect(LOG_FILE_PATTERN.test('app.log')).toBe(false);
    expect(LOG_FILE_PATTERN.test('notes.txt')).toBe(false);
  });

  it('deletes expired matching files only', () => {
    const now = new Date(2026, 9, 18, 12, 0, 0);
    const old = logFileName(new Date(2026, 8, 17, 12, 0, 0));
    const recent = logFileName(new Date(2026, 8, 19, 12, 0, 0));
    fs.writeFileSync(path.join(dir, old), 'x');
    fs.writeFileSync(path.join(dir, recent), 'x');
    fs.writeFileSync(path.join(dir, 'app.log'), 'x');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
    fs.mkdirSync(path.join(dir, logFileName(new Date(2020, 0, 1, 0, 0, 0))));

    const deleted = deleteExpiredLogs(dir, 30, now);

    expect(deleted).toEqual([old]);
    expect(fs.existsSync(path.join(dir, old))).toBe(false);
    expect(fs.existsSync(path.join(dir, recent))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'app.log'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'notes.txt'))).toBe(true);
    expect(fs.statSync(path.join(dir, logFileName(new Date(2020, 0, 1, 0, 0, 0)))).isDirectory()).toBe(true);
  });

  it('returns an empty list for a missing directory', () => {
    expect(deleteExpiredLogs(path.join(dir, 'missing'), 30)).toEqual([]);
  });
});
