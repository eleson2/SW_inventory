import { PrismaClient } from '@prisma/client';
import { clearAllData } from '../lib/clear-data.ts';

const prisma = new PrismaClient();

async function reset() {
	console.log('🗑️  Resetting database...');

	try {
		console.log('Deleting all rows...');
		await clearAllData(prisma);

		// Refresh the Postgres-only materialized view if it exists
		if (!process.env.DATABASE_URL?.startsWith('file:')) {
			try {
				await prisma.$executeRaw`REFRESH MATERIALIZED VIEW lpar_dashboard`;
			} catch {
				console.log('   (materialized view not created)');
			}
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
