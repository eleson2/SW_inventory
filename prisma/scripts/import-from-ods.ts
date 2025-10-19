import XLSX from 'xlsx';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SoftwareRow {
  vendor: string;
  softwareName: string;
  version: string;
  lparAssignments: boolean[]; // true where there's an 'x'
}

async function importFromODS() {
  console.log('Starting import from SW Master.ods...\n');

  // Read the ODS file
  const filePath = path.join(process.cwd(), 'SW Master.ods');
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  // Parse structure
  const customerRow = data[0] || [];
  const lparRow = data[1] || [];
  const headerRow = data[2] || [];

  // Extract customers and LPARs (starting from column index 6)
  const customers: string[] = [];
  const lpars: Array<{ name: string; customerName: string }> = [];

  for (let i = 6; i < customerRow.length; i++) {
    const customerName = customerRow[i];
    const lparName = lparRow[i];

    if (customerName && lparName) {
      if (!customers.includes(customerName)) {
        customers.push(customerName);
      }
      lpars.push({ name: lparName, customerName });
    }
  }

  console.log('Found customers:', customers);
  console.log('Found LPARs:', lpars.map(l => `${l.name} (${l.customerName})`));

  // Extract software rows (starting from row 3)
  const softwareRows: SoftwareRow[] = [];
  const vendors = new Set<string>();

  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0] || !row[1]) continue; // Skip empty rows

    const vendor = row[0]?.toString().trim();
    const softwareName = row[1]?.toString().trim();
    const version = row[3]?.toString().trim() || '1.0.0';

    if (vendor && softwareName) {
      vendors.add(vendor);

      // Check for 'x' marks in LPAR columns
      const lparAssignments: boolean[] = [];
      for (let j = 6; j < row.length; j++) {
        lparAssignments.push(row[j] === 'x' || row[j] === 'X');
      }

      softwareRows.push({
        vendor,
        softwareName,
        version,
        lparAssignments
      });
    }
  }

  console.log(`\nFound ${vendors.size} unique vendors`);
  console.log(`Found ${softwareRows.length} software products`);

  // Start import
  console.log('\n=== Starting Database Import ===\n');

  // 1. Import Vendors
  console.log('1. Importing Vendors...');
  const vendorMap = new Map<string, string>(); // vendor name -> vendor id

  for (const vendorName of Array.from(vendors)) {
    const code = vendorName.toUpperCase().replace(/[^A-Z0-9]/g, '-');
    const vendor = await prisma.vendors.upsert({
      where: { code },
      update: { name: vendorName },
      create: {
        code,
        name: vendorName,
        active: true
      }
    });
    vendorMap.set(vendorName, vendor.id);
    console.log(`  ✓ ${vendorName} (${code})`);
  }

  // 2. Import Customers
  console.log('\n2. Importing Customers...');
  const customerMap = new Map<string, string>(); // customer name -> customer id

  for (const customerName of customers) {
    const code = `CUST-${customerName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
    const customer = await prisma.customers.upsert({
      where: { code },
      update: { name: customerName },
      create: {
        code,
        name: customerName,
        description: `Customer: ${customerName}`,
        active: true
      }
    });
    customerMap.set(customerName, customer.id);
    console.log(`  ✓ ${customerName} (${code})`);
  }

  // 3. Import Software Products
  console.log('\n3. Importing Software Products...');
  const softwareMap = new Map<string, { softwareId: string; versionId: string }>(); // "vendor|software|version" -> {softwareId, versionId}

  for (const sw of softwareRows) {
    const vendorId = vendorMap.get(sw.vendor);
    if (!vendorId) {
      console.log(`  ⚠ Vendor not found for: ${sw.softwareName}`);
      continue;
    }

    const softwareCode = `${sw.vendor.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-${sw.softwareName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;

    // Create or find software
    let software = await prisma.software.findFirst({
      where: {
        vendor_id: vendorId,
        name: sw.softwareName
      },
      include: {
        versions: true
      }
    });

    if (!software) {
      software = await prisma.software.create({
        data: {
          vendor_id: vendorId,
          name: sw.softwareName,
          description: `${sw.softwareName} by ${sw.vendor}`,
          active: true
        },
        include: {
          versions: true
        }
      });
      console.log(`  ✓ Created software: ${sw.softwareName}`);
    }

    // Create version
    let version = software.versions.find(v => v.version === sw.version);

    if (!version) {
      version = await prisma.software_versions.create({
        data: {
          software_id: software.id,
          version: sw.version,
          release_date: new Date(),
          is_current: true
        }
      });

      // Update software to point to this version as current
      await prisma.software.update({
        where: { id: software.id },
        data: { current_version_id: version.id }
      });

      console.log(`    + Added version ${sw.version}`);
    }

    const key = `${sw.vendor}|${sw.softwareName}|${sw.version}`;
    softwareMap.set(key, {
      softwareId: software.id,
      versionId: version.id
    });
  }

  // 4. Import LPARs
  console.log('\n4. Importing LPARs...');
  const lparMap = new Map<string, string>(); // LPAR name -> LPAR id

  for (const lpar of lpars) {
    const customerId = customerMap.get(lpar.customerName);
    if (!customerId) {
      console.log(`  ⚠ Customer not found for LPAR: ${lpar.name}`);
      continue;
    }

    const code = `LPAR-${lpar.name.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
    const lparRecord = await prisma.lpars.upsert({
      where: { code },
      update: { name: lpar.name },
      create: {
        code,
        name: lpar.name,
        customer_id: customerId,
        description: `LPAR ${lpar.name} for ${lpar.customerName}`,
        active: true
      }
    });
    lparMap.set(lpar.name, lparRecord.id);
    console.log(`  ✓ ${lpar.name} for ${lpar.customerName}`);
  }

  // 5. Import LPAR Software Assignments
  console.log('\n5. Importing LPAR Software Assignments...');
  let assignmentCount = 0;

  for (let i = 0; i < softwareRows.length; i++) {
    const sw = softwareRows[i];
    const key = `${sw.vendor}|${sw.softwareName}|${sw.version}`;
    const swData = softwareMap.get(key);

    if (!swData) {
      console.log(`  ⚠ Software not found: ${key}`);
      continue;
    }

    for (let j = 0; j < sw.lparAssignments.length && j < lpars.length; j++) {
      if (sw.lparAssignments[j]) {
        const lparId = lparMap.get(lpars[j].name);

        if (lparId) {
          // Check if assignment already exists
          const existing = await prisma.lpar_software.findFirst({
            where: {
              lpar_id: lparId,
              software_id: swData.softwareId
            }
          });

          if (!existing) {
            await prisma.lpar_software.create({
              data: {
                lpar_id: lparId,
                software_id: swData.softwareId,
                current_version: sw.version,
                installed_date: new Date()
              }
            });
            assignmentCount++;
          }
        }
      }
    }
  }

  console.log(`  ✓ Created ${assignmentCount} software assignments`);

  console.log('\n=== Import Complete ===\n');
  console.log(`Summary:`);
  console.log(`  - Vendors: ${vendors.size}`);
  console.log(`  - Customers: ${customers.length}`);
  console.log(`  - Software Products: ${softwareMap.size}`);
  console.log(`  - LPARs: ${lpars.length}`);
  console.log(`  - Software Assignments: ${assignmentCount}`);
}

// Run the import
importFromODS()
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
