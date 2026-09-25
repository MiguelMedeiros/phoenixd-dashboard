import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('frontend CI blocks high-severity production advisories', () => {
  const workflow = read('.github/workflows/ci.yml');

  assert.match(workflow, /npm audit --omit=dev --audit-level=high/);
});

test('Dependabot monitors the frontend npm lockfile', () => {
  const config = read('.github/dependabot.yml');

  assert.match(config, /package-ecosystem:\s*["']?npm["']?/);
  assert.match(config, /directory:\s*["']?\/frontend["']?/);
});
