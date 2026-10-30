import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

// cypress-io/github-action v6 pings `wait-on` with got@11 on the node20 action
// runtime. On current hosted runners that ping aborts on the first refused
// connection ("Socket closed before the connection was established") instead
// of retrying, so the E2E job fails before the frontend has started. v7.4.4+
// runs on node24 with got@16. Keep the action on v7+ pinned to a commit SHA.
test('E2E job uses a commit-pinned cypress-io/github-action v7 or newer', () => {
  const uses = workflow.match(/uses:\s*cypress-io\/github-action@([0-9a-f]{40})\s*#\s*v(\d+)\.\d+\.\d+/);
  assert.ok(uses, 'cypress-io/github-action must be pinned to a 40-char SHA with a "# vX.Y.Z" comment');
  assert.ok(Number(uses[2]) >= 7, `cypress-io/github-action v${uses[2]} is below v7`);
});
