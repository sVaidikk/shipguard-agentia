# Demo video script (target 4:30, hard limit 5:00)

**0:00-0:30 Hook.** "AI agents can now ship Salesforce changes from the terminal. Who checks what they ship? ShipGuard does, before anything is promoted."

**0:30-1:30 Block.** Run `npm run demo:bad`. Point out: hardcoded token, modifyAllData, destructive deletions, 58% coverage. Show exit code 1.

**1:30-2:15 Explain + gate.** Run `shipguard explain samples/bad-change`. Then `shipguard gate samples/bad-change -- echo DEPLOYED`: show that the command never ran.

**2:15-3:30 Agent self-correction (the key moment).** In Cursor/VS Code with the MCP server connected, ask the agent to "promote samples/bad-change". It calls `shipguard_check`, gets BLOCK, fixes the files, calls again, gets PASS. (Tip: `git stash`/reset the sample afterwards.)

**3:30-4:00 Governance.** Run `shipguard report` (audit trail). Show the Slack alert if configured. Show the 3 policy templates.

**4:00-4:30 Close.** "No dependencies, 21 tests, plugin + skill + MCP. Copado stays the system of record; ShipGuard gives agents and developers fast, explainable guardrails. Next: PR comments and custom rules."

Recording tips: 1080p, large terminal font, rehearse twice, add English captions, no real secrets on screen.
