import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function lockfile(path) {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

// Every installed copy of `name` (top-level or nested) in an npm v3 lockfile.
function lockedVersions(lock, name) {
  return Object.entries(lock.packages)
    .filter(([key]) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`))
    .map(([key, entry]) => ({ key, version: entry.version }));
}

function below(version, minimum) {
  const actual = version.split(/[.-]/).slice(0, 3).map(Number);
  for (let i = 0; i < minimum.length; i += 1) {
    if (actual[i] > minimum[i]) return false;
    if (actual[i] < minimum[i]) return true;
  }
  return false;
}

function assertFloor(path, name, minimum) {
  const stale = lockedVersions(lockfile(path), name).filter(({ version }) =>
    below(version, minimum)
  );
  assert.deepEqual(
    stale,
    [],
    `${path}: ${name} must be >= ${minimum.join('.')} (open Dependabot advisory)`
  );
}

// Floors are the first patched versions of the advisories Dependabot reports
// against each lockfile. A package that is no longer installed passes.
const floors = {
  'package-lock.json': { 'shell-quote': [1, 9, 0] },
  'backend/package-lock.json': {
    vitest: [4, 1, 12],
    '@vitest/mocker': [4, 1, 12],
    vite: [6, 4, 4],
    tinypool: [2, 1, 2],
    esbuild: [0, 25, 0],
    uuid: [11, 1, 1],
  },
  'frontend/package-lock.json': {
    '@vitest/mocker': [4, 1, 12],
    systeminformation: [5, 33, 16],
  },
  'e2e/package-lock.json': {
    systeminformation: [5, 33, 16],
    qs: [6, 16, 1],
  },
};

for (const [path, packages] of Object.entries(floors)) {
  for (const [name, minimum] of Object.entries(packages)) {
    test(`${path} resolves ${name} at or past ${minimum.join('.')}`, () => {
      assertFloor(path, name, minimum);
    });
  }
}
