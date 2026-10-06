import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLICY } from '../src/core/policy.js';
import { hardcodedSecrets, destructiveChanges, permissionEscalation, missingUserStory, testCoverage } from '../src/core/rules.js';

const P = DEFAULT_POLICY;

test('secrets: detects hardcoded credential and redacts value', () => {
  const f = hardcodedSecrets([{ path: 'a.cls', content: "String apiKey = 'abcd1234efgh';" }], {}, P);
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'block');
  assert.ok(!f[0].message.includes('abcd1234efgh'));
});

test('secrets: ignores Named Credentials and placeholders', () => {
  const files = [{ path: 'a.cls', content: "token = 'callout:My_Cred';\npassword = 'changeme123';" }];
  assert.equal(hardcodedSecrets(files, {}, P).length, 0);
});

test('secrets: detects AWS key and private key block', () => {
  const files = [{ path: 'k.txt', content: 'AKIAABCDEFGHIJKLMNOP\n-----BEGIN RSA PRIVATE KEY-----' }];
  assert.equal(hardcodedSecrets(files, {}, P).length, 2);
});

test('destructive: flags destructiveChanges.xml members', () => {
  const xml = '<Package><types><members>A.B__c</members><name>CustomField</name></types></Package>';
  const f = destructiveChanges([{ path: 'x/destructiveChanges.xml', content: xml }], {}, P);
  assert.equal(f.length, 1);
  assert.match(f[0].message, /A\.B__c/);
});

test('destructive: ignores normal package.xml', () => {
  assert.equal(destructiveChanges([{ path: 'package.xml', content: '<members>X</members>' }], {}, P).length, 0);
});

test('permissions: flags modifyAllData=true, ignores false', () => {
  const bad = { path: 'p.permissionset-meta.xml', content: '<modifyAllData>true</modifyAllData>' };
  const ok = { path: 'q.permissionset-meta.xml', content: '<modifyAllData>false</modifyAllData>' };
  assert.equal(permissionEscalation([bad], {}, P).length, 1);
  assert.equal(permissionEscalation([ok], {}, P).length, 0);
});

test('user story: warns when missing, silent when present', () => {
  assert.equal(missingUserStory([], {}, P).length, 1);
  assert.equal(missingUserStory([], { userStory: 'US-1' }, P).length, 0);
});

test('coverage: blocks below minimum, warns when unknown, passes above', () => {
  assert.equal(testCoverage([], { coverage: 50 }, P)[0].severity, 'block');
  assert.equal(testCoverage([], {}, P)[0].severity, 'warn');
  assert.equal(testCoverage([], { coverage: 90 }, P).length, 0);
});

test('policy "off" disables a rule', () => {
  const off = { rules: { ...P.rules, hardcoded_secrets: 'off' } };
  assert.equal(hardcodedSecrets([{ path: 'a.cls', content: "apiKey = 'abcd1234efgh'" }], {}, off).length, 0);
});
