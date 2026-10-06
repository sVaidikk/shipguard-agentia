# ShipGuard

**A policy gate and self-correcting guardrail for AI-driven Salesforce releases, built to extend Copado Agentia CLI.**

AI agents in Cursor, VS Code and Claude Code can now run delivery commands through Agentia Headless. ShipGuard sits in front of that: it checks a change **before** it is promoted, explains the risk in plain English, records an audit trail, alerts the team, and lets the *agent itself* fix what was blocked.

> Copado pipelines and quality gates remain the system of record. ShipGuard gives developers and agents fast, local, explainable feedback before a change gets there.

## Why it matters
| Problem | ShipGuard |
|---|---|
| Risky changes (secrets, deletions, permission escalation) are found late, by failed deployments or incidents | Catches them before promotion |
| Reviewers get raw metadata diffs | Plain-English risk summary and fix advice |
| AI agents promote without a check | MCP tools + skill make the agent check, fix and retry |
| Standards differ per team | One shareable `shipguard.policy.yml` with templates |
| No evidence of what was checked | Append-only JSONL audit log + reports |

## Agentia extensibility used
- **Plugin commands**: `agentia shipguard ...` (all logic in `src/cli.js`, exported as `run(argv)`).
- **Skill**: `skills/shipguard/SKILL.md` tells agents to always gate promotions.
- **MCP**: `src/mcp/server.js` exposes `shipguard_check`, `shipguard_explain`, `shipguard_policy`.
- **Adapter**: every call into the Agentia CLI is isolated in `src/adapter/agentia.js`.

## Quickstart (2 minutes, Node 18+, zero dependencies)
```bash
git clone <your-repo-url> && cd shipguard
npm test                       # 21 tests
npm run demo:bad               # BLOCK, exit code 1
npm run demo:good              # PASS, exit code 0
node bin/shipguard.js explain samples/bad-change
node bin/shipguard.js gate samples/bad-change -- echo DEPLOYED   # command is NOT run
node bin/shipguard.js report
```

## Commands
| Command | What it does |
|---|---|
| `init [--template startup\|regulated\|strict]` | Creates `shipguard.policy.yml` from a template |
| `check [path] [--base ref] [--user-story ID] [--coverage N] [--json] [--notify]` | Scans a change set. PASS / WARN / BLOCK (exit 1 on BLOCK) |
| `explain [path] [--attach]` | Plain-English risk note; `--attach` writes it to the Copado user story |
| `gate [path] [--target NAME] [--approved] -- <cmd>` | Runs the check, then the wrapped command only if allowed. Production targets need `--approved` |
| `report [--json]` | Audit summary |
| `doctor` | Verifies Node, policy, Agentia CLI, Slack, AI and audit setup |

## Rules (`shipguard.policy.yml`)
```yaml
rules:
  destructive_changes: block      # destructiveChanges.xml deletions
  permission_escalation: block    # modifyAllData, viewAllData, manageUsers, authorApex, modifyMetadata
  hardcoded_secrets: block        # tokens, passwords, AWS keys, private keys, session IDs
  missing_user_story: warn        # no linked story (flag, context file, or branch name)
  test_coverage_min: 75           # below = BLOCK, unknown = WARN
  prod_deploy_requires_approval: true
notify:
  slack_webhook_env: SHIPGUARD_SLACK_URL
```
Each rule accepts `block`, `warn` or `off`. Findings never print full secrets (values are redacted).

## Using it with Agentia Headless
**1. As an Agentia CLI plugin.** Scaffold a plugin with the Agentia plugin generator (the public docs/examples use `npm init @copado/agentia-plugin`; confirm at developer.copado.com), then make each command call ShipGuard:
```js
import { run } from 'shipguard';
// inside the plugin's `shipguard` command handler (adapt to the plugin API):
process.exitCode = await run(args);   // args = ['check', 'force-app', '--json']
```
Link it with `agentia plugins link .`. Command names and flags in the beta may change, so keep Copado-specific calls in `src/adapter/agentia.js`.

**2. As an MCP server for your coding agent.** Add to your agent's MCP config (Cursor: `.cursor/mcp.json`):
```json
{ "mcpServers": { "shipguard": { "command": "node", "args": ["/absolute/path/to/shipguard/src/mcp/server.js"] } } }
```
**3. Skill.** Copy `skills/shipguard/` into your agent's skills folder so it always gates promotions.

## Agent self-correction loop
1. Agent prepares a change and calls `shipguard_check` -> **BLOCK** (secret + `modifyAllData`).
2. Slack alert fires (`--notify`) and the decision is audited.
3. Agent reads the findings, replaces the literal with `callout:Named_Credential`, sets the permission to `false`, adds tests.
4. Agent calls `shipguard_check` again -> **PASS** -> proceeds through the Copado pipeline. Human approval still required for production.

## Optional integrations
- **Slack/Teams**: set `SHIPGUARD_SLACK_URL`, then use `--notify`.
- **AI explanations**: set `ANTHROPIC_API_KEY` and `SHIPGUARD_AI_MODEL`. Without them, a deterministic rule-based explanation is used, so the tool never depends on a network call.

## Project layout
```
bin/shipguard.js        CLI entry          src/core/*   rules, engine, policy, audit, explain, notify
src/cli.js              commands           src/mcp/     MCP server (stdio JSON-RPC)
src/adapter/agentia.js  ALL Agentia calls  skills/      agent skill
policies/               templates          samples/     bad-change and good-change demo data
test/                   21 tests           docs/        demo script, deck outline, submission text
```

## Limitations and roadmap
- Rules are static pattern checks, not a full Salesforce metadata analyzer.
- The beta Agentia plugin API is not final; the adapter isolates that risk.
- Next: PR comments, Teams cards, custom rule plugins, Copado quality-gate sync.

## Declared dependencies and license
No runtime dependencies (Node.js built-ins only). MIT licensed. Sample secrets are fake demo values.
