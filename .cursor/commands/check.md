# /check - Run all CI/CD checks locally

Run all checks that would run in CI/CD before committing. This ensures code quality and prevents failed builds.

## Instructions

Execute all checks in order and stop immediately if any check fails:

### 1. Backend Checks

```bash
cd /Users/miguelmedeiros/code/phoenixd-dashboard/backend
```

1. Generate Prisma Client: `npm run db:generate`
2. Check formatting: `npm run format:check`
3. Run ESLint: `npm run lint`
4. Run tests: `npm run test`
5. Build TypeScript: `npm run build`

### 2. Frontend Checks

```bash
cd /Users/miguelmedeiros/code/phoenixd-dashboard/frontend
```

1. Check formatting: `npm run format:check`
2. Run ESLint: `npm run lint`
3. Run tests: `npm run test`
4. Build Next.js: `npm run build`

### 3. E2E Tests

```bash
cd /Users/miguelmedeiros/code/phoenixd-dashboard
npm run test:e2e
```

Run the full E2E test suite with Cypress.

### 4. Summary

After running all checks, provide a summary table:

| Category | Check           | Status |
| -------- | --------------- | ------ |
| Backend  | Prisma Generate | ✅/❌  |
| Backend  | Format Check    | ✅/❌  |
| Backend  | ESLint          | ✅/❌  |
| Backend  | Tests (count)   | ✅/❌  |
| Backend  | Build           | ✅/❌  |
| Frontend | Format Check    | ✅/❌  |
| Frontend | ESLint          | ✅/❌  |
| Frontend | Tests (count)   | ✅/❌  |
| Frontend | Build           | ✅/❌  |
| E2E      | Tests (count)   | ✅/❌  |

## Variants

- `/check` - Run all checks including E2E tests
- `/check quick` - Run only unit tests (skip E2E)

## Notes

- Stop immediately if any check fails and report the error
- Show test counts in the summary
- This mirrors the exact checks from `.github/workflows/ci.yml`
