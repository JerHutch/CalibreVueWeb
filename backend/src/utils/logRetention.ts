import fs from 'fs';
import path from 'path';

export const LOG_FILE_PATTERN = /^app-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})\.log$/;

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function logDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function logFileName(date: Date): string {
  const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `app-${logDateKey(date)}T${time}.log`;
}

function parseLogFileTime(name: string): number | null {
  const match = LOG_FILE_PATTERN.exec(name);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const time = new Date(year, month - 1, day, hour, minute, second).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Deletes generated log files older than the retention window. Only names
 * matching LOG_FILE_PATTERN that are regular files are removed. Returns the
 * deleted names. Never throws.
 */
export function deleteExpiredLogs(dir: string, retentionDays: number, now: Date = new Date()): string[] {
  const deleted: string[] = [];
  try {
    const cutoff = now.getTime() - retentionDays * DAY_MS;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const time = parseLogFileTime(entry.name);
      if (time === null || time >= cutoff) continue;
      try {
        fs.unlinkSync(path.join(dir, entry.name));
        deleted.push(entry.name);
      } catch {
        // Skip files that cannot be removed.
      }
    }
  } catch {
    // Missing or unreadable directory: nothing to clean.
  }
  return deleted;
}
