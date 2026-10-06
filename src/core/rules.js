// Each rule: (files, ctx, policy) => Finding[]
// files: [{ path, content }]   ctx: { userStory?, coverage? }
// Finding: { rule, severity, file?, line?, message }

const lineOf = (content, index) => content.slice(0, index).split('\n').length;
const redact = (s) => (s.length <= 4 ? '****' : `${s.slice(0, 4)}***`);

const SECRET_PATTERNS = [
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'Private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Salesforce session ID', re: /\b00D[0-9A-Za-z]{12,15}![A-Za-z0-9._]{20,}/g },
  {
    name: 'Hardcoded credential',
    re: /(?:api[_-]?key|secret|token|passw(?:or)?d|client[_-]?secret)\s*[=:]\s*['"]([^'"\s]{8,})['"]/gi,
    skip: (value) => /^(callout:|\$\{|\{!)/.test(value) || /^(changeme|your[_-])/i.test(value),
  },
];

export function hardcodedSecrets(files, _ctx, policy) {
  const severity = policy.rules.hardcoded_secrets;
  if (severity === 'off') return [];
  const findings = [];
  for (const f of files) {
    if (f.path.endsWith('.md')) continue;
    for (const { name, re, skip } of SECRET_PATTERNS) {
      for (const m of f.content.matchAll(re)) {
        const value = m[1] ?? m[0];
        if (skip && skip(value)) continue;
        findings.push({
          rule: 'hardcoded_secrets',
          severity,
          file: f.path,
          line: lineOf(f.content, m.index),
          message: `${name} found in source (${redact(value)}). Use a Named Credential or secret store.`,
        });
      }
    }
  }
  return findings;
}

export function destructiveChanges(files, _ctx, policy) {
  const severity = policy.rules.destructive_changes;
  if (severity === 'off') return [];
  const findings = [];
  for (const f of files) {
    if (!/destructiveChanges(Pre|Post)?\.xml$/i.test(f.path)) continue;
    const members = [...f.content.matchAll(/<members>([^<]+)<\/members>/g)].map((m) => m[1]);
    if (members.length === 0) continue;
    findings.push({
      rule: 'destructive_changes',
      severity,
      file: f.path,
      message: `Deletes ${members.length} metadata item(s): ${members.slice(0, 5).join(', ')}${members.length > 5 ? ', ...' : ''}. Confirm data and dependency impact.`,
    });
  }
  return findings;
}

const DANGEROUS_PERMS = ['modifyAllData', 'viewAllData', 'manageUsers', 'authorApex', 'modifyMetadata'];

export function permissionEscalation(files, _ctx, policy) {
  const severity = policy.rules.permission_escalation;
  if (severity === 'off') return [];
  const findings = [];
  for (const f of files) {
    if (!/\.(profile|permissionset)-meta\.xml$/i.test(f.path)) continue;
    for (const perm of DANGEROUS_PERMS) {
      const re = new RegExp(`<${perm}>\\s*true\\s*</${perm}>`, 'g');
      for (const m of f.content.matchAll(re)) {
        findings.push({
          rule: 'permission_escalation',
          severity,
          file: f.path,
          line: lineOf(f.content, m.index),
          message: `Grants powerful permission "${perm}". Apply least privilege.`,
        });
      }
    }
  }
  return findings;
}

export function missingUserStory(_files, ctx, policy) {
  const severity = policy.rules.missing_user_story;
  if (severity === 'off' || ctx.userStory) return [];
  return [{
    rule: 'missing_user_story',
    severity,
    message: 'No linked user story. Pass --user-story, set it in shipguard-context.json, or put the ID in the branch name.',
  }];
}

export function testCoverage(_files, ctx, policy) {
  const min = Number(policy.rules.test_coverage_min);
  if (!min) return [];
  if (ctx.coverage === undefined || ctx.coverage === null) {
    return [{ rule: 'test_coverage_min', severity: 'warn', message: `Coverage unknown (policy requires ${min}%). Provide --coverage or shipguard-context.json.` }];
  }
  if (Number(ctx.coverage) < min) {
    return [{ rule: 'test_coverage_min', severity: 'block', message: `Test coverage ${ctx.coverage}% is below the required ${min}%.` }];
  }
  return [];
}

export const ALL_RULES = [hardcodedSecrets, destructiveChanges, permissionEscalation, missingUserStory, testCoverage];
