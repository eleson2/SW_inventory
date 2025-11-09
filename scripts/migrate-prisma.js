/**
 * Simple migration script to replace local PrismaClient instantiations
 * with the shared prisma exported from src/lib/prisma.ts
 *
 * Usage:
 *   node scripts/migrate-prisma.js
 *
 * This script:
 *  - finds files under ./src with extensions .ts .js .svelte .tsx .jsx
 *  - when a file contains "new PrismaClient" it:
 *    - removes the "import { PrismaClient } from '@prisma/client';" line
 *    - removes the "const prisma = new PrismaClient(...)" declaration (single-line or simple multi-line)
 *    - ensures "import { prisma } from '$lib/prisma';" is present at top
 *
 * NOTE: review changes before committing. The script is conservative but may need manual fixes
 * for files that also import Prisma types from '@prisma/client'.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const projectRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(projectRoot, 'src');

const patterns = ['**/*.ts', '**/*.js', '**/*.svelte', '**/*.tsx', '**/*.jsx'];

function readFile(file) {
	return fs.readFileSync(file, 'utf8');
}

function writeFile(file, content) {
	fs.writeFileSync(file, content, 'utf8');
}

function backupFile(file) {
	const bak = `${file}.bak`;
	if (!fs.existsSync(bak)) {
		fs.copyFileSync(file, bak);
	}
}

function processFile(file) {
	let content = readFile(file);
	const original = content;

	if (!/new\s+PrismaClient/.test(content)) {
		return false; // nothing to do
	}

	// Remove import of PrismaClient from @prisma/client
	content = content.replace(
		/^[ \t]*import\s+\{\s*PrismaClient\s*(?:,\s*[^}]*)?\}\s+from\s+['"]@prisma\/client['"];?\s*$/m,
		''
	);

	// Remove simple instantiation: const prisma = new PrismaClient(...);
	// handle multi-line constructor args too (up to a reasonable depth)
	content = content.replace(
		/^[ \t]*(const|let|var)\s+prisma\s*=\s*new\s+PrismaClient\s*\([\s\S]*?\)\s*;?\s*$/m,
		''
	);

	// If file still references `PrismaClient` type imports (e.g. import type { Prisma } from ...),
	// we avoid altering those lines. The script only removed the direct import line above.
	// Ensure import { prisma } from '$lib/prisma'; exists
	if (!/from\s+['"]\$lib\/prisma['"]/.test(content)) {
		// try to insert after the last import statement at top
		const importMatches = [...content.matchAll(/^[ \t]*import .*?;[ \t]*$/gm)];
		if (importMatches.length > 0) {
			const last = importMatches[importMatches.length - 1];
			const insertPos = last.index + last[0].length;
			content = content.slice(0, insertPos) + '\nimport { prisma } from \'$lib/prisma\';\n' + content.slice(insertPos);
		} else {
			// no imports — prepend
			content = 'import { prisma } from \'$lib/prisma\';\n' + content;
		}
	}

	// Trim repeated blank lines at top
	content = content.replace(/^\s*\n/, '');

	if (content !== original) {
		backupFile(file);
		writeFile(file, content);
		console.log('Migrated:', path.relative(projectRoot, file));
		return true;
	}

	return false;
}

(async function main() {
	console.log('Searching for local PrismaClient instantiations under src/ ...');
	let changed = 0;
	for (const pat of patterns) {
		const matches = glob.sync(path.join(srcRoot, pat), { nodir: true, ignore: ['**/node_modules/**', '**/dist/**'] });
		for (const file of matches) {
			try {
				const ok = processFile(file);
				if (ok) changed++;
			} catch (err) {
				console.error('Error processing', file, err);
			}
		}
	}

	console.log(`Done. Files changed: ${changed}`);
	if (changed > 0) {
		console.log('Backups saved as *.bak next to modified files. Review and commit changes.');
	} else {
		console.log('No local PrismaClient instantiations found.');
	}
})();
