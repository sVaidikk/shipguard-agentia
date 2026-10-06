import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const CONTEXT_FILE = 'shipguard-context.json';
const STORY_RE = /\b([A-Z]{2,10}-?\d{1,6})\b/i;

export function detectStoryFromBranch(dir) {
  try {
    const r = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, encoding: 'utf8' });
    if (r.status !== 0) return undefined;
    const m = r.stdout.trim().match(STORY_RE);
    return m ? m[1].toUpperCase() : undefined;
  } catch {
    return undefined;
  }
}

// Priority: explicit options > shipguard-context.json > git branch name.
export function loadContext(root, options = {}, { detectBranch = false } = {}) {
  let fromFile = {};
  const p = path.join(root, CONTEXT_FILE);
  if (fs.existsSync(p)) {
    try { fromFile = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* ignore bad file */ }
  }
  const ctx = {
    userStory: options.userStory ?? fromFile.userStory ?? process.env.SHIPGUARD_USER_STORY,
    coverage: options.coverage !== undefined ? Number(options.coverage) : fromFile.coverage,
  };
  if (!ctx.userStory && detectBranch) ctx.userStory = detectStoryFromBranch(root);
  return ctx;
}
