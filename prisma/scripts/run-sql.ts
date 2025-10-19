import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function runSqlFile(filename: string) {
	console.log(`📄 Running ${filename}...`);

	try {
		const sql = readFileSync(join(__dirname, filename), 'utf-8');

		// Split SQL into individual statements and execute them separately
		const statements = sql
			.split(';')
			.map(s => s.trim())
			.filter(s => s.length > 0 && !s.startsWith('--'));

		for (const statement of statements) {
			if (statement) {
				await prisma.$executeRawUnsafe(statement);
			}
		}

		console.log(`✅ ${filename} executed successfully!`);
	} catch (error: any) {
		console.error(`❌ Error executing ${filename}:`, error.message);
		throw error;
	}
}

async function main() {
	const command = process.argv[2];

	try {
		switch (command) {
			case 'reset':
				await runSqlFile('reset.sql');
				break;

			case 'test-data':
				await runSqlFile('test-data.sql');
				break;

			case 'reset-and-load':
				await runSqlFile('reset.sql');
				await runSqlFile('test-data.sql');
				break;

			default:
				console.log(`
Usage:
  npx tsx prisma/scripts/run-sql.ts <command>

Commands:
  reset            - Empty all tables (preserves schema/views)
  test-data        - Load test data (requires empty tables)
  reset-and-load   - Reset then load test data (full refresh)

Examples:
  npx tsx prisma/scripts/run-sql.ts reset
  npx tsx prisma/scripts/run-sql.ts test-data
  npx tsx prisma/scripts/run-sql.ts reset-and-load
				`);
				process.exit(1);
		}
	} catch (error) {
		console.error('Failed to execute SQL script');
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main();
