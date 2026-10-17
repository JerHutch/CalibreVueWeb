import fs from 'fs';
import path from 'path';

const MAX_LISTED_ENTRIES = 20;

function describeStat(label: string, target: string): string {
  try {
    const stat = fs.statSync(target);
    const mode = (stat.mode & 0o777).toString(8).padStart(3, '0');
    const kind = stat.isDirectory() ? 'directory' : 'file';
    return `${label} ${target}: ${kind}, mode ${mode}, owner ${stat.uid}:${stat.gid}`;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code || 'unknown error';
    return `${label} ${target}: not accessible (${code})`;
  }
}

function describeListing(dir: string): string {
  try {
    const entries = fs.readdirSync(dir);
    const shown = entries.slice(0, MAX_LISTED_ENTRIES).join(', ');
    const extra = entries.length > MAX_LISTED_ENTRIES ? `, ... (${entries.length} total)` : '';
    return `Contents of ${dir}: ${shown || '(empty)'}${extra}`;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code || 'unknown error';
    return `Contents of ${dir}: cannot list (${code})`;
  }
}

export function describePath(filePath: string): string[] {
  const dir = path.dirname(filePath);
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'n/a';
  const gid = typeof process.getgid === 'function' ? process.getgid() : 'n/a';
  return [
    `Process user ${uid}:${gid}`,
    describeStat('Directory', dir),
    describeStat('File', filePath),
    describeListing(dir)
  ];
}
