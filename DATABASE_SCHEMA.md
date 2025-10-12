# Database Schema Design

This document outlines the recommended database schema for the SW Inventory system. The schema is designed to be database-agnostic but examples use SQL-like syntax.

## Entity Relationship Diagram (Text)

```
Customer (1) ---- (M) LPAR
Vendor (1) ---- (M) Software
Package (1) ---- (M) PackageItem ---- (1) Software
LPAR (M) ---- (M) LparSoftware ---- (1) Software
LPAR (1) ---- (1) Package [current]
```

## Tables

### customers

Stores basic customer information in multi-tenant environment.

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_code_format CHECK (code ~ '^[A-Z0-9_-]+$')
);

CREATE INDEX idx_customers_active ON customers(active);
CREATE INDEX idx_customers_code ON customers(code);
```

### vendors

Stores software vendor information and contact details.

```sql
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  website VARCHAR(255),
  contact_email VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_code_format CHECK (code ~ '^[A-Z0-9_-]+$'),
  CONSTRAINT chk_email_format CHECK (contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_vendors_active ON vendors(active);
CREATE INDEX idx_vendors_code ON vendors(code);
```

### software

Stores software products with version information.

```sql
CREATE TABLE software (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  description TEXT,
  current_version VARCHAR(50) NOT NULL,
  current_ptf_level VARCHAR(50),
  version_history JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_software_vendor ON software(vendor_id);
CREATE INDEX idx_software_active ON software(active);
CREATE INDEX idx_software_name ON software(name);
```

**version_history structure:**
```json
[
  {
    "version": "V2R3M0",
    "ptfLevel": "PTF11111",
    "releasedAt": "2023-12-01T00:00:00Z"
  }
]
```

### packages

Stores software package definitions (sets of tested software versions).

```sql
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  version VARCHAR(50) NOT NULL,
  release_date DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_code_format CHECK (code ~ '^[A-Z0-9_-]+$')
);

CREATE INDEX idx_packages_active ON packages(active);
CREATE INDEX idx_packages_release_date ON packages(release_date DESC);
CREATE INDEX idx_packages_code ON packages(code);
CREATE UNIQUE INDEX idx_packages_code_version ON packages(code, version);
```

### package_items

Junction table linking packages to specific software versions.

```sql
CREATE TABLE package_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  software_id UUID NOT NULL REFERENCES software(id) ON DELETE RESTRICT,
  version VARCHAR(50) NOT NULL,
  ptf_level VARCHAR(50),
  required BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_package_software UNIQUE (package_id, software_id)
);

CREATE INDEX idx_package_items_package ON package_items(package_id);
CREATE INDEX idx_package_items_software ON package_items(software_id);
CREATE INDEX idx_package_items_order ON package_items(package_id, order_index);
```

### lpars

Stores LPAR (Logical Partition) configurations.

```sql
CREATE TABLE lpars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  description TEXT,
  current_package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_code_format CHECK (code ~ '^[A-Z0-9_-]+$')
);

CREATE INDEX idx_lpars_customer ON lpars(customer_id);
CREATE INDEX idx_lpars_package ON lpars(current_package_id);
CREATE INDEX idx_lpars_active ON lpars(active);
CREATE INDEX idx_lpars_code ON lpars(code);
```

### lpar_software

Junction table tracking software installed on each LPAR with version history.

```sql
CREATE TABLE lpar_software (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lpar_id UUID NOT NULL REFERENCES lpars(id) ON DELETE CASCADE,
  software_id UUID NOT NULL REFERENCES software(id) ON DELETE RESTRICT,
  current_version VARCHAR(50) NOT NULL,
  current_ptf_level VARCHAR(50),
  previous_version VARCHAR(50),
  previous_ptf_level VARCHAR(50),
  installed_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rolled_back BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT uq_lpar_software UNIQUE (lpar_id, software_id)
);

CREATE INDEX idx_lpar_software_lpar ON lpar_software(lpar_id);
CREATE INDEX idx_lpar_software_software ON lpar_software(software_id);
CREATE INDEX idx_lpar_software_rolled_back ON lpar_software(lpar_id, rolled_back);
```

### audit_log

Tracks all changes for compliance and debugging.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL,
  changes JSONB NOT NULL,
  user_id UUID,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_entity_type CHECK (entity_type IN ('customer', 'vendor', 'software', 'package', 'lpar')),
  CONSTRAINT chk_action CHECK (action IN ('create', 'update', 'delete', 'rollback'))
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
```

**changes structure example:**
```json
{
  "before": {
    "version": "V2R3M0",
    "ptfLevel": "PTF11111"
  },
  "after": {
    "version": "V2R4M0",
    "ptfLevel": "PTF12345"
  }
}
```

## Prisma Schema Example

If using Prisma ORM, here's the equivalent schema:

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Customer {
  id          String   @id @default(uuid())
  name        String   @db.VarChar(100)
  code        String   @unique @db.VarChar(20)
  description String?
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  lpars Lpar[]

  @@index([active])
  @@index([code])
  @@map("customers")
}

model Vendor {
  id           String   @id @default(uuid())
  name         String   @db.VarChar(100)
  code         String   @unique @db.VarChar(20)
  website      String?  @db.VarChar(255)
  contactEmail String?  @map("contact_email") @db.VarChar(255)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  software Software[]

  @@index([active])
  @@index([code])
  @@map("vendors")
}

model Software {
  id              String   @id @default(uuid())
  name            String   @db.VarChar(100)
  vendorId        String   @map("vendor_id")
  description     String?
  currentVersion  String   @map("current_version") @db.VarChar(50)
  currentPtfLevel String?  @map("current_ptf_level") @db.VarChar(50)
  versionHistory  Json     @default("[]") @map("version_history")
  active          Boolean  @default(true)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  vendor        Vendor          @relation(fields: [vendorId], references: [id], onDelete: Restrict)
  packageItems  PackageItem[]
  lparSoftware  LparSoftware[]

  @@index([vendorId])
  @@index([active])
  @@index([name])
  @@map("software")
}

model Package {
  id          String   @id @default(uuid())
  name        String   @db.VarChar(100)
  code        String   @unique @db.VarChar(20)
  description String?
  version     String   @db.VarChar(50)
  releaseDate DateTime @map("release_date") @db.Date
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  items PackageItem[]
  lpars Lpar[]

  @@unique([code, version])
  @@index([active])
  @@index([releaseDate(sort: Desc)])
  @@index([code])
  @@map("packages")
}

model PackageItem {
  id         String   @id @default(uuid())
  packageId  String   @map("package_id")
  softwareId String   @map("software_id")
  version    String   @db.VarChar(50)
  ptfLevel   String?  @map("ptf_level") @db.VarChar(50)
  required   Boolean  @default(true)
  orderIndex Int      @map("order_index")
  createdAt  DateTime @default(now()) @map("created_at")

  package  Package  @relation(fields: [packageId], references: [id], onDelete: Cascade)
  software Software @relation(fields: [softwareId], references: [id], onDelete: Restrict)

  @@unique([packageId, softwareId])
  @@index([packageId])
  @@index([softwareId])
  @@index([packageId, orderIndex])
  @@map("package_items")
}

model Lpar {
  id               String   @id @default(uuid())
  name             String   @db.VarChar(100)
  code             String   @unique @db.VarChar(20)
  customerId       String   @map("customer_id")
  description      String?
  currentPackageId String?  @map("current_package_id")
  active           Boolean  @default(true)
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  customer        Customer       @relation(fields: [customerId], references: [id], onDelete: Restrict)
  currentPackage  Package?       @relation(fields: [currentPackageId], references: [id], onDelete: SetNull)
  softwareInstalled LparSoftware[]

  @@index([customerId])
  @@index([currentPackageId])
  @@index([active])
  @@index([code])
  @@map("lpars")
}

model LparSoftware {
  id               String   @id @default(uuid())
  lparId           String   @map("lpar_id")
  softwareId       String   @map("software_id")
  currentVersion   String   @map("current_version") @db.VarChar(50)
  currentPtfLevel  String?  @map("current_ptf_level") @db.VarChar(50)
  previousVersion  String?  @map("previous_version") @db.VarChar(50)
  previousPtfLevel String?  @map("previous_ptf_level") @db.VarChar(50)
  installedDate    DateTime @default(now()) @map("installed_date")
  rolledBack       Boolean  @default(false) @map("rolled_back")

  lpar     Lpar     @relation(fields: [lparId], references: [id], onDelete: Cascade)
  software Software @relation(fields: [softwareId], references: [id], onDelete: Restrict)

  @@unique([lparId, softwareId])
  @@index([lparId])
  @@index([softwareId])
  @@index([lparId, rolledBack])
  @@map("lpar_software")
}

model AuditLog {
  id         String   @id @default(uuid())
  entityType String   @map("entity_type") @db.VarChar(50)
  entityId   String   @map("entity_id")
  action     String   @db.VarChar(20)
  changes    Json
  userId     String?  @map("user_id")
  timestamp  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([timestamp(sort: Desc)])
  @@index([userId])
  @@map("audit_log")
}
```

## Queries for Common Operations

### Get LPAR with all installed software

```sql
SELECT
  l.*,
  c.name as customer_name,
  p.name as package_name,
  p.version as package_version,
  json_agg(
    json_build_object(
      'software_id', ls.software_id,
      'software_name', s.name,
      'version', ls.current_version,
      'ptf_level', ls.current_ptf_level,
      'installed_date', ls.installed_date,
      'rolled_back', ls.rolled_back
    )
  ) as software_installed
FROM lpars l
LEFT JOIN customers c ON l.customer_id = c.id
LEFT JOIN packages p ON l.current_package_id = p.id
LEFT JOIN lpar_software ls ON l.id = ls.lpar_id
LEFT JOIN software s ON ls.software_id = s.id
WHERE l.id = $1
GROUP BY l.id, c.name, p.name, p.version;
```

### Get package with all items

```sql
SELECT
  p.*,
  json_agg(
    json_build_object(
      'software_id', pi.software_id,
      'software_name', s.name,
      'version', pi.version,
      'ptf_level', pi.ptf_level,
      'required', pi.required,
      'order', pi.order_index
    ) ORDER BY pi.order_index
  ) as items
FROM packages p
LEFT JOIN package_items pi ON p.id = pi.package_id
LEFT JOIN software s ON pi.software_id = s.id
WHERE p.id = $1
GROUP BY p.id;
```

### Find LPARs with outdated software

```sql
SELECT
  l.id,
  l.name,
  l.code,
  s.name as software_name,
  ls.current_version as installed_version,
  s.current_version as latest_version
FROM lpars l
JOIN lpar_software ls ON l.id = ls.lpar_id
JOIN software s ON ls.software_id = s.id
WHERE ls.current_version != s.current_version
  AND l.active = true
  AND s.active = true;
```

## Indexes for Performance

Key indexes have been defined above, but additional composite indexes may be needed based on query patterns:

```sql
-- For filtering LPARs by customer and package
CREATE INDEX idx_lpars_customer_package ON lpars(customer_id, current_package_id)
WHERE active = true;

-- For finding software by vendor and status
CREATE INDEX idx_software_vendor_active ON software(vendor_id, active);

-- For audit log queries by entity and date range
CREATE INDEX idx_audit_log_entity_timestamp ON audit_log(entity_type, entity_id, timestamp DESC);
```

## Data Integrity Rules

1. **Cascading Deletes**: When a package is deleted, all its items are deleted (CASCADE)
2. **Restricted Deletes**: Cannot delete a vendor/customer/software that is referenced by other entities (RESTRICT)
3. **Soft Deletes**: Use `active` flag instead of hard deletes for most entities
4. **Version History**: Store complete version history in JSONB for audit trail
5. **Unique Constraints**: Enforce code uniqueness and prevent duplicate software on same LPAR
