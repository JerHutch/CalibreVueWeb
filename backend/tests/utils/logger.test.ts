import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { Logger } from '../../src/utils/logger';

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

    expect(fs.readFileSync(file, 'utf8')).toBe('ERROR: boom\n');
  });
});
