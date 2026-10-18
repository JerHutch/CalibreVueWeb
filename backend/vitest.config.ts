import { defineConfig } from 'vitest/config';
import fs from 'fs';
import os from 'os';
import path from 'path';

const testLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calibre-test-logs-'));
process.on('exit', () => {
  try {
    fs.rmSync(testLogDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup.
  }
});

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: { LOG_DIR: testLogDir },
    include: ['tests/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['tests/**/*.test.ts']
    }
  }
});
