import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('Verifying migration...\n');

  try {
    // 1. Check package_items table structure
    console.log('1. Checking package_items table structure:');
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'package_items'
      ORDER BY ordinal_position;
    `);
    console.table(columns);

    // 2. Check if lpar_package_compliance view exists
    console.log('\n2. Checking if lpar_package_compliance view exists:');
    const viewExists = await prisma.$queryRawUnsafe(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_name = 'lpar_package_compliance';
    `);
    console.log(viewExists.length > 0 ? '✓ View exists' : '✗ View not found');

    // 3. Test querying package_items
    console.log('\n3. Testing package_items query:');
    const packageItems = await prisma.package_items.findMany({
      take: 3,
      select: {
        id: true,
        package_id: true,
        software_id: true,
        software_version_id: true,
        order_index: true
      }
    });
    console.log(`✓ Successfully queried ${packageItems.length} package items`);
    console.table(packageItems);

    // 4. Test the compliance view
    console.log('\n4. Testing lpar_package_compliance view:');
    const compliance = await prisma.$queryRawUnsafe(`
      SELECT lpar_name, software_name, compliance_status
      FROM lpar_package_compliance
      LIMIT 5;
    `);
    console.log(`✓ Successfully queried ${compliance.length} compliance records`);
    console.table(compliance);

    console.log('\n✅ All verification checks passed!');

  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
