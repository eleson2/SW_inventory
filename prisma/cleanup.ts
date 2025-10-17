import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
	console.log('🧹 Cleaning up database...');

	// Delete in correct order due to foreign key constraints
	await prisma.audit_log.deleteMany({});
	console.log('✓ Deleted audit logs');

	await prisma.lpar_software.deleteMany({});
	console.log('✓ Deleted LPAR software installations');

	await prisma.lpars.deleteMany({});
	console.log('✓ Deleted LPARs');

	await prisma.package_items.deleteMany({});
	console.log('✓ Deleted package items');

	await prisma.packages.deleteMany({});
	console.log('✓ Deleted packages');

	await prisma.software.deleteMany({});
	console.log('✓ Deleted software');

	await prisma.vendors.deleteMany({});
	console.log('✓ Deleted vendors');

	await prisma.customers.deleteMany({});
	console.log('✓ Deleted customers');

	console.log('✅ Database cleaned successfully!');
}

cleanup()
	.catch((e) => {
		console.error('❌ Error cleaning database:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
