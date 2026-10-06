import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from './yaml.js';

export const POLICY_FILE = 'shipguard.policy.yml';

export const DEFAULT_POLICY = {
  rules: {
    destructive_changes: 'block',
    permission_escalation: 'block',
    hardcoded_secrets: 'block',
    missing_user_story: 'warn',
    test_coverage_min: 75,
    prod_deploy_requires_approval: true,
  },
  notify: { slack_webhook_env: 'SHIPGUARD_SLACK_URL' },
};

export function mergePolicy(base, override = {}) {
  return {
    rules: { ...base.rules, ...(override.rules || {}) },
    notify: { ...base.notify, ...(override.notify || {}) },
  };
}

export function loadPolicy(dir = process.cwd(), file = POLICY_FILE) {
  const p = path.resolve(dir, file);
  if (!fs.existsSync(p)) return { policy: DEFAULT_POLICY, source: 'built-in defaults' };
  const parsed = parseYaml(fs.readFileSync(p, 'utf8'));
  return { policy: mergePolicy(DEFAULT_POLICY, parsed), source: p };
}

export const TEMPLATES = ['startup', 'regulated', 'strict'];

export function templatePath(name) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../policies', `${name}.yml`);
}

export function writeTemplate(name, dir = process.cwd(), force = false) {
  if (!TEMPLATES.includes(name)) throw new Error(`Unknown template "${name}". Use: ${TEMPLATES.join(', ')}`);
  const target = path.resolve(dir, POLICY_FILE);
  if (fs.existsSync(target) && !force) throw new Error(`${POLICY_FILE} already exists (use --force to overwrite)`);
  fs.copyFileSync(templatePath(name), target);
  return target;
}
