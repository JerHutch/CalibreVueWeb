import fs from 'fs';
import path from 'path';
import type { LogDestination } from './logger';
import { deleteExpiredLogs, logDateKey, logFileName } from './logRetention';

const DEFAULT_RETENTION_DAYS = 30;
// After a failure, wait this long before trying to open a file again, and
// print at most one console error per period.
export const RETRY_COOLDOWN_MS = 60 * 1000;

// fs.mkdirSync({ recursive: true }) can spin forever on unwritable pseudo
// filesystems such as /proc, so create parents one level at a time.
function ensureDir(dir: string): void {
  try {
    fs.mkdirSync(dir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') return;
    const parent = path.dirname(dir);
    if (code !== 'ENOENT' || parent === dir) throw error;
    ensureDir(parent);
    fs.mkdirSync(dir);
  }
}

export interface RollingFileOptions {
  dir: string;
  retentionDays: number;
  now?: () => Date;
}

export class RollingFileDestination implements LogDestination {
  private readonly dir: string;
  private readonly retentionDays: number;
  private readonly now: () => Date;
  private stream: fs.WriteStream | null = null;
  private currentKey: string | null = null;
  // The file opened for currentKey, set only once its directory is usable.
  private currentPath: string | null = null;
  // Set while file logging is failing: when it failed and on which local day.
  private failedAt: number | null = null;
  private failedKey: string | null = null;
  private reportedAt: number | null = null;
  private closing = new Set<Promise<void>>();

  constructor(options: RollingFileOptions) {
    this.dir = options.dir;
    this.retentionDays = Number.isFinite(options.retentionDays) && options.retentionDays > 0
      ? options.retentionDays
      : DEFAULT_RETENTION_DAYS;
    this.now = options.now ?? (() => new Date());
    try {
      this.open(this.now());
    } catch (error) {
      this.fail(error);
    }
  }

  log(line: string): void {
    try {
      const now = this.now();
      const key = logDateKey(now);
      if (this.failedAt !== null) {
        // Lines in the cooldown are not buffered; the console still has them.
        if (key === this.failedKey && !this.elapsed(this.failedAt, now)) return;
        // A same-day retry reuses the failed file instead of adding a new one.
        this.open(now, key === this.failedKey ? this.currentPath : null);
      } else if (key !== this.currentKey) {
        this.closeStream();
        this.open(now);
      } else if (!this.stream) {
        // Reopen after flush().
        this.open(now);
      }
      this.stream?.write(line + '\n');
    } catch (error) {
      this.fail(error);
    }
  }

  async flush(): Promise<void> {
    this.closeStream();
    await Promise.all([...this.closing]);
  }

  private open(now: Date, reusePath: string | null = null): void {
    const key = logDateKey(now);
    this.currentKey = key;
    this.currentPath = null;
    this.failedAt = null;
    this.failedKey = null;
    ensureDir(this.dir);
    deleteExpiredLogs(this.dir, this.retentionDays, now);
    const filePath = reusePath ?? path.join(this.dir, logFileName(now));
    this.currentPath = filePath;
    const stream = fs.createWriteStream(filePath, { flags: 'a' });
    stream.on('error', (error) => {
      if (this.stream === stream) {
        this.markFailed(key);
      }
      stream.destroy();
      this.report(error);
    });
    this.stream = stream;
  }

  private closeStream(): void {
    const stream = this.stream;
    this.stream = null;
    if (!stream || stream.destroyed) return;
    const done = new Promise<void>((resolve) => {
      stream.once('close', () => resolve());
      stream.end();
    }).finally(() => this.closing.delete(done));
    this.closing.add(done);
  }

  private fail(error: unknown): void {
    this.markFailed(this.currentKey);
    this.report(error);
  }

  private markFailed(key: string | null): void {
    this.stream = null;
    this.failedKey = key;
    this.failedAt = this.safeNow();
  }

  private elapsed(since: number, now: Date): boolean {
    const diff = now.getTime() - since;
    // A clock that went back counts as elapsed rather than blocking for long.
    return diff >= RETRY_COOLDOWN_MS || diff < 0;
  }

  private safeNow(): number {
    try {
      return this.now().getTime();
    } catch {
      return Date.now();
    }
  }

  private report(error: unknown): void {
    try {
      const now = this.safeNow();
      if (this.reportedAt !== null && !this.elapsed(this.reportedAt, new Date(now))) return;
      this.reportedAt = now;
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(`ERROR: Unable to write logs to ${this.dir}: ${message}`);
    } catch {
      // Logging must never throw.
    }
  }
}
