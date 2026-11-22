# Vendor Bundles

Vendors ship maintenance as coordinated levels: Broadcom **CA RS / CARS** (`CARS2512`) and
IBM **RSU** (`RSU2512`). A *vendor bundle* stores one such level in the inventory, so packages
can be built from it instead of item by item.

## Concepts

| Term | Meaning |
|---|---|
| **Bundle** | One vendor level, e.g. `RSU2512`: vendor, code, type (CARS, RSU, Other), release date |
| **Bundle item** | A reference to one software version/PTF level contained in the level |
| **Version** | The release in the inventory's notation, e.g. `V6R1M0` |
| **Vendor notation** | The same release as the vendor writes it, e.g. `6.1`, stored on the same version |
| **PTF level** | IBM: the RSU code (`RSU2512`). Broadcom: the product's highest PTF in the level (`LU18719`) |
| **Product code** | The vendor's product id on the software record, used to match bundle rows (IBM: `CICSTS`, Broadcom: `AL2121` = product + release) |

### A version is stored once

Bundles do not hold copies of versions; they *reference* rows in the software's version list.
A version/PTF level exists once and is shared by every bundle, package and LPAR that has it.
If CA 7 has no new service in CARS2602, CARS2602 points at the same CA 7 version as CARS2601.

### Every release the vendor lists

A bundle holds all releases the vendor ships in that level. RSU2512, for example, holds
CICS 6.1, 6.2 and 6.3, Db2 12 and 13, and IMS 15.1 to 15.6. The same release can appear only
once per bundle.

### Two notations, one version

IBM writes "CICS TS 6.1" and "Db2 13"; the inventory uses `V6R1M0` and `V13R1M0`. Each version
keeps both:

- **Version** follows the notation most of that product's versions already use. A dotted release
  becomes VRM when the product mostly uses VRM (`6.3` → `V6R3M0`, `3.2` → `V3R2`). A shorter
  release matches the lowest known release it is a prefix of (`12` → `V12R1M0`, IMS `15` → `V15R1M0`).
- **Vendor notation** keeps the vendor's spelling exactly as written.

Screens show both when they differ: **V6R1M0 [6.1]**, followed by the PTF level in round
brackets, e.g. `V6R1M0 [6.1] (RSU2512)`. Imports find a version under either notation, and in
other spellings (`6.1.0`, `rsu2512`), so the same release is never stored twice. You can edit
the vendor notation in the software's version editor (field **Vendor notation**).

## Getting bundles into the inventory

### 1. Fetch from the vendor (optional, run locally)

Scripts read the vendors' public documents and write `bundles/<LEVEL>.csv`:

```bash
npm run bundles:fetch -- ibm RSU2512                       # IBM CST/RSU report
npm run bundles:fetch -- broadcom CARS2512 --products AL2121,CCS150
npm run bundles:fetch -- broadcom CARS2512                 # product codes from the inventory
```

- IBM publishes every product in one report; no per-product PTF list is published, so the PTF
  level is the RSU code.
- Broadcom publishes one service list per product. Without `--products`, the script fetches the
  Broadcom software in the inventory that has a product code. Broadcom has no public product-code
  index, so codes have to be entered on the software records first.
- The application itself never contacts vendor sites. Vendor document layouts can change; if a
  fetch fails on a new level, the parser needs updating.

### 2. Import the CSV

**Import** → **Vendor Bundles** → **Import Vendor Bundle CSV**. Columns:

```
vendor_code, bundle_code, bundle_name, bundle_type, release_date, product_code,
product_name, version, ptf_level, notes, source_url
```

What the import does:

| Situation | Result |
|---|---|
| Bundle code does not exist for the vendor | Bundle created |
| Bundle code exists | Its items are **replaced** by the file's rows |
| Row's product code (or name) matches software of that vendor | Row linked to that software |
| Product not in the inventory | Software **added** under the vendor; its highest release becomes current |
| Product exists but is inactive | Row skipped and listed |
| Version/PTF level does not exist | Version **created** (not marked current) |
| Version exists in another notation | Existing version reused; its vendor notation is filled in if empty |
| Same release listed twice for a product | Second row skipped and listed |
| Product in the vendor's previous level of the same type, but not in the file | **Carried forward**: keeps its previous version, note "Unchanged since CARS2511" |
| Unknown vendor code | Row reported as an error |

The carry-forward exists because Broadcom lists only products with new PTFs; without it a CARS
level would look incomplete. The result message counts bundles, new software, new versions,
carried products and skipped rows.

Newly created versions are never made current for existing software. Choosing the current
version stays a deliberate step on the software page.

### 3. Create or clone by hand

**Bundles** → **Add Bundle**:

- **Blank bundle**: choose vendor, code, type, release date, then add items. Only the vendor's
  software can be added. For each item, pick an existing version or enter a new version/PTF level;
  new versions are **created when the bundle is saved** (set their vendor notation on the software page).
- **Clone an existing bundle** (or **Clone as Next Level** on a bundle's page): copies all items
  and suggests the next code (`CARS2511` → `CARS2512`, `RSU2512` → `RSU2601`). Tick the items
  that changed and use **New PTF level for selected items**; unticked items keep their version.
  For RSU bundles the suggested PTF level is the bundle code.

A bundle code must be unique per vendor.

## Building packages from bundles

On **Create Package** or **Edit Package**, open **Add from Vendor Bundles** (**Show bundles**),
tick one or more bundles and click **Add selected bundles to package**. A bundle's page also has
a **Create Package** button that opens a new package with that bundle preselected.

Items are **copied** into the package. Later changes to the bundle do not change the package,
and each item remembers which bundle it came from.

A package holds one row per product, so per product:

| Package already has | Default | With **Latest release only** ticked |
|---|---|---|
| Nothing | Bundle's highest release added | Same |
| Db2 12 at an older level | Moves to the bundle's Db2 12 level | Upgrades to the bundle's Db2 13 level |
| Db2 11, not in the bundle | Kept as is, reported "not in RSU2512" | Upgrades to Db2 13 |
| Exactly the bundle's version | Unchanged | Unchanged if it is the highest release |

- Bundles are applied in list order; a later bundle wins for a product in both.
- Every replaced version is reported: "Db2: now from RSU2512 (was set manually / CARS2511)".
- Nothing is saved until you save the package. After adding, items can be changed, removed or
  added by hand as usual.

### Item source labels

Each package item shows where it came from:

| Label | Meaning |
|---|---|
| `RSU2512` | Copied from the bundle; the version is one of the bundle's releases |
| `RSU2512 · adjusted` | Copied from the bundle, then changed to a version the bundle does not contain |
| `Manual` | Added by hand (choosing another *software* on a row also makes it manual) |

A bundle's page lists the packages built from it (**Used in Packages**). Deleting a bundle keeps
the package items; they lose their source label.

## Tips

- Set **product codes** on software before fetching or importing, so rows match the right product
  instead of relying on names.
- Import levels in date order. Carry-forward uses the vendor's latest earlier level of the same type.
- Re-importing a corrected CSV is safe: the bundle's items are replaced and existing versions are reused.
- Use **Latest release only** when a package moves customers to a new release; leave it off for
  maintenance-only refreshes.
