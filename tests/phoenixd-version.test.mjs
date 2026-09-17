import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const PHOENIXD_VERSION = '0.9.1';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function requireMatch(content, pattern, source) {
  const match = content.match(pattern);
  assert.ok(match, `Could not find the phoenixd version in ${source}`);
  return match[1];
}

test('bundled deployment paths use the supported phoenixd version', () => {
  const versions = {
    compose: requireMatch(
      read('docker-compose.yml'),
      /image:\s*acinq\/phoenixd:([^\s]+)/,
      'docker-compose.yml',
    ),
    desktopWorkflow: requireMatch(
      read('.github/workflows/release-desktop.yml'),
      /PHOENIXD_VERSION:\s*['"]([^'"]+)['"]/,
      '.github/workflows/release-desktop.yml',
    ),
    desktopScript: requireMatch(
      read('desktop/scripts/download-phoenixd.sh'),
      /PHOENIXD_VERSION="\$\{PHOENIXD_VERSION:-([^}]+)\}"/,
      'desktop/scripts/download-phoenixd.sh',
    ),
  };

  assert.deepEqual(versions, {
    compose: PHOENIXD_VERSION,
    desktopWorkflow: PHOENIXD_VERSION,
    desktopScript: PHOENIXD_VERSION,
  });
});
