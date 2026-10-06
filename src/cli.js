import fs from 'node:fs';
import process from 'node:process';
import { runCheck } from './core/engine.js';
import { loadPolicy, writeTemplate, TEMPLATES, POLICY_FILE } from './core/policy.js';
import { explain } from './core/explain.js';
import { writeAudit, readAudit, reportMarkdown, AUDIT_DIR } from './core/audit.js';
import { slackUrl, formatSlack, postSlack } from './core/notify.js';
import { agentiaAvailable, attachToUserStory, runCommand } from './adapter/agentia.js';

const HELP = `ShipGuard - policy gate for AI-driven Salesforce releases (extends Copado Agentia CLI)

Usage:
  shipguard init [--template startup|regulated|strict] [--force]
  shipguard check [path] [--base <git-ref>] [--user-story ID] [--coverage N] [--json] [--no-audit] [--notify]
  shipguard explain [path] [--user-story ID] [--coverage N] [--attach]
  shipguard gate [path] [--target NAME] [--approved] -- <command...>
  shipguard report [--json]
  shipguard doctor

Exit codes: 0 = PASS/WARN, 1 = BLOCK, 2 = usage or setup error.`;

export function parseArgs(argv) {
  const sep = argv.indexOf('--');
  const main = sep === -1 ? argv : argv.slice(0, sep);
  const rest = sep === -1 ? [] : argv.slice(sep + 1);
  const flags = {};
  const positional = [];
  const valued = new Set(['template', 'base', 'user-story', 'coverage', 'target']);
  for (let i = 0; i < main.length; i++) {
    const a = main[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (valued.has(k)) flags[k] = main[++i];
      else flags[k] = true;
    } else positional.push(a);
  }
  return { flags, positional, rest };
}

const fmt = (f) => `  [${f.severity.toUpperCase()}] ${f.rule}${f.file ? `  ${f.file}${f.line ? ':' + f.line : ''}` : ''}\n         ${f.message}`;

function printResult(result, out) {
  out(`ShipGuard check: ${result.decision}  (risk ${result.riskLevel}, score ${result.score}/100, ${result.filesScanned} files scanned)`);
  out(`Policy: ${result.policySource}`);
  if (result.findings.length) result.findings.forEach((f) => out(fmt(f)));
  else out('  No policy issues found.');
}

function checkOptions(flags, positional) {
  return {
    root: positional[0] || '.',
    base: flags.base,
    userStory: flags['user-story'],
    coverage: flags.coverage,
    detectBranch: true,
  };
}

export async function run(argv, io = {}) {
  const out = io.out || ((s) => console.log(s));
  const err = io.err || ((s) => console.error(s));
  const [cmd, ...args] = argv;
  const { flags, positional, rest } = parseArgs(args);

  try {
    switch (cmd) {
      case 'init': {
        const t = flags.template || 'regulated';
        const p = writeTemplate(t, process.cwd(), Boolean(flags.force));
        out(`Created ${p} from the "${t}" template. Available: ${TEMPLATES.join(', ')}`);
        return 0;
      }
      case 'check': {
        const result = runCheck(checkOptions(flags, positional));
        if (flags.json) out(JSON.stringify(result, null, 2));
        else printResult(result, out);
        if (!flags['no-audit']) writeAudit(result, { dir: process.cwd(), action: 'check' });
        if (flags.notify) {
          const { policy } = loadPolicy(process.cwd());
          const ok = await postSlack(slackUrl(policy), formatSlack(result, { target: positional[0] || '.' }));
          out(ok ? 'Slack notification sent.' : 'Slack notification skipped (webhook not configured or failed).');
        }
        return result.decision === 'BLOCK' ? 1 : 0;
      }
      case 'explain': {
        const result = runCheck(checkOptions(flags, positional));
        const { text, source } = await explain(result);
        out(text);
        out(`(explanation source: ${source})`);
        if (flags.attach && result.context.userStory) {
          const r = attachToUserStory(result.context.userStory, text);
          out(r ? `Attached to user story ${result.context.userStory}.` : 'Could not attach (Agentia CLI unavailable).');
        }
        return result.decision === 'BLOCK' ? 1 : 0;
      }
      case 'gate': {
        if (rest.length === 0) { err('gate needs a command after "--", e.g. shipguard gate . -- agentia cicd promote ...'); return 2; }
        const result = runCheck(checkOptions(flags, positional));
        printResult(result, out);
        writeAudit(result, { dir: process.cwd(), action: 'gate', extra: { command: rest.join(' ') } });
        const { policy } = loadPolicy(process.cwd());
        const prodLike = /prod/i.test(String(flags.target || ''));
        if (result.decision === 'BLOCK') { out('GATE: blocked. Command NOT executed.'); return 1; }
        if (prodLike && policy.rules.prod_deploy_requires_approval && !flags.approved) {
          out('GATE: production target requires human approval (--approved). Command NOT executed.');
          return 1;
        }
        out(`GATE: passed. Running: ${rest.join(' ')}`);
        return runCommand(rest[0], rest.slice(1));
      }
      case 'report': {
        const entries = readAudit(process.cwd());
        out(flags.json ? JSON.stringify(entries, null, 2) : reportMarkdown(entries));
        return 0;
      }
      case 'doctor': {
        let bad = 0;
        const line = (ok, msg) => { out(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) bad++; };
        const major = Number(process.versions.node.split('.')[0]);
        line(major >= 18, `Node.js ${process.versions.node} (need >= 18)`);
        line(fs.existsSync(POLICY_FILE), `${POLICY_FILE} ${fs.existsSync(POLICY_FILE) ? 'found' : 'missing (run: shipguard init)'}`);
        const v = agentiaAvailable();
        out(`${v ? 'OK  ' : 'WARN'} Agentia CLI ${v ? v : 'not found on PATH (optional; install @copado/agentia-cli)'}`);
        const { policy } = loadPolicy(process.cwd());
        out(`${slackUrl(policy) ? 'OK  ' : 'WARN'} Slack webhook ${slackUrl(policy) ? 'configured' : 'not set (optional)'}`);
        out(`${process.env.ANTHROPIC_API_KEY && process.env.SHIPGUARD_AI_MODEL ? 'OK  ' : 'WARN'} AI explanations ${process.env.ANTHROPIC_API_KEY && process.env.SHIPGUARD_AI_MODEL ? 'enabled' : 'off (rule-based fallback in use)'}`);
        try { fs.mkdirSync(AUDIT_DIR, { recursive: true }); line(true, `Audit directory ${AUDIT_DIR}/ writable`); } catch { line(false, 'Audit directory not writable'); }
        return bad ? 2 : 0;
      }
      case undefined:
      case 'help':
      case '--help':
        out(HELP);
        return 0;
      default:
        err(`Unknown command "${cmd}".\n${HELP}`);
        return 2;
    }
  } catch (e) {
    err(`ShipGuard error: ${e.message}`);
    return 2;
  }
}
