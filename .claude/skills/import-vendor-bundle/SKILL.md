---
name: import-vendor-bundle
description: Fetch and import a vendor maintenance level (IBM RSU, Broadcom CARS / CA RS) into the SW inventory, e.g. "import RSU2601", "pull the latest CARS", "load the December RSU". Uses scripts; resolves anomalies they report.
---

# Import a vendor bundle

Everything goes through two scripts. Their output is compact and complete: **do not open
CSVs, PDFs, fixtures or source files** unless a step below says so. Run commands from the
project root; add `-s` to npm to suppress its banner.

## Steps

1. **Level code.** RSU = `RSUyymm`, CARS = `CARSyymm`. "Latest" = the current month's code;
   if the fetch says it is not published, step back one month (at most 3 times).

2. **Fetch** (writes `bundles/<LEVEL>.csv`):
   ```
   npm run -s bundles:fetch -- ibm RSU2601
   npm run -s bundles:fetch -- broadcom CARS2601        # products = Broadcom software with a product code
   ```
   - Broadcom with "no product codes": run `npm run -s bundles:import -- --codes BROADCOM`, then go to
     *Product codes* below.
   - A parse error or 0 rows when the level exists: the vendor changed its layout. Only then read
     `scripts/fetch-bundles/<vendor>.ts` and the matching test in `parsers.test.ts`; fix the parser,
     run `npx vitest run scripts`.

3. **Dry run** (SQLite: imports into a temporary copy; nothing is saved):
   ```
   npm run -s bundles:import -- bundles/RSU2601.csv --check
   ```
   Several files may be given; they are imported oldest first.

4. **Resolve every line starting with `!`** (see table). Plain lines are information.
   After fixes, repeat step 3 once.

5. **Import** with the same command without `--check`. Report the first line of the output
   plus any remaining `!` lines to the user, in two or three sentences. Use `--list` only if
   the user asks for the contents.

## `!` lines

| Line | Action |
|---|---|
| `new product: X - similar existing: "Y" [no code]` | Probably the same product. Ask the user once for all such lines; if it is Y, set Y's code to X's code (`--set-code`), rename Y to X if the user wants the vendor's name (`--rename`), and re-check. If genuinely new, import as is |
| `new product: X - similar existing: "Y" [CODE]` | Y has another code: likely a different product or release. Import as is unless the user says otherwise |
| `later level(s) already imported: ...` | Import order matters for carry-forward. After importing, re-import the later levels' CSVs from `bundles/` if present (same command), oldest first |
| `notation: ...` | Version stored in another style than the product's others. Report it; fixing is done by the user in the software's version editor |
| `error: unknown vendor code` | Vendor codes must exist (`IBM`, `BROADCOM`). Ask the user; do not create vendors |
| `error: ...` other | Show the message to the user |

Lines `skipped: ... (inactive in the inventory)` mean the product is deactivated on purpose:
report, do not reactivate.

## Product codes

Rows are matched on `software.product_code`, then on name.
- IBM: the report's product name without spaces, e.g. `CICSTS`, `DB2`, `IMS`, `ZOS`.
- Broadcom: product code + release, e.g. `AL2121` (CA 7 12.1). There is no public index: **ask the
  user** for the codes (Broadcom Support, product download page); do not search the web.

```
npm run -s bundles:import -- --codes BROADCOM                  # list (code or "-", name)
npm run -s bundles:import -- --set-code BROADCOM "CA 7" AL2121 # exact name from the list
npm run -s bundles:import -- --rename IBM "Old name" "New name"
```

## Rules

- Never edit the database with ad-hoc scripts or SQL; use the commands above or tell the user
  which screen to use.
- Do not change which version is current for existing software; imports never do, on purpose.
- The dev server may run during imports (SQLite allows one writer; the script waits briefly).
- Demo server: same commands in `/opt/sw-inventory/app` prefixed with `sudo -u swinv`; only when
  the user has given SSH access and asked for it.
- Background (only if needed): `docs/user-guide/VENDOR_BUNDLES.md`.
