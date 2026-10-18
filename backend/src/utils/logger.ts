import path from 'path';
import { redactText, redactValue } from './redact';
import { getContext } from './requestContext';
import { RollingFileDestination } from './rollingFileDestination';

export interface LogDestination {
  log: (message: string) => void;
  flush?: () => Promise<void>;
}

class ConsoleDestination implements LogDestination {
  log(message: string) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  event?: string;
  userId?: string;
  sessionId?: string;
  details?: Record<string, unknown>;
}

export interface LogEntry {
  ts: string;
  level: LogLevel;
  source: 'backend' | 'browser';
  sessionId?: string;
  userId?: string;
  event: string;
  message: string;
  details?: Record<string, unknown>;
}

export class Logger {
  private destinations: LogDestination[] = [];
  constructor(destinations: LogDestination[] = []) {
    this.destinations = destinations;
  }
  addDestination(dest: LogDestination) {
    this.destinations.push(dest);
  }
  info(message: string, fields?: LogFields) {
    this.writeLevel('info', message, fields);
  }
  warn(message: string, fields?: LogFields) {
    this.writeLevel('warn', message, fields);
  }
  error(message: string, fields?: LogFields) {
    this.writeLevel('error', message, fields);
  }
  write(entry: Omit<LogEntry, 'ts'> & { ts?: string }) {
    try {
      this.emit(this.serialize(entry));
    } catch (error) {
      reportFailure(error);
    }
  }
  async flush() {
    await Promise.all(this.destinations.map(dest => dest.flush?.()));
  }

  private writeLevel(level: LogLevel, message: string, fields: LogFields = {}) {
    try {
      const ctx = getContext();
      this.write({
        level,
        source: 'backend',
        sessionId: fields.sessionId ?? ctx?.sessionId,
        userId: fields.userId ?? ctx?.userId,
        event: fields.event ?? 'log',
        message,
        details: fields.details
      });
    } catch (error) {
      reportFailure(error);
    }
  }

  private serialize(entry: Omit<LogEntry, 'ts'> & { ts?: string }): string {
    const ordered: Record<string, unknown> = {
      ts: entry.ts ?? new Date().toISOString(),
      level: entry.level,
      source: entry.source
    };
    if (entry.sessionId) ordered.sessionId = entry.sessionId;
    if (entry.userId) ordered.userId = entry.userId;
    ordered.event = entry.event || 'log';
    ordered.message = redactText(String(entry.message));
    try {
      if (entry.details !== undefined) {
        ordered.details = redactValue(entry.details);
      }
      return JSON.stringify(ordered);
    } catch {
      // Unserializable details: fall back to a minimal line without them.
      ordered.details = { error: 'details could not be serialized' };
      return JSON.stringify(ordered);
    }
  }

  private emit(line: string) {
    for (const dest of this.destinations) {
      try {
        dest.log(line);
      } catch (error) {
        reportFailure(error);
      }
    }
  }
}

function reportFailure(error: unknown) {
  try {
    // eslint-disable-next-line no-console
    console.error(`Logger failure: ${error instanceof Error ? error.message : String(error)}`);
  } catch {
    // Logging must never throw.
  }
}

const retentionDays = Number.parseInt(process.env.LOG_RETENTION_DAYS ?? '', 10);
const logger = new Logger([
  new ConsoleDestination(),
  new RollingFileDestination({
    dir: process.env.LOG_DIR || path.join(process.cwd(), 'logs'),
    retentionDays
  })
]);

export default logger;
