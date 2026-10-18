import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../../src/utils/logger';
import { runWithContext } from '../../src/utils/requestContext';

function capture() {
  const lines: string[] = [];
  const logger = new Logger([{ log: (line) => lines.push(line) }]);
  return { lines, logger };
}

describe('Logger.flush', () => {
  const dirs: string[] = [];

  afterEach(() => {
    dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  });

  it('resolves only after queued messages are written to the destination', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-'));
    dirs.push(dir);
    const file = path.join(dir, 'app.log');
    const written: string[] = [];
    const stream = fs.createWriteStream(file, { flags: 'a' });
    const logger = new Logger([
      {
        log: (message) => {
          written.push(message);
          stream.write(message + '\n');
        },
        flush: () => new Promise((resolve) => stream.end(resolve))
      }
    ]);

    logger.error('boom');
    await logger.flush();

    const entry = JSON.parse(fs.readFileSync(file, 'utf8').trim());
    expect(entry).toMatchObject({ level: 'error', source: 'backend', event: 'log', message: 'boom' });
  });
});

describe('Logger JSON entries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes info as one JSON line with defaults', () => {
    const { lines, logger } = capture();
    logger.info('hi');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({ level: 'info', source: 'backend', event: 'log', message: 'hi' });
    expect(new Date(entry.ts).toISOString()).toBe(entry.ts);
    expect(entry).not.toHaveProperty('sessionId');
    expect(entry).not.toHaveProperty('userId');
    expect(entry).not.toHaveProperty('details');
  });

  it('supports warn and error with event and details', () => {
    const { lines, logger } = capture();
    logger.warn('careful');
    logger.error('x', { event: 'auth.google.outcome', details: { status: 'error' } });
    expect(JSON.parse(lines[0]).level).toBe('warn');
    expect(JSON.parse(lines[1])).toMatchObject({
      level: 'error',
      event: 'auth.google.outcome',
      details: { status: 'error' }
    });
  });

  it('orders keys ts, level, source, sessionId, userId, event, message, details', () => {
    const { lines, logger } = capture();
    logger.info('m', { sessionId: 'sess-12345', userId: 'u1', details: { a: 1 } });
    expect(Object.keys(JSON.parse(lines[0]))).toEqual([
      'ts', 'level', 'source', 'sessionId', 'userId', 'event', 'message', 'details'
    ]);
  });

  it('includes request context and lets explicit fields override it', () => {
    const { lines, logger } = capture();
    runWithContext({ sessionId: 'ctx-session-1', userId: 'ctx-user' }, () => {
      logger.info('a');
      logger.info('b', { userId: 'explicit' });
    });
    expect(JSON.parse(lines[0])).toMatchObject({ sessionId: 'ctx-session-1', userId: 'ctx-user' });
    expect(JSON.parse(lines[1])).toMatchObject({ sessionId: 'ctx-session-1', userId: 'explicit' });
  });

  it('write keeps browser source and supplied ts', () => {
    const { lines, logger } = capture();
    logger.write({
      ts: '2026-01-02T03:04:05.000Z',
      level: 'warn',
      source: 'browser',
      event: 'ui.click',
      message: 'm'
    });
    expect(JSON.parse(lines[0])).toMatchObject({
      ts: '2026-01-02T03:04:05.000Z',
      source: 'browser',
      level: 'warn',
      event: 'ui.click'
    });
  });

  it('falls back to info for an unknown level', () => {
    const { lines, logger } = capture();
    logger.write({ level: 'debug\n{"x":1}' as any, source: 'backend', event: 'a.b', message: 'm' });
    expect(JSON.parse(lines[0]).level).toBe('info');
  });

  it('falls back to backend for an unknown source', () => {
    const { lines, logger } = capture();
    logger.write({ level: 'warn', source: 'admin' as any, event: 'a.b', message: 'm' });
    expect(JSON.parse(lines[0])).toMatchObject({ level: 'warn', source: 'backend' });
  });

  it('replaces an event that is not a short safe name with log', () => {
    const { lines, logger } = capture();
    logger.info('a', { event: 'auth.google.start' });
    logger.info('b', { event: 'Bearer abc.def token=x' });
    logger.info('c', { event: 'e'.repeat(65) });
    logger.info('d', { event: 'a@b.com' });
    logger.write({ level: 'info', source: 'backend', event: 5 as any, message: 'e' });
    expect(lines.map((line) => JSON.parse(line).event)).toEqual([
      'auth.google.start', 'log', 'log', 'log', 'log'
    ]);
  });

  it('omits a session id that is not valid', () => {
    const { lines, logger } = capture();
    logger.info('a', { sessionId: 'valid-session-1' });
    logger.info('b', { sessionId: 'Bearer eyJabc.def.ghi' });
    logger.info('c', { sessionId: 'short' });
    logger.write({ level: 'info', source: 'backend', sessionId: { a: 1 } as any, event: 'x', message: 'd' });
    expect(JSON.parse(lines[0]).sessionId).toBe('valid-session-1');
    for (const line of lines.slice(1)) {
      expect(JSON.parse(line)).not.toHaveProperty('sessionId');
    }
  });

  it('redacts and caps the user id', () => {
    const { lines, logger } = capture();
    logger.info('a', { userId: '42' });
    logger.info('b', { userId: 'reader@example.com' });
    logger.info('c', { userId: 'u'.repeat(100) });
    logger.write({ level: 'info', source: 'backend', userId: 7 as any, event: 'x', message: 'd' });
    const ids = lines.map((line) => JSON.parse(line).userId);
    expect(ids[0]).toBe('42');
    expect(ids[1]).toBe('[email]');
    expect(ids[2]).toHaveLength(64);
    expect(ids[3]).toBe('7');
  });

  it('keeps newlines inside a single line', () => {
    const { lines, logger } = capture();
    logger.info('a\nb');
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('\n');
    expect(JSON.parse(lines[0]).message).toBe('a\nb');
  });

  it('redacts message and details', () => {
    const { lines, logger } = capture();
    logger.info('token ?code=abc', { details: { authorization: 'x', n: 1 } });
    const entry = JSON.parse(lines[0]);
    expect(entry.message).not.toContain('abc');
    expect(entry.details.authorization).not.toBe('x');
    expect(entry.details.n).toBe(1);
  });

  it('never throws when a destination fails', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const good: string[] = [];
    const logger = new Logger([
      { log: () => { throw new Error('disk full'); } },
      { log: (line) => good.push(line) }
    ]);
    expect(() => logger.info('hi')).not.toThrow();
    expect(good).toHaveLength(1);
    expect(errSpy).toHaveBeenCalled();
  });

  it('never throws on unserializable details', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { lines, logger } = capture();
    const details: Record<string, unknown> = { big: BigInt(1) };
    details.self = details;
    expect(() => logger.info('hi', { details })).not.toThrow();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).message).toBe('hi');
  });
});
