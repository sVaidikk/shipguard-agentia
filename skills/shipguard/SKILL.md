---
name: shipguard
description: Run the ShipGuard policy check before promoting any Salesforce change through Copado Agentia. Use whenever you are about to deploy, promote, or merge metadata changes.
---

# ShipGuard: pre-promotion policy gate

You must check every Salesforce change before it is promoted.

## Workflow
1. Before running any promote/deploy command, call the MCP tool `shipguard_check` with the folder that holds the change (and `userStory` / `coverage` if known). Without MCP, run `shipguard check <path>`.
2. Read the decision:
   - **PASS**: continue with the normal Copado promotion.
   - **WARN**: continue, but mention each warning to the human.
   - **BLOCK**: do NOT promote. Fix every blocking finding, then call `shipguard_check` again.
3. Repeat until the decision is PASS or WARN. Never bypass, edit, or loosen `shipguard.policy.yml` to get a pass.
4. For production targets, always ask a human for approval before promoting.

## How to fix common findings
- `hardcoded_secrets`: remove the literal; use a Named Credential (`callout:Name`) or custom metadata.
- `permission_escalation`: set the powerful permission to `false` and grant only the specific object/field access needed.
- `destructive_changes`: remove or defer the deletion unless the human explicitly confirmed it.
- `missing_user_story`: ask the human for the user story ID.
- `test_coverage_min`: write Apex tests for the new code and report the new coverage.

Use `shipguard_explain` to give the human a plain-English summary of what was found and fixed.
