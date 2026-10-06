import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const AUDIT_DIR = '.shipguard';
export const AUDIT_FILE = 'audit.jsonl';

export function auditPath(dir = process.cwd()) {
  return path.join(dir, AUDIT_DIR, AUDIT_FILE);
}

export function writeAudit(result, { dir = process.cwd(), action = 'check', extra = {} } = {}) {
  const p = auditPath(dir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const entry = {
    ts: new Date().toISOString(),
    user: process.env.USER || process.env.USERNAME || os.userInfo().username,
    action,
    target: path.relative(dir, result.root) || '.',
    decision: result.decision,
    score: result.score,
    hash: result.hash,
    filesScanned: result.filesScanned,
    findings: result.findings.map((f) => ({ rule: f.rule, severity: f.severity, file: f.file, line: f.line })),
    ...extra,
  };
  fs.appendFileSync(p, JSON.stringify(entry) + '\n');
  return entry;
}

export function readAudit(dir = process.cwd()) {
  const p = auditPath(dir);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

export function reportMarkdown(entries) {
  const total = entries.length;
  const by = (d) => entries.filter((e) => e.decision === d).length;
  const lines = [
    '# ShipGuard audit report',
    '',
    `Total checks: **${total}** | PASS: **${by('PASS')}** | WARN: **${by('WARN')}** | BLOCK: **${by('BLOCK')}**`,
    '',
    '| Time (UTC) | User | Action | Target | Decision | Risk | Findings |',
    '|---|---|---|---|---|---|---|',
    ...entries.map((e) => `| ${e.ts} | ${e.user} | ${e.action} | ${e.target} | ${e.decision} | ${e.score} | ${e.findings.length} |`),
  ];
  return lines.join('\n');
}
