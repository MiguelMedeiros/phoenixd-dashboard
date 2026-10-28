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

function ciJob(workflow, jobId) {
  const start = workflow.search(new RegExp(`^  ${jobId}:\\s*$`, 'm'));
  assert.notEqual(start, -1, `CI job "${jobId}" not found`);
  const rest = workflow.slice(start + 1);
  const next = rest.search(/^  [\w-]+:\s*$/m);
  return next === -1 ? rest : rest.slice(0, next);
}

function lockedVersion(lockfilePath, packageName) {
  const lock = JSON.parse(read(lockfilePath));
  const entry = lock.packages[`node_modules/${packageName}`];
  assert.ok(entry, `${packageName} missing from ${lockfilePath}`);
  return entry.version.split('.').map(Number);
}

function assertAtLeast(actual, minimum, label) {
  for (let i = 0; i < minimum.length; i += 1) {
    if (actual[i] > minimum[i]) return;
    assert.ok(
      actual[i] === minimum[i],
      `${label} ${actual.join('.')} is below patched ${minimum.join('.')}`
    );
  }
}

test('frontend lockfile resolves Next.js and sharp past the October 2026 RCE advisories', () => {
  // GHSA-2464-fhr4-w9xw / GHSA-p3m5-59mp-jv5r: fixed in next 15.5.28 (sharp >= 0.35.5)
  assertAtLeast(lockedVersion('frontend/package-lock.json', 'next'), [15, 5, 28], 'next');
  assertAtLeast(lockedVersion('frontend/package-lock.json', 'sharp'), [0, 35, 5], 'sharp');
});

test('backend CI blocks high-severity production advisories', () => {
  const workflow = read('.github/workflows/ci.yml');

  assert.match(ciJob(workflow, 'backend'), /npm audit --omit=dev --audit-level=high/);
});

test('Dependabot monitors the frontend npm lockfile', () => {
  const config = read('.github/dependabot.yml');

  assert.match(config, /package-ecosystem:\s*["']?npm["']?/);
  assert.match(config, /directory:\s*["']?\/frontend["']?/);
});
