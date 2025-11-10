import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import XLSX from 'xlsx';
import { db } from '$lib/server/db';

interface ImportResult {
  success: boolean;
  message: string;
  counts?: {
    created: number;
    updated: number;
    skipped: number;
  };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const importType = formData.get('type') as string;

    if (!file) {
      return json({ success: false, message: 'No file provided' }, { status: 400 });
    }

    // Read the file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    let result: ImportResult;

    switch (importType) {
      case 'vendors':
        result = await importVendors(data);
        break;
      case 'customers':
        result = await importCustomers(data);
        break;
      case 'products':
        result = await importProducts(data);
        break;
      case 'lpars':
        result = await importLpars(data);
        break;
      default:
        return json({ success: false, message: 'Invalid import type' }, { status: 400 });
    }

    return json(result);
  } catch (error: any) {
    console.error('Import error:', error);
    return json(
      { success: false, message: error.message || 'Import failed' },
      { status: 500 }
    );
  }
};

async function importVendors(data: any[][]): Promise<ImportResult> {
  const vendors = new Set<string>();

  // Extract unique vendors starting from row 3
  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    if (row && row[0]) {
      const vendorName = row[0].toString().trim();
      if (vendorName) vendors.add(vendorName);
    }
  }

  const vendorData = Array.from(vendors).map(vendorName => ({
    code: vendorName.toUpperCase().replace(/[^A-Z0-9]/g, '-'),
    name: vendorName,
    active: true
  }));

  // Fetch all existing vendors at once
  const existingVendors = await db.vendors.findMany({
    where: {
      code: { in: vendorData.map(v => v.code) }
    },
    select: { code: true }
  });

  const existingCodes = new Set(existingVendors.map(v => v.code));

  // Split into creates and updates
  const toCreate = vendorData.filter(v => !existingCodes.has(v.code));
  const toUpdate = vendorData.filter(v => existingCodes.has(v.code));

  // Batch create new vendors
  let created = 0;
  if (toCreate.length > 0) {
    await db.vendors.createMany({
      data: toCreate,
      skipDuplicates: true
    });
    created = toCreate.length;
  }

  // Batch update existing vendors
  let updated = 0;
  if (toUpdate.length > 0) {
    await db.$transaction(
      toUpdate.map(vendor =>
        db.vendors.update({
          where: { code: vendor.code },
          data: { name: vendor.name }
        })
      )
    );
    updated = toUpdate.length;
  }

  return {
    success: true,
    message: `Imported ${created + updated} vendors`,
    counts: { created, updated, skipped: 0 }
  };
}

async function importCustomers(data: any[][]): Promise<ImportResult> {
  const customerRow = data[0] || [];
  const customers = new Set<string>();
  let created = 0;
  let updated = 0;

  // Extract customers from row 0 (starting from column 6)
  for (let i = 6; i < customerRow.length; i++) {
    const customerName = customerRow[i];
    if (customerName) {
      customers.add(customerName.toString().trim());
    }
  }

  for (const customerName of Array.from(customers)) {
    const code = `CUST-${customerName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;

    const existing = await db.customers.findUnique({ where: { code } });

    if (existing) {
      await db.customers.update({
        where: { code },
        data: { name: customerName }
      });
      updated++;
    } else {
      await db.customers.create({
        data: {
          code,
          name: customerName,
          description: `Customer: ${customerName}`,
          active: true
        }
      });
      created++;
    }
  }

  return {
    success: true,
    message: `Imported ${created + updated} customers`,
    counts: { created, updated, skipped: 0 }
  };
}

async function importProducts(data: any[][]): Promise<ImportResult> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Extract software rows (starting from row 3)
  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0] || !row[1]) continue;

    const vendorName = row[0]?.toString().trim();
    const softwareName = row[1]?.toString().trim();
    const version = row[3]?.toString().trim() || '1.0.0';

    if (!vendorName || !softwareName) continue;

    // Find vendor
    const vendorCode = vendorName.toUpperCase().replace(/[^A-Z0-9]/g, '-');
    const vendor = await db.vendors.findUnique({ where: { code: vendorCode } });

    if (!vendor) {
      console.log(`Vendor not found: ${vendorName}`);
      skipped++;
      continue;
    }

    // Create or find software
    let software = await db.software.findFirst({
      where: {
        vendor_id: vendor.id,
        name: softwareName
      },
      include: { versions: true }
    });

    if (!software) {
      software = await db.software.create({
        data: {
          vendor_id: vendor.id,
          name: softwareName,
          description: `${softwareName} by ${vendorName}`,
          active: true
        },
        include: { versions: true }
      });
      created++;
    } else {
      updated++;
    }

    // Create version if it doesn't exist
    let versionRecord = software.versions.find((v) => v.version === version);

    if (!versionRecord) {
      versionRecord = await db.software_versions.create({
        data: {
          software_id: software.id,
          version: version,
          release_date: new Date(),
          is_current: true
        }
      });

      // Update software to point to this version as current
      await db.software.update({
        where: { id: software.id },
        data: { current_version_id: versionRecord.id }
      });
    }
  }

  return {
    success: true,
    message: `Imported ${created + updated} software products`,
    counts: { created, updated, skipped }
  };
}

async function importLpars(data: any[][]): Promise<ImportResult> {
  const customerRow = data[0] || [];
  const lparRow = data[1] || [];
  let lparsCreated = 0;
  let lparsUpdated = 0;
  let softwareAssigned = 0;

  // Extract LPARs and their customer associations
  const lpars: Array<{ name: string; customerName: string; columnIndex: number }> = [];

  for (let i = 6; i < customerRow.length; i++) {
    const customerName = customerRow[i];
    const lparName = lparRow[i];

    if (customerName && lparName) {
      lpars.push({
        name: lparName.toString().trim(),
        customerName: customerName.toString().trim(),
        columnIndex: i
      });
    }
  }

  // Import each LPAR and its software
  for (const lpar of lpars) {
    // Find customer
    const customerCode = `CUST-${lpar.customerName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
    const customer = await db.customers.findUnique({ where: { code: customerCode } });

    if (!customer) {
      console.log(`Customer not found: ${lpar.customerName}`);
      continue;
    }

    // Create or update LPAR
    const lparCode = `LPAR-${lpar.name.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
    let lparRecord = await db.lpars.findUnique({ where: { code: lparCode } });

    if (lparRecord) {
      await db.lpars.update({
        where: { code: lparCode },
        data: { name: lpar.name }
      });
      lparsUpdated++;
    } else {
      lparRecord = await db.lpars.create({
        data: {
          code: lparCode,
          name: lpar.name,
          customer_id: customer.id,
          description: `LPAR ${lpar.name} for ${lpar.customerName}`,
          active: true
        }
      });
      lparsCreated++;
    }

    // Import software for this LPAR
    for (let rowIndex = 3; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      if (!row || !row[0] || !row[1]) continue;

      // Check if this LPAR has this software (marked with 'x')
      if (row[lpar.columnIndex] === 'x' || row[lpar.columnIndex] === 'X') {
        const vendorName = row[0]?.toString().trim();
        const softwareName = row[1]?.toString().trim();
        const version = row[3]?.toString().trim() || '1.0.0';

        // Find vendor
        const vendorCode = vendorName.toUpperCase().replace(/[^A-Z0-9]/g, '-');
        const vendor = await db.vendors.findUnique({ where: { code: vendorCode } });

        if (!vendor) continue;

        // Find software
        const software = await db.software.findFirst({
          where: {
            vendor_id: vendor.id,
            name: softwareName
          }
        });

        if (!software) continue;

        // Check if assignment already exists
        const existing = await db.lpar_software.findFirst({
          where: {
            lpar_id: lparRecord.id,
            software_id: software.id
          }
        });

        if (!existing) {
          await db.lpar_software.create({
            data: {
              lpar_id: lparRecord.id,
              software_id: software.id,
              current_version: version,
              installed_date: new Date()
            }
          });
          softwareAssigned++;
        }
      }
    }
  }

  return {
    success: true,
    message: `Imported ${lparsCreated + lparsUpdated} LPARs with ${softwareAssigned} software assignments`,
    counts: { created: lparsCreated, updated: lparsUpdated, skipped: 0 }
  };
}
