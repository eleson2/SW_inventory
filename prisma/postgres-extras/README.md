# PostgreSQL-only extras

Optional SQL for PostgreSQL deployments: reporting views, plpgsql functions, the
`lpar_dashboard` materialized view, partial and trigram (`pg_trgm`) indexes, and a
few old one-off column migrations.

**The application does not depend on any of this.** All app queries go through
Prisma and run on both PostgreSQL and SQLite (see `src/lib/server/db-dialect.ts`).
These files are useful for ad-hoc SQL reporting and query performance on large
Postgres databases. Do not apply them to SQLite.

Apply with psql, for example:

```bash
psql -d sw_inventory -f prisma/postgres-extras/add_views_and_functions.sql
```

or `npx tsx prisma/apply-views.ts` for `add_views_and_functions.sql`.

Note: `prisma db push` manages only what is in `schema.prisma`. If it reports that it
will drop indexes created here, re-apply the relevant file afterwards.
