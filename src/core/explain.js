const RULE_ADVICE = {
  hardcoded_secrets: 'Move credentials into a Named Credential or secret store and rotate any exposed value.',
  destructive_changes: 'Confirm no data or dependent components rely on the deleted items; consider a staged removal.',
  permission_escalation: 'Replace broad permissions with the narrowest set the role needs.',
  missing_user_story: 'Link the change to a user story so the release is traceable.',
  test_coverage_min: 'Add Apex tests until coverage meets the policy minimum.',
};

export function ruleBasedExplain(result) {
  const { decision, riskLevel, score, findings, filesScanned } = result;
  const head = `Release decision: ${decision} (risk ${riskLevel}, score ${score}/100) after scanning ${filesScanned} file(s).`;
  if (findings.length === 0) return `${head}\nNo policy issues found. Safe to promote through the normal Copado pipeline.`;
  const grouped = {};
  for (const f of findings) (grouped[f.rule] ||= []).push(f);
  const body = Object.entries(grouped).map(([rule, list]) => {
    const where = [...new Set(list.map((f) => f.file).filter(Boolean))].slice(0, 3).join(', ');
    return `- ${rule} (${list.length}): ${list[0].message}${where ? ` [${where}]` : ''}\n  Fix: ${RULE_ADVICE[rule] ?? 'Review and resolve.'}`;
  });
  const tail = decision === 'BLOCK'
    ? 'Do not promote until the blocking issues are fixed and ShipGuard passes.'
    : 'Promotion is allowed, but review the warnings.';
  return [head, 'What was found:', ...body, tail].join('\n');
}

/**
 * Optional AI-written explanation. Enabled only when ANTHROPIC_API_KEY and
 * SHIPGUARD_AI_MODEL are set; always falls back to the rule-based text.
 */
export async function explain(result) {
  const fallback = ruleBasedExplain(result);
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.SHIPGUARD_AI_MODEL;
  if (!key || !model) return { text: fallback, source: 'rules' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        messages: [{ role: 'user', content: `Write a short plain-English release risk note for reviewers (max 120 words) from this ShipGuard result:\n${JSON.stringify({ decision: result.decision, findings: result.findings })}` }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data.content?.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return text ? { text, source: 'ai' } : { text: fallback, source: 'rules' };
  } catch {
    return { text: fallback, source: 'rules' };
  }
}
