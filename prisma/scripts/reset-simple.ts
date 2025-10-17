import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reset() {
	console.log('🗑️  Resetting database...');

	try {
		// Truncate in dependency order
		console.log('Truncating tables...');

		await prisma.$executeRaw`TRUNCATE TABLE audit_log CASCADE`;
		await prisma.$executeRaw`TRUNCATE TABLE lpar_software CASCADE`;
		await prisma.$executeRaw`TRUNCATE TABLE package_items CASCADE`;
		await prisma.$executeRaw`TRUNCATE TABLE lpars CASCADE`;
		await prisma.$executeRaw`TRUNCATE TABLE packages CASCADE`;
		await prisma.$executeRaw`TRUNCATE TABLE software_versions CASCADE`;
		await prisma.$executeRaw`TRUNCATE TABLE software CASCADE`;
		await prisma.$executeRaw`TRUNCATE TABLE customers CASCADE`;
		await prisma.$executeRaw`TRUNCATE TABLE vendors CASCADE`;

		// Refresh materialized view if it exists
		try {
			await prisma.$executeRaw`REFRESH MATERIALIZED VIEW lpar_dashboard`;
		} catch (error: any) {
			// View doesn't exist yet, that's OK
			console.log('   (materialized view not yet created)');
		}

		console.log('✅ Database reset successfully!');
		console.log('   All tables have been emptied');
		console.log('   Schema, views, and functions remain intact');
	} catch (error: any) {
		console.error('❌ Error resetting database:', error.message);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

reset();
