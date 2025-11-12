Quick Prisma migration & validation steps
1. Run the migration script to convert local PrismaClient instantiations:
   npm run migrate-prisma

2. Review changes and backups:
   - The script creates backups with a .bak extension next to modified files.
   - Inspect diffs and adjust any manual type imports (e.g. `import type { Prisma } from '@prisma/client'`) if needed.

3. Type-check and lint:
   npm run type-check
   npm run lint

4. Run tests / basic app checks:
   - Start the app and exercise routes that use the DB (notably the deploy flow).
   - Fix any runtime errors and adjust Prisma model field names if necessary.

5. Finalize:
   - Commit changes after review.
   - If you still find raw SQL or other DB clients, open them for targeted migration to event.locals.prisma.

Notes
- The shared client is exported from src/lib/prisma.ts and attached on event.locals.prisma by src/hooks.server.ts.
- If your app uses a different locals key for the Prisma client, update hooks.server.ts and routes accordingly.
