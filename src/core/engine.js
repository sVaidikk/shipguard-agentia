import crypto from 'node:crypto';
import path from 'node:path';
import { ALL_RULES } from './rules.js';
import { collectFiles, changedSince } from './scan.js';
import { loadContext } from './context.js';
import { loadPolicy } from './policy.js';

const WEIGHT = { block: 40, warn: 10 };

export function evaluate(files, ctx, policy) {
  const findings = ALL_RULES.flatMap((rule) => rule(files, ctx, policy));
  const blocks = findings.filter((f) => f.severity === 'block').length;
  const warns = findings.filter((f) => f.severity === 'warn').length;
  const decision = blocks > 0 ? 'BLOCK' : warns > 0 ? 'WARN' : 'PASS';
  const riskLevel = decision === 'BLOCK' ? 'High' : decision === 'WARN' ? 'Medium' : 'Low';
  const score = Math.min(100, blocks * WEIGHT.block + warns * WEIGHT.warn);
  return { decision, riskLevel, score, counts: { block: blocks, warn: warns }, findings };
}

export function hashFiles(files) {
  const h = crypto.createHash('sha256');
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) h.update(f.path).update('\0').update(f.content).update('\0');
  return h.digest('hex').slice(0, 16);
}

/** High-level entry used by the CLI, the MCP server and the tests. */
export function runCheck({ root = '.', base, userStory, coverage, policyDir, detectBranch = false } = {}) {
  const abs = path.resolve(root);
  // Policy lookup order: explicit dir > scanned folder > current working directory > built-in defaults.
  let loaded = loadPolicy(policyDir ?? abs);
  if (!policyDir && loaded.source === 'built-in defaults') loaded = loadPolicy(process.cwd());
  const { policy, source } = loaded;
  const onlyPaths = base ? changedSince(abs, base) : undefined;
  const files = collectFiles(abs, { onlyPaths });
  const ctx = loadContext(abs, { userStory, coverage }, { detectBranch });
  const result = evaluate(files, ctx, policy);
  return { root: abs, policySource: source, filesScanned: files.length, hash: hashFiles(files), context: ctx, ...result };
}
