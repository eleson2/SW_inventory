# Testing Guide - SW Inventory Management System

Comprehensive automated regression testing strategy using Vitest, Testing Library, and Playwright.

## 📦 Installation

Install all testing dependencies:

```bash
npm install -D vitest @testing-library/svelte @testing-library/jest-dom
npm install -D @playwright/test @vitest/ui @vitest/coverage-v8
npm install -D jsdom
```

Initialize Playwright:

```bash
npx playwright install
```

## 🧪 Testing Strategy

We follow the **testing pyramid** approach:

```
        /\
       /E2E\          10% - Critical user flows (Playwright)
      /------\
     /  API   \       30% - Server actions & DB ops (Vitest + Test DB)
    /----------\
   /   Unit     \     60% - Utils, validation, logic (Vitest)
  /--------------\
```

## 🎯 Test Categories

### 1. Unit Tests (60%)

**Location**: `src/**/*.test.ts`

**What to test**:
- ✅ Utility functions (version-parser, date formatting)
- ✅ Zod validation schemas
- ✅ Pure business logic
- ✅ Component helper functions

**Run unit tests**:
```bash
npm run test:unit          # Run once
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report
```

**Example**: `src/lib/utils/version-parser.test.ts`

### 2. Integration Tests (30%)

**Location**: `tests/integration/**/*.test.ts`

**What to test**:
- ✅ Database CRUD operations
- ✅ Server actions (form submissions)
- ✅ Complex queries with relations
- ✅ Transaction handling
- ✅ Business workflows (deployment, rollback)

**Setup Test Database**:

1. Create test database:
```bash
createdb sw_inventory_test
```

2. Set environment variable:
```bash
# .env.test
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sw_inventory_test?schema=public"
```

3. Run integration tests:
```bash
npm run test:integration
```

**Example**: `tests/integration/vendor-crud.test.ts`

### 3. E2E Tests (10%)

**Location**: `tests/e2e/**/*.spec.ts`

**What to test**:
- ✅ Critical user journeys
- ✅ Package deployment flow
- ✅ Software rollback
- ✅ Search and filtering
- ✅ Form validation UX
- ✅ Navigation and routing

**Run E2E tests**:
```bash
npm run test:e2e           # Headless mode
npm run test:e2e:headed    # With browser UI
npm run test:e2e:ui        # Interactive Playwright UI
```

**Example**: `tests/e2e/package-deployment.spec.ts`

## 🏃 Running Tests

### All Tests
```bash
npm run test:all           # Run all test suites
npm run test:ci            # CI-optimized run
```

### Watch Mode (Development)
```bash
npm run test:watch         # Auto-run tests on file changes
```

### Coverage Report
```bash
npm run test:coverage      # Generate coverage report
open coverage/index.html   # View in browser
```

## 📊 Coverage Goals

| Category | Target Coverage |
|----------|----------------|
| Utilities | 90%+ |
| Schemas | 85%+ |
| Server Actions | 75%+ |
| Components | 60%+ |
| Overall | 70%+ |

## 🎭 Test Database Management

### Setup

Integration tests use a separate test database to avoid polluting development data.

**Helper functions** (see `prisma/test-helpers.ts`):
- `setupTestDatabase()` - Initialize schema
- `cleanupTestDatabase()` - Truncate tables between tests
- `seedTestData()` - Create test fixtures
- `disconnectTestDatabase()` - Cleanup connections

### Usage Pattern

```typescript
import { testDb, setupTestDatabase, cleanupTestDatabase } from '../../prisma/test-helpers';

describe('My Integration Test', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase(); // Clean slate for each test
  });

  it('should test something', async () => {
    const vendor = await testDb.vendors.create({ ... });
    expect(vendor).toBeDefined();
  });
});
```

## 🔍 What to Test (Regression Suite)

### Critical Paths to Test

1. **Vendor/Customer/Software CRUD**
   - Create new records
   - Edit existing records
   - Soft delete (deactivation)
   - Cascade deactivation
   - Unique constraint validation

2. **Package Management**
   - Create package with items
   - Edit package items (add/remove/reorder)
   - Version validation
   - Package deployment

3. **LPAR Management**
   - Assign package to LPAR
   - Track installed software
   - Version compatibility checks

4. **Deployment Flow** ⭐ CRITICAL
   - Select LPARs for deployment
   - Show deployment impact analysis
   - Execute deployment
   - Update lpar_software table
   - Create audit log entries

5. **Rollback Flow** ⭐ CRITICAL
   - Identify software eligible for rollback
   - Execute rollback with reason
   - Verify version swap
   - Check audit trail

6. **Search & Filtering**
   - Instant search functionality
   - Pagination
   - Sorting by columns
   - Filter persistence

7. **Version Parsing**
   - IBM format (V5R6M0 PTF12345)
   - Broadcom format (2.4.0 SO12345)
   - Version comparison logic
   - PTF level comparison

## 🚨 Regression Test Checklist

Before each release, run:

```bash
# 1. Unit tests
npm run test:unit

# 2. Integration tests (requires test DB)
npm run test:integration

# 3. E2E tests (requires dev server)
npm run test:e2e

# 4. Type checking
npm run check

# 5. Build verification
npm run build
```

## 🐛 Debugging Tests

### Vitest
```bash
# Run specific test file
npx vitest run src/lib/utils/version-parser.test.ts

# Debug with breakpoints
node --inspect-brk node_modules/.bin/vitest run
```

### Playwright
```bash
# Interactive UI mode (best for debugging)
npm run test:e2e:ui

# Generate test code
npx playwright codegen http://localhost:5173

# Show browser while running
npm run test:e2e:headed

# Debug specific test
npx playwright test tests/e2e/vendor-crud.spec.ts --debug
```

## 📝 Writing Good Tests

### DO ✅
- Test behavior, not implementation
- Use descriptive test names
- One assertion per test (when possible)
- Clean up after tests (especially DB tests)
- Use test data factories/fixtures
- Test error cases and edge cases
- Mock external dependencies

### DON'T ❌
- Test framework code (Prisma, SvelteKit)
- Rely on test execution order
- Use production database for tests
- Leave console.log() in tests
- Test private implementation details
- Duplicate test coverage

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npx prisma generate
      - run: npm run test:ci

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 🎯 Prioritization for Initial Setup

If you're starting from scratch, implement in this order:

### Phase 1: Quick Wins (Week 1)
1. ✅ Unit tests for version-parser
2. ✅ Unit tests for Zod schemas
3. ✅ Set up test database
4. ✅ Basic vendor CRUD integration test

### Phase 2: Core Features (Week 2)
5. ✅ Package deployment integration tests
6. ✅ Rollback integration tests
7. ✅ E2E test for vendor CRUD
8. ✅ E2E test for package deployment

### Phase 3: Full Coverage (Week 3+)
9. ✅ Add remaining integration tests
10. ✅ Add remaining E2E tests
11. ✅ Set up CI/CD pipeline
12. ✅ Add coverage reports

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [SvelteKit Testing](https://kit.svelte.dev/docs/testing)

## ❓ FAQ

**Q: Do I need to test every component?**
A: No. Focus on testing logic and behavior. Simple presentational components often don't need dedicated tests.

**Q: How do I test forms?**
A: Use E2E tests for full form flows. Use integration tests for server actions and validation.

**Q: What about testing database views/functions?**
A: Write integration tests that query the views and verify results match expected business logic.

**Q: How do I handle flaky tests?**
A: Add proper waits, avoid hardcoded timeouts, clean up state between tests, and use retries sparingly.

---

**Last Updated**: 2025-01-13
