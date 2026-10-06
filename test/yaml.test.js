import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml } from '../src/core/yaml.js';

test('parses nested scalars, numbers, booleans and comments', () => {
  const y = parseYaml('# c\nrules:\n  a: block\n  n: 75\n  b: true # note\nnotify:\n  x: ENV_NAME\n');
  assert.deepEqual(y, { rules: { a: 'block', n: 75, b: true }, notify: { x: 'ENV_NAME' } });
});
