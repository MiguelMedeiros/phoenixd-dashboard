import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

// cypress-io/github-action pings wait-on with `got`, which only retries a fixed
// list of error codes. On dual-stack runners `localhost` resolves to ::1 and
// 127.0.0.1, and a refused happy-eyeballs connect surfaces as
// ERR_SOCKET_CLOSED_BEFORE_CONNECTION, which is not retried, so the job fails
// before the frontend has started. Waiting on the IPv4 loopback yields a plain
// ECONNREFUSED, which is retried until the server is ready.
test('E2E job waits on the IPv4 loopback instead of localhost', () => {
  const waitOn = workflow.match(/^\s*wait-on:\s*['"]?([^'"\s]+)['"]?\s*$/m);
  assert.ok(waitOn, 'E2E job has no wait-on URL');
  assert.equal(new URL(waitOn[1]).hostname, '127.0.0.1');
});
