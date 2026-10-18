import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { RollingFileDestination } from '../../src/utils/rollingFileDestination';
import { logFileName } from '../../src/utils/logRetention';

describe('RollingFileDestination', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rolling-log-'));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates the directory, first file and runs cleanup', async () => {
    const logDir = path.join(dir, 'nested', 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const stale = logFileName(new Date(2026, 7, 1, 0, 0, 0));
    fs.writeFileSync(path.join(logDir, stale), 'x');
    const now = new Date(2026, 9, 18, 14, 30, 5);
    const dest = new RollingFileDestination({ dir: logDir, retentionDays: 30, now: () => now });
    await dest.flush();
    expect(fs.existsSync(path.join(logDir, logFileName(now)))).toBe(true);
    expect(fs.existsSync(path.join(logDir, stale))).toBe(false);
  });

  it('appends lines with newline and shares a file between instances', async () => {
    const now = new Date(2026, 9, 18, 14, 30, 5);
    const a = new RollingFileDestination({ dir, retentionDays: 30, now: () => now });
    a.log('one');
    await a.flush();
    const b = new RollingFileDestination({ dir, retentionDays: 30, now: () => now });
    b.log('two');
    await b.flush();
    const content = fs.readFileSync(path.join(dir, logFileName(now)), 'utf8');
    expect(content).toBe('one\ntwo\n');
  });

  it('rolls to a new file when the local date changes', async () => {
    let now = new Date(2026, 9, 18, 23, 59, 58);
    const dest = new RollingFileDestination({ dir, retentionDays: 30, now: () => now });
    dest.log('before');
    now = new Date(2026, 9, 19, 0, 0, 3);
    dest.log('after');
    await dest.flush();
    expect(fs.readFileSync(path.join(dir, logFileName(new Date(2026, 9, 18, 23, 59, 58))), 'utf8')).toBe('before\n');
    expect(fs.readFileSync(path.join(dir, logFileName(now)), 'utf8')).toBe('after\n');
  });

  it('creates a missing nested directory and the first file', async () => {
    const nested = path.join(dir, 'a', 'b', 'c');
    const now = new Date(2026, 9, 18, 9, 0, 0);
    const dest = new RollingFileDestination({ dir: nested, retentionDays: 30, now: () => now });
    await dest.flush();
    expect(fs.statSync(nested).isDirectory()).toBe(true);
    expect(fs.existsSync(path.join(nested, logFileName(now)))).toBe(true);
  });

  it('reports once and stays silent when a path component is a regular file', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const blocker = path.join(dir, 'blocker');
    fs.writeFileSync(blocker, 'x');
    const now = new Date(2026, 9, 18, 9, 0, 0);
    let dest: RollingFileDestination | undefined;
    expect(() => {
      dest = new RollingFileDestination({ dir: path.join(blocker, 'logs'), retentionDays: 30, now: () => now });
    }).not.toThrow();
    expect(() => dest!.log('one')).not.toThrow();
    expect(() => dest!.log('two')).not.toThrow();
    await dest!.flush();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  describe('after a failure', () => {
    let blocker: string;
    let logDir: string;
    let spy: ReturnType<typeof vi.spyOn>;
    const block = () => {
      fs.rmSync(blocker, { recursive: true, force: true });
      fs.writeFileSync(blocker, 'x');
    };
    const unblock = () => {
      fs.rmSync(blocker, { recursive: true, force: true });
      fs.mkdirSync(blocker);
    };

    beforeEach(() => {
      spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      blocker = path.join(dir, 'blocker');
      logDir = path.join(blocker, 'logs');
      block();
    });

    it('does not retry within 60 seconds, then retries and writes later lines', async () => {
      const start = new Date(2026, 9, 18, 9, 0, 0);
      let now = start;
      const dest = new RollingFileDestination({ dir: logDir, retentionDays: 30, now: () => now });
      expect(spy).toHaveBeenCalledTimes(1);

      unblock();
      now = new Date(start.getTime() + 59999);
      dest.log('cooldown');
      await dest.flush();
      expect(fs.existsSync(logDir)).toBe(false);

      now = new Date(start.getTime() + 60000);
      dest.log('retried');
      dest.log('later');
      await dest.flush();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(fs.readFileSync(path.join(logDir, logFileName(now)), 'utf8')).toBe('retried\nlater\n');
    });

    it('reports a second failure after recovery', async () => {
      const start = new Date(2026, 9, 18, 9, 0, 0);
      let now = start;
      const dest = new RollingFileDestination({ dir: logDir, retentionDays: 30, now: () => now });
      unblock();
      now = new Date(start.getTime() + 61000);
      dest.log('recovered');
      await dest.flush();
      expect(fs.readFileSync(path.join(logDir, logFileName(now)), 'utf8')).toBe('recovered\n');

      block();
      now = new Date(start.getTime() + 62000);
      expect(() => dest.log('fails again')).not.toThrow();
      await dest.flush();
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('reports at most once per cooldown period while the problem persists', async () => {
      const start = new Date(2026, 9, 18, 9, 0, 0);
      let now = start;
      const dest = new RollingFileDestination({ dir: logDir, retentionDays: 30, now: () => now });
      for (const offset of [1000, 30000, 59000]) {
        now = new Date(start.getTime() + offset);
        dest.log('x');
      }
      expect(spy).toHaveBeenCalledTimes(1);

      now = new Date(start.getTime() + 61000);
      dest.log('retry fails');
      expect(spy).toHaveBeenCalledTimes(2);
      now = new Date(start.getTime() + 90000);
      dest.log('cooldown again');
      await dest.flush();
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('still retries on the next local day, even within the cooldown', async () => {
      let now = new Date(2026, 9, 18, 23, 59, 50);
      const dest = new RollingFileDestination({ dir: logDir, retentionDays: 30, now: () => now });
      expect(spy).toHaveBeenCalledTimes(1);

      unblock();
      now = new Date(2026, 9, 19, 0, 0, 5);
      dest.log('next day');
      await dest.flush();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(fs.readFileSync(path.join(logDir, logFileName(now)), 'utf8')).toBe('next day\n');
    });
  });

  it('never throws and reports once when the directory is unusable', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let dest: RollingFileDestination | undefined;
    expect(() => {
      dest = new RollingFileDestination({ dir: '/proc/nope', retentionDays: 30 });
    }).not.toThrow();
    expect(() => dest!.log('hello')).not.toThrow();
    expect(() => dest!.log('again')).not.toThrow();
    await expect(dest!.flush()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('flush resolves after pending writes are on disk', async () => {
    const now = new Date(2026, 9, 18, 10, 0, 0);
    const dest = new RollingFileDestination({ dir, retentionDays: 30, now: () => now });
    for (let i = 0; i < 200; i++) dest.log(`line ${i}`);
    await dest.flush();
    const lines = fs.readFileSync(path.join(dir, logFileName(now)), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(200);
  });

  it('falls back to 30 days for invalid retention', async () => {
    const now = new Date(2026, 9, 18, 10, 0, 0);
    const stale = logFileName(new Date(2026, 8, 1, 0, 0, 0));
    fs.writeFileSync(path.join(dir, stale), 'x');
    const dest = new RollingFileDestination({ dir, retentionDays: Number.NaN, now: () => now });
    await dest.flush();
    expect(fs.existsSync(path.join(dir, stale))).toBe(false);
  });
});
