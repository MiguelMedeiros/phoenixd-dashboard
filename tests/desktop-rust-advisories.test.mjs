import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const lock = readFileSync(new URL('../desktop/src-tauri/Cargo.lock', import.meta.url), 'utf8');

function lockedVersions(name) {
  const versions = [];
  for (const block of lock.split('[[package]]')) {
    const n = block.match(/^name = "([^"]+)"$/m);
    const v = block.match(/^version = "([^"]+)"$/m);
    if (n && v && n[1] === name) versions.push(v[1]);
  }
  return versions;
}

function cmp(a, b) {
  const pa = a.split(/[.+-]/).slice(0, 3).map(Number);
  const pb = b.split(/[.+-]/).slice(0, 3).map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

// Patched floors for advisories open against the desktop lockfile. Tauri's
// origin-confusion advisory (GHSA, fixed in 2.11.1) is not in RustSec, so
// `cargo audit` alone would not catch a regression for it.
const FLOORS = {
  tauri: '2.11.1',
  time: '0.3.47',
  bytes: '1.11.1',
  serde_with: '3.21.0',
  'quick-xml': '0.41.0',
  anyhow: '1.0.103',
};

for (const [name, floor] of Object.entries(FLOORS)) {
  test(`desktop Cargo.lock keeps ${name} at or above patched ${floor}`, () => {
    const versions = lockedVersions(name);
    assert.ok(versions.length > 0, `${name} missing from Cargo.lock`);
    for (const v of versions) {
      assert.ok(cmp(v, floor) >= 0, `${name} ${v} is below patched ${floor}`);
    }
  });
}

test('desktop Cargo.lock has no tokio in the AsyncFd I/O-safety range', () => {
  for (const v of lockedVersions('tokio')) {
    const fixed = (cmp(v, '1.51.6') >= 0 && cmp(v, '1.52.0') < 0) || cmp(v, '1.53.3') >= 0;
    assert.ok(fixed, `tokio ${v} is affected by RUSTSEC-2026-0386`);
  }
});

test('CI runs cargo audit on the desktop lockfile with a commit-pinned installer', () => {
  const job = workflow.match(/\n {2}desktop-advisories:\n([\s\S]*?)(?=\n {2}[a-z0-9-]+:\n|$)/);
  assert.ok(job, 'ci.yml must define a desktop-advisories job');
  assert.match(job[1], /uses:\s*taiki-e\/install-action@[0-9a-f]{40}\s*#\s*v\d+\.\d+\.\d+/);
  assert.match(job[1], /tool:\s*cargo-audit/);
  assert.match(job[1], /working-directory:\s*\.\/desktop\/src-tauri/);
  assert.match(job[1], /run:\s*cargo audit\b/);
});
