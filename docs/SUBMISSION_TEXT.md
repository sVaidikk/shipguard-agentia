# Short written description (about 150 words)

ShipGuard is an extension for Copado Agentia CLI that acts as a policy gate for Salesforce releases created by developers and AI agents. Before a change is promoted, it checks for hardcoded secrets, destructive deletions, permission escalation, missing user-story links and low test coverage, then returns PASS, WARN or BLOCK with a plain-English explanation and fix advice. Its `gate` command runs a wrapped Agentia command only if the change passes. The same engine is exposed as MCP tools plus an agent skill, so a coding agent can check its own work, fix blocked issues and retry, while production still requires human approval. Every decision is written to an audit log, summaries can go to Slack, and reusable policy templates (startup, regulated, strict) apply standards consistently. It has no runtime dependencies, 21 automated tests, and isolates all Agentia calls in one adapter.

## Submission checklist
- [ ] Public GitHub repo URL
- [ ] Demo video link (<= 5 min, English)
- [ ] Deck (PDF or PPTX)
- [ ] Description (above)
- [ ] Repo README + LICENSE present, no real secrets
