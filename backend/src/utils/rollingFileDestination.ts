import fs from 'fs';
import path from 'path';
import type { LogDestination } from './logger';
import { deleteExpiredLogs, logDateKey, logFileName } from './logRetention';

const DEFAULT_RETENTION_DAYS = 30;

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
  private failedKey: string | null = null;
  private reported = false;
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
      if (key !== this.currentKey && key !== this.failedKey) {
        this.closeStream();
        this.open(now);
      } else if (!this.stream && key !== this.failedKey) {
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

  private open(now: Date): void {
    const key = logDateKey(now);
    this.currentKey = key;
    this.failedKey = null;
    ensureDir(this.dir);
    deleteExpiredLogs(this.dir, this.retentionDays, now);
    const filePath = path.join(this.dir, logFileName(now));
    const stream = fs.createWriteStream(filePath, { flags: 'a' });
    stream.on('error', (error) => {
      if (this.stream === stream) {
        this.stream = null;
        this.failedKey = key;
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
    this.stream = null;
    this.failedKey = this.currentKey;
    this.report(error);
  }

  private report(error: unknown): void {
    if (this.reported) return;
    this.reported = true;
    try {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(`ERROR: Unable to write logs to ${this.dir}: ${message}`);
    } catch {
      // Logging must never throw.
    }
  }
}
