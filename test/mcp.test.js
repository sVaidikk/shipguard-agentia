import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/mcp/server.js';

test('initialize + tools/list', async () => {
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } });
  assert.equal(init.result.serverInfo.name, 'shipguard');
  const list = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), ['shipguard_check', 'shipguard_explain', 'shipguard_policy']);
});

test('shipguard_check blocks the bad sample and passes the good one', async () => {
  const call = (p) => handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'shipguard_check', arguments: { path: p } } });
  const bad = JSON.parse((await call('samples/bad-change')).result.content[0].text);
  const good = JSON.parse((await call('samples/good-change')).result.content[0].text);
  assert.equal(bad.decision, 'BLOCK');
  assert.equal(good.decision, 'PASS');
});

test('notifications get no response; unknown method errors', async () => {
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const r = await handle({ jsonrpc: '2.0', id: 9, method: 'nope' });
  assert.equal(r.error.code, -32601);
});
