import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCheck } from '../src/index.js';
import { writeAudit, readAudit, reportMarkdown } from '../src/core/audit.js';
import { ruleBasedExplain } from '../src/core/explain.js';
import { run } from '../src/cli.js';

test('bad sample is BLOCKED with all rule families', () => {
  const r = runCheck({ root: 'samples/bad-change', policyDir: '.' });
  assert.equal(r.decision, 'BLOCK');
  const rules = new Set(r.findings.map((f) => f.rule));
  for (const x of ['hardcoded_secrets', 'destructive_changes', 'permission_escalation', 'missing_user_story', 'test_coverage_min']) {
    assert.ok(rules.has(x), `expected rule ${x}`);
  }
});

test('good sample PASSES', () => {
  const r = runCheck({ root: 'samples/good-change', policyDir: '.' });
  assert.equal(r.decision, 'PASS');
  assert.equal(r.findings.length, 0);
});

test('hash is stable across runs', () => {
  const a = runCheck({ root: 'samples/good-change', policyDir: '.' });
  const b = runCheck({ root: 'samples/good-change', policyDir: '.' });
  assert.equal(a.hash, b.hash);
});

test('audit log round-trips and report renders', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-'));
  const r = runCheck({ root: 'samples/bad-change', policyDir: '.' });
  writeAudit(r, { dir });
  const entries = readAudit(dir);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].decision, 'BLOCK');
  assert.match(reportMarkdown(entries), /BLOCK: \*\*1\*\*/);
});

test('explain mentions fixes for blocked change', () => {
  const r = runCheck({ root: 'samples/bad-change', policyDir: '.' });
  const t = ruleBasedExplain(r);
  assert.match(t, /BLOCK/);
  assert.match(t, /Named Credential/);
});

test('CLI: check returns 1 on bad, 0 on good', async () => {
  const lines = [];
  const io = { out: (s) => lines.push(s), err: (s) => lines.push(s) };
  assert.equal(await run(['check', 'samples/bad-change', '--no-audit'], io), 1);
  assert.equal(await run(['check', 'samples/good-change', '--no-audit'], io), 0);
});

test('CLI: gate does not run the command when blocked', async () => {
  const lines = [];
  const io = { out: (s) => lines.push(s), err: (s) => lines.push(s) };
  const code = await run(['gate', 'samples/bad-change', '--', 'node', '-e', 'process.exit(0)'], io);
  assert.equal(code, 1);
  assert.ok(lines.some((l) => /Command NOT executed/.test(l)));
});

test('CLI: gate requires approval for production', async () => {
  const io = { out: () => {}, err: () => {} };
  assert.equal(await run(['gate', 'samples/good-change', '--target', 'PROD', '--', 'node', '-e', '0'], io), 1);
  assert.equal(await run(['gate', 'samples/good-change', '--target', 'PROD', '--approved', '--', 'node', '-e', '0'], io), 0);
});
