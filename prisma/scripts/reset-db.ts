import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🗑️  Resetting database...\n');

  try {
    // Delete in reverse order of dependencies
    console.log('Deleting lpar_software...');
    await prisma.lpar_software.deleteMany();

    console.log('Deleting package_items...');
    await prisma.package_items.deleteMany();

    console.log('Deleting software_versions...');
    await prisma.software_versions.deleteMany();

    console.log('Deleting software...');
    await prisma.software.deleteMany();

    console.log('Deleting lpars...');
    await prisma.lpars.deleteMany();

    console.log('Deleting packages...');
    await prisma.packages.deleteMany();

    console.log('Deleting customers...');
    await prisma.customers.deleteMany();

    console.log('Deleting vendors...');
    await prisma.vendors.deleteMany();

    console.log('Deleting audit_log...');
    await prisma.audit_log.deleteMany();

    console.log('\n✅ Database reset successfully!\n');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
