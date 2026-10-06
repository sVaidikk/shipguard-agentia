import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SKIP_DIRS = new Set(['node_modules', '.git', '.shipguard', '.sfdx', '.sf']);
const TEXT_EXT = new Set(['.cls', '.trigger', '.xml', '.json', '.js', '.ts', '.yml', '.yaml', '.html', '.cmp', '.page', '.component', '.properties', '.env', '.txt', '.md']);
const MAX_BYTES = 1024 * 1024;

export function collectFiles(root, { onlyPaths } = {}) {
  const out = [];
  const only = onlyPaths ? new Set(onlyPaths.map((p) => path.normalize(p))) : null;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
        continue;
      }
      const rel = path.relative(root, full);
      if (only && !only.has(path.normalize(rel))) continue;
      if (!TEXT_EXT.has(path.extname(entry.name).toLowerCase()) && !entry.name.startsWith('.env')) continue;
      if (fs.statSync(full).size > MAX_BYTES) continue;
      out.push({ path: rel.split(path.sep).join('/'), content: fs.readFileSync(full, 'utf8') });
    }
  };
  walk(root);
  return out;
}

// Files changed since a git ref (used by --base).
export function changedSince(root, ref) {
  const r = spawnSync('git', ['diff', '--name-only', ref], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git diff failed: ${r.stderr.trim()}`);
  return r.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
}
