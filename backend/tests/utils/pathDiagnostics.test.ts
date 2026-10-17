import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { describePath } from '../../src/utils/pathDiagnostics';

describe('describePath', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-diagnostics-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('reports a missing directory', () => {
    const lines = describePath(path.join(tempDir, 'missing', 'metadata.db'));

    expect(lines.join('\n')).toContain('not accessible (ENOENT)');
    expect(lines.join('\n')).toContain('cannot list (ENOENT)');
  });

  it('reports an existing file and lists its directory', () => {
    const file = path.join(tempDir, 'metadata.db');
    fs.writeFileSync(file, '');

    const output = describePath(file).join('\n');

    expect(output).toContain(`File ${file}: file`);
    expect(output).toContain(`Directory ${tempDir}: directory`);
    expect(output).toContain('metadata.db');
  });
});
