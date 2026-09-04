import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Minimal .env loader for standalone scripts. Real environment variables
 * always win: the file only fills keys that are still undefined, mirroring
 * the behavior the Prisma client applies when it auto-loads .env.
 */
export async function loadDotEnv(path = resolve(process.cwd(), '.env')): Promise<void> {
  if (!existsSync(path)) return;
  const lines = (await readFile(path, 'utf8')).split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }
}
