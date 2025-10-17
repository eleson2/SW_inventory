import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function applyViews() {
	console.log('📊 Applying database views and functions...');

	try {
		const sql = readFileSync(
			join(__dirname, 'migrations', 'add_views_and_functions.sql'),
			'utf-8'
		);

		// Split by statement and execute
		const statements = sql
			.split(/;\s*$/gm)
			.filter(s => s.trim() && !s.trim().startsWith('--') && !s.trim().startsWith('/*'));

		for (let i = 0; i < statements.length; i++) {
			const statement = statements[i].trim();
			if (statement) {
				try {
					console.log(`Executing statement ${i + 1}/${statements.length}...`);
					await prisma.$executeRawUnsafe(statement);
				} catch (error: any) {
					console.error(`Error in statement ${i + 1}:`, error.message);
					console.error('Statement:', statement.substring(0, 200));
				}
			}
		}

		console.log('✅ Views and functions applied successfully!');
	} catch (error) {
		console.error('❌ Error applying views:', error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

applyViews();
