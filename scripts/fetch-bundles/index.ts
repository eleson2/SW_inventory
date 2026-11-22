/**
 * Fetch vendor maintenance bundle contents into a CSV for /import ("Import Vendor Bundle CSV").
 *
 *   npm run bundles:fetch -- ibm RSU2510
 *   npm run bundles:fetch -- broadcom CARS2510 --products AL2121,CCS150
 *   npm run bundles:fetch -- broadcom CARS2510            # product codes from the database
 *
 * Options:
 *   --products A,B      Broadcom product codes (product code + release, e.g. AL2121)
 *   --vendor-code CODE  Vendor code written to the CSV (default BROADCOM / IBM)
 *   --out DIR           Output directory (default bundles/)
 *
 * Runs locally only; the app itself never contacts vendor sites.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { levelYymm, toCsv } from './common.ts';
import { fetchCars, type FetchResult } from './broadcom.ts';
import { fetchRsu } from './ibm.ts';

const ROOT = resolve(import.meta.dirname, '../..');

function option(args: string[], name: string): string | undefined {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
}

/** Broadcom product codes recorded on the vendor's software (software.product_code). */
async function productCodesFromDatabase(vendorCode: string): Promise<string[]> {
	if (!process.env.DATABASE_URL && existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));
	const { PrismaClient } = await import('@prisma/client');
	const db = new PrismaClient();
	try {
		const software = await db.software.findMany({
			where: { active: true, product_code: { not: null }, vendors: { code: vendorCode } },
			select: { product_code: true }
		});
		return software.map((s) => s.product_code!);
	} finally {
		await db.$disconnect();
	}
}

async function main() {
	const args = process.argv.slice(2);
	const [vendor, level] = args;
	if (!vendor || !level || !['broadcom', 'ibm'].includes(vendor.toLowerCase())) {
		console.error('Usage: npm run bundles:fetch -- <broadcom|ibm> <LEVEL> [--products A,B] [--vendor-code CODE] [--out DIR]');
		process.exitCode = 1;
		return;
	}

	const yymm = levelYymm(level);
	const outDir = resolve(ROOT, option(args, '--out') ?? 'bundles');
	let result: FetchResult;
	let code: string;

	if (vendor.toLowerCase() === 'broadcom') {
		const vendorCode = option(args, '--vendor-code') ?? 'BROADCOM';
		code = `CARS${yymm}`;
		const products = option(args, '--products')?.split(',') ?? (await productCodesFromDatabase(vendorCode));
		if (products.length === 0) {
			throw new Error(
				`No product codes. Pass --products AL2121,... or set "Vendor Product Code" on ${vendorCode} software.`
			);
		}
		console.log(`Fetching ${code} service lists for ${products.length} product(s)...`);
		result = await fetchCars(yymm, products, vendorCode, console.log);
	} else {
		const vendorCode = option(args, '--vendor-code') ?? 'IBM';
		code = `RSU${yymm}`;
		console.log(`Fetching ${code}...`);
		result = await fetchRsu(yymm, vendorCode, console.log);
	}

	for (const warning of result.warnings) console.warn(`warning: ${warning}`);
	if (result.rows.length === 0) {
		console.error('No rows fetched; nothing written.');
		process.exitCode = 1;
		return;
	}

	mkdirSync(outDir, { recursive: true });
	const file = join(outDir, `${code}.csv`);
	writeFileSync(file, toCsv(result.rows));
	console.log(`Wrote ${result.rows.length} row(s) to ${file}`);
	console.log(`Next: npm run bundles:import -- ${file} --check   (then without --check)`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
