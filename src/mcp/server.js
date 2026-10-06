#!/usr/bin/env node
// Minimal MCP server over stdio (newline-delimited JSON-RPC 2.0), zero dependencies.
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { runCheck } from '../core/engine.js';
import { loadPolicy } from '../core/policy.js';
import { explain } from '../core/explain.js';
import { writeAudit } from '../core/audit.js';

const checkSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Folder containing the Salesforce change set (default ".")' },
    userStory: { type: 'string', description: 'Linked Copado user story ID' },
    coverage: { type: 'number', description: 'Apex test coverage percentage' },
  },
};

export const TOOLS = [
  { name: 'shipguard_check', description: 'Run the ShipGuard policy check on a change set BEFORE promoting it. Returns PASS, WARN or BLOCK with findings. If BLOCK, fix every blocking finding and run again.', inputSchema: checkSchema },
  { name: 'shipguard_explain', description: 'Plain-English risk summary and fix advice for a change set.', inputSchema: checkSchema },
  { name: 'shipguard_policy', description: 'Show the active ShipGuard policy rules.', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
];

const opts = (a = {}) => ({ root: a.path || '.', userStory: a.userStory, coverage: a.coverage, detectBranch: true });
const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], isError });

export async function callTool(name, args) {
  switch (name) {
    case 'shipguard_check': {
      const r = runCheck(opts(args));
      writeAudit(r, { dir: process.cwd(), action: 'mcp:check' });
      return text(JSON.stringify({ decision: r.decision, riskLevel: r.riskLevel, score: r.score, findings: r.findings, next: r.decision === 'BLOCK' ? 'Fix all blocking findings, then call shipguard_check again. Do not promote.' : 'Allowed to proceed through the Copado pipeline.' }, null, 2));
    }
    case 'shipguard_explain': {
      const r = runCheck(opts(args));
      return text((await explain(r)).text);
    }
    case 'shipguard_policy': {
      const { policy, source } = loadPolicy(args?.path || '.');
      return text(JSON.stringify({ source, ...policy }, null, 2));
    }
    default:
      return text(`Unknown tool: ${name}`, true);
  }
}

export async function handle(msg) {
  const { id, method, params } = msg;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  switch (method) {
    case 'initialize':
      return reply({ protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'shipguard', version: '0.1.0' } });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call':
      try { return reply(await callTool(params.name, params.arguments)); } catch (e) { return reply(text(`Error: ${e.message}`, true)); }
    default:
      if (id === undefined) return null; // notification
      return fail(-32601, `Method not found: ${method}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); return; }
    const res = await handle(msg);
    if (res) process.stdout.write(JSON.stringify(res) + '\n');
  });
}
