export function slackUrl(policy) {
  const envName = policy?.notify?.slack_webhook_env || 'SHIPGUARD_SLACK_URL';
  return process.env[envName];
}

export function formatSlack(result, { user, target } = {}) {
  const icon = { PASS: ':white_check_mark:', WARN: ':warning:', BLOCK: ':no_entry:' }[result.decision];
  const top = result.findings.slice(0, 5).map((f) => `• [${f.severity}] ${f.rule}${f.file ? ` - ${f.file}` : ''}`).join('\n');
  return `${icon} *ShipGuard ${result.decision}* (risk ${result.score}/100)${target ? ` for \`${target}\`` : ''}${user ? ` by ${user}` : ''}\n${top || 'No findings.'}`;
}

export async function postSlack(url, text) {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    return res.ok;
  } catch {
    return false;
  }
}
