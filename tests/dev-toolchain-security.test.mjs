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
    // GHSA-4528-x5fx-h6hg (wait-on, dev)
    joi: [18, 3, 1],
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

// Advisories whose vulnerable range has a lower bound: older major lines that
// are outside the range (e.g. minimatch 3.x for eslint) stay allowed.
function assertOutsideRange(path, name, introduced, fixed) {
  const vulnerable = lockedVersions(lockfile(path), name).filter(
    ({ version }) => !below(version, introduced) && below(version, fixed)
  );
  assert.deepEqual(
    vulnerable,
    [],
    `${path}: ${name} must not be in >= ${introduced.join('.')} < ${fixed.join('.')}`
  );
}

const vulnerableRanges = {
  'backend/package-lock.json': {
    // GHSA-g3hv-75wg-m249
    minimatch: [[7, 0, 0], [11, 0, 1]],
  },
  'frontend/package-lock.json': {
    // GHSA-g3hv-75wg-m249
    minimatch: [[7, 0, 0], [11, 0, 1]],
    // GHSA-3g3m-2fjr-6pw4
    glob: [[9, 0, 0], [14, 0, 2]],
  },
};

for (const [path, packages] of Object.entries(vulnerableRanges)) {
  for (const [name, [introduced, fixed]] of Object.entries(packages)) {
    test(`${path} keeps ${name} outside ${introduced.join('.')} - ${fixed.join('.')}`, () => {
      assertOutsideRange(path, name, introduced, fixed);
    });
  }
}
