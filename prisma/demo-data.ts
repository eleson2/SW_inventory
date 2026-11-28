/**
 * Demo data: REPLACES everything in the database in DATABASE_URL with a realistic demo set.
 *
 *   npm run db:demo -- --replace
 *
 * Story (today = end of November 2026):
 * - 10 car-maker customers with 1-4 LPARs each; every customer with more than one LPAR has one DEV LPAR,
 *   which runs either the IBM or the Broadcom development tools (outside the packages).
 * - Catalog: z/OS stack from the real IBM CST RSU reports (prisma/demo/ibm-rsu.json: RSU2603, RSU2606,
 *   RSU2609, RSU2610), all OMEGAMON and SYSVIEW products, other Broadcom tools, a little BMC.
 *   Broadcom CARS levels (CARS2604/2607/2610/2611) are invented: real names, made-up PTF numbers.
 * - Inventory loaded on 20 April 2026. Package 2026.Q3 (defined 11 July, RSU2606 + CARS2607) rolled out
 *   to all LPARs in July/August; 2026.Q4 (defined 10 October, RSU2609 + CARS2610) on half the customers
 *   in October/November, planned (some overdue), initiated or cancelled on the rest.
 * - Rollbacks (open and resolved), an LPAR ahead of its package, LPARs behind it, BMC outside packages,
 *   releases out of support or ending soon (end-of-support dates are demo values).
 * - Users (password below) as customer, vendor and package editors; they appear as the acting user
 *   in the install history and audit log.
 */
import { existsSync, readFileSync } from 'node:fs';

if (!process.argv.includes('--replace')) {
	console.error('This replaces ALL data in the database in DATABASE_URL. Run: npm run db:demo -- --replace');
	process.exit(2);
}
if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');

const { db } = await import('../src/lib/server/db.ts');
const { configureDatabase } = await import('../src/lib/server/db-dialect.ts');
const { clearAllData } = await import('./lib/clear-data.ts');
const { recordInstallChanges } = await import('../src/lib/server/install-history.ts');
const { runWithUser } = await import('../src/lib/server/request-context.ts');
const { hashPassword } = await import('../src/lib/server/passwords.ts');
const { SUGGESTED_CATEGORIES } = await import('../src/lib/utils/software-category.ts');

type InstallChange = import('../src/lib/server/install-history.ts').InstallChange;

export const DEMO_PASSWORD = 'demo-pass-2026';

// ---------------------------------------------------------------- dates and levels

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const at = (s: string, hour = 9) => new Date(`${s}T${String(hour).padStart(2, '0')}:00:00Z`);
const addDays = (s: string, n: number) => new Date(day(s).getTime() + n * 86_400_000).toISOString().slice(0, 10);

interface RsuLevel {
	name: string;
	release_date: string;
	source_url: string;
	notes: string;
	rows: [code: string, name: string, version: string][];
}
const RSU: Record<string, RsuLevel> = JSON.parse(readFileSync(new URL('./demo/ibm-rsu.json', import.meta.url), 'utf8'));

/** Level index: 0 = inventory baseline, 1 = 2026.Q3, 2 = 2026.Q4, 3 = newest (in no package yet) */
const IBM_LEVELS = ['RSU2603', 'RSU2606', 'RSU2609', 'RSU2610'];
const CARS_LEVELS = [
	{ code: 'CARS2604', date: '2026-04-01' },
	{ code: 'CARS2607', date: '2026-07-01' },
	{ code: 'CARS2610', date: '2026-10-01' },
	{ code: 'CARS2611', date: '2026-11-02' }
];

// ---------------------------------------------------------------- catalog

type VendorCode = 'IBM' | 'BROADCOM' | 'BMC';
type Group = 'cst' | 'omegamon' | 'sysview' | 'broadcom' | 'dev-ibm' | 'dev-broadcom' | 'bmc';
interface Release {
	v: string;
	/** Vendor's notation (IBM CST report), when it differs */
	vendor?: string;
	eos?: string;
}
interface Product {
	key: string;
	vendor: VendorCode;
	name: string;
	code?: string;
	cat: string;
	group: Group;
	releases: Release[];
	/** Release installed at the baseline, in 2026.Q3 and in 2026.Q4 (no q3/q4: not in the packages) */
	base?: string;
	q3?: string;
	q4?: string;
	/** Broadcom: no new PTF from this level index on ("Unchanged since ...") */
	frozenFrom?: number;
}

const r = (v: string, eos?: string, vendor?: string): Release => ({ v, eos, vendor });
const all3 = (v: string) => ({ base: v, q3: v, q4: v });

const PRODUCTS: Product[] = [
	// IBM, from the CST report
	{ key: 'zos', vendor: 'IBM', name: 'z/OS', code: 'ZOS', cat: 'Operating system', group: 'cst',
		releases: [r('V2R5M0', '2026-09-30', 'V2R5'), r('V3R1M0', undefined, '3.1'), r('V3R2M0', undefined, '3.2')], ...all3('V3R1M0') },
	{ key: 'irlm', vendor: 'IBM', name: 'IRLM', code: 'IRLM', cat: 'Database', group: 'cst', releases: [r('V2R3M0', undefined, '2.3')], ...all3('V2R3M0') },
	{ key: 'db2', vendor: 'IBM', name: 'Db2 for z/OS', code: 'DB2', cat: 'Database', group: 'cst',
		releases: [r('V12R1M0', '2027-12-31', '12'), r('V13R1M0', undefined, '13')], ...all3('V13R1M0') },
	{ key: 'ims', vendor: 'IBM', name: 'IMS', code: 'IMS', cat: 'Database', group: 'cst',
		releases: [r('V15R3M0', '2026-11-30', '15.3'), r('V15R4M0', '2027-11-30', '15.4'), r('V15R5M0', undefined, '15.5'), r('V15R6M0', undefined, '15.6')],
		base: 'V15R4M0', q3: 'V15R5M0', q4: 'V15R5M0' },
	{ key: 'cics', vendor: 'IBM', name: 'CICS Transaction Server', code: 'CICSTS', cat: 'Transaction monitor', group: 'cst',
		releases: [r('V6R1M0', '2026-09-30', '6.1'), r('V6R2M0', '2027-09-30', '6.2'), r('V6R3M0', undefined, '6.3')],
		base: 'V6R2M0', q3: 'V6R2M0', q4: 'V6R3M0' },
	{ key: 'mq', vendor: 'IBM', name: 'IBM MQ for z/OS', code: 'IBMMQ', cat: 'Messaging and middleware', group: 'cst',
		releases: [r('V9R3M0', '2026-09-30', '9.3.0'), r('V9R4M0', undefined, '9.4.0'), r('V9R4M5', undefined, '9.4.5'), r('V10R0M0', undefined, '10.0.0')],
		...all3('V9R4M0') },
	{ key: 'was', vendor: 'IBM', name: 'WebSphere Application Server for z/OS', code: 'WEBSPHEREAPPLICATIONSERVERFORZOS', cat: 'Messaging and middleware', group: 'cst',
		releases: [r('V8R5M5', undefined, '8.5.5'), r('V9R0M5', undefined, '9.0.5')], ...all3('V9R0M5') },
	{ key: 'sdk64', vendor: 'IBM', name: 'IBM 64-bit SDK for z/OS, Java Technology Edition', code: 'IBM64BITSDKFORZOS', cat: 'Languages and compilers', group: 'cst',
		releases: [r('V8R0M0', undefined, '8')], ...all3('V8R0M0') },
	{ key: 'sdk31', vendor: 'IBM', name: 'IBM 31-bit SDK for z/OS, Java Technology Edition', code: 'IBM31BITSDKFORZOS', cat: 'Languages and compilers', group: 'cst',
		releases: [r('V8R0M0', undefined, '8')] },
	{ key: 'gdps', vendor: 'IBM', name: 'GDPS', code: 'GDPS', cat: 'Automation', group: 'cst',
		releases: [r('V4R6M0', undefined, '4.6.0'), r('V4R7M0', undefined, '4.7.0'), r('V4R8M0', undefined, '4.8.0')] },

	// IBM Z OMEGAMON (not in the CST report: service to the RSU level)
	{ key: 'om-zos', vendor: 'IBM', name: 'IBM Z OMEGAMON for z/OS', cat: 'Monitoring and performance', group: 'omegamon',
		releases: [r('V5R6M0', '2026-04-30'), r('V6R1M0')], base: 'V5R6M0', q3: 'V6R1M0', q4: 'V6R1M0' },
	{ key: 'om-cics', vendor: 'IBM', name: 'IBM Z OMEGAMON for CICS', cat: 'Monitoring and performance', group: 'omegamon',
		releases: [r('V5R6M0', '2027-04-30'), r('V6R1M0')], base: 'V5R6M0', q3: 'V5R6M0', q4: 'V6R1M0' },
	{ key: 'om-db2', vendor: 'IBM', name: 'IBM Z OMEGAMON for Db2 Performance Expert', cat: 'Monitoring and performance', group: 'omegamon',
		releases: [r('V5R4M0', '2025-12-31'), r('V5R5M0')], ...all3('V5R5M0') },
	{ key: 'om-ims', vendor: 'IBM', name: 'IBM Z OMEGAMON for IMS', cat: 'Monitoring and performance', group: 'omegamon',
		releases: [r('V5R4M0', '2025-12-31'), r('V5R5M0')], ...all3('V5R5M0') },
	{ key: 'om-mq', vendor: 'IBM', name: 'IBM Z OMEGAMON for Messaging', cat: 'Monitoring and performance', group: 'omegamon',
		releases: [r('V7R3M0', '2026-03-31'), r('V7R5M0')], base: 'V7R3M0', q3: 'V7R5M0', q4: 'V7R5M0' },
	{ key: 'om-net', vendor: 'IBM', name: 'IBM Z OMEGAMON Network Monitor', cat: 'Monitoring and performance', group: 'omegamon',
		releases: [r('V5R6M0', '2027-04-30'), r('V6R1M0')], base: 'V5R6M0', q3: 'V5R6M0', q4: 'V6R1M0' },
	{ key: 'om-stor', vendor: 'IBM', name: 'IBM Z OMEGAMON for Storage', cat: 'Monitoring and performance', group: 'omegamon',
		releases: [r('V5R4M0', '2025-12-31'), r('V5R5M0')], ...all3('V5R5M0') },
	{ key: 'om-jvm', vendor: 'IBM', name: 'IBM Z OMEGAMON for JVM', cat: 'Monitoring and performance', group: 'omegamon',
		releases: [r('V5R5M0', '2026-06-30'), r('V6R1M0')], base: 'V5R5M0', q3: 'V6R1M0', q4: 'V6R1M0' },

	// Broadcom SYSVIEW
	{ key: 'sv-pm', vendor: 'BROADCOM', name: 'SYSVIEW Performance Management', cat: 'Monitoring and performance', group: 'sysview',
		releases: [r('16.0', '2026-06-30'), r('17.0')], base: '16.0', q3: '17.0', q4: '17.0' },
	{ key: 'sv-cics', vendor: 'BROADCOM', name: 'SYSVIEW Performance Management Option for CICS', cat: 'Monitoring and performance', group: 'sysview',
		releases: [r('16.0', '2026-06-30'), r('17.0')], base: '16.0', q3: '17.0', q4: '17.0' },
	{ key: 'sv-ims', vendor: 'BROADCOM', name: 'SYSVIEW Performance Management Option for IMS', cat: 'Monitoring and performance', group: 'sysview',
		releases: [r('16.0', '2026-06-30'), r('17.0')], base: '16.0', q3: '17.0', q4: '17.0' },
	{ key: 'sv-mq', vendor: 'BROADCOM', name: 'SYSVIEW Performance Management Option for WebSphere MQ', cat: 'Monitoring and performance', group: 'sysview',
		releases: [r('16.0', '2026-06-30'), r('17.0')], base: '16.0', q3: '17.0', q4: '17.0' },
	{ key: 'sv-tcp', vendor: 'BROADCOM', name: 'SYSVIEW Performance Management Option for TCP/IP', cat: 'Monitoring and performance', group: 'sysview',
		releases: [r('16.0', '2026-06-30'), r('17.0')], base: '16.0', q3: '17.0', q4: '17.0' },
	{ key: 'sv-db2', vendor: 'BROADCOM', name: 'SYSVIEW for Db2', cat: 'Monitoring and performance', group: 'sysview',
		releases: [r('20.0', '2026-06-30'), r('21.0')], base: '20.0', q3: '21.0', q4: '21.0' },

	// Other Broadcom products in the packages
	{ key: 'ca7', vendor: 'BROADCOM', name: 'CA 7 Workload Automation', code: 'AL2121', cat: 'Scheduling', group: 'broadcom',
		releases: [r('12.1')], ...all3('12.1') },
	{ key: 'ca11', vendor: 'BROADCOM', name: 'CA 11 Workload Automation Restart and Tracking', cat: 'Scheduling', group: 'broadcom',
		releases: [r('12.0')], ...all3('12.0'), frozenFrom: 2 },
	{ key: 'ops', vendor: 'BROADCOM', name: 'OPS/MVS Event Management and Automation', cat: 'Automation', group: 'broadcom',
		releases: [r('13.5', '2026-03-31'), r('14.0')], base: '13.5', q3: '14.0', q4: '14.0' },
	{ key: 'view', vendor: 'BROADCOM', name: 'CA View', cat: 'Output management', group: 'broadcom', releases: [r('14.0')], ...all3('14.0') },
	{ key: 'dispatch', vendor: 'BROADCOM', name: 'CA Dispatch', cat: 'Output management', group: 'broadcom',
		releases: [r('11.7')], ...all3('11.7'), frozenFrom: 2 },
	{ key: 'disk', vendor: 'BROADCOM', name: 'CA Disk Backup and Restore', cat: 'Storage management', group: 'broadcom', releases: [r('14.0')], ...all3('14.0') },
	{ key: 'ca1', vendor: 'BROADCOM', name: 'CA 1 Tape Management', cat: 'Storage management', group: 'broadcom', releases: [r('14.0')], ...all3('14.0') },
	{ key: 'vantage', vendor: 'BROADCOM', name: 'Vantage Storage Resource Manager', cat: 'Storage management', group: 'broadcom', releases: [r('14.0')], ...all3('14.0') },
	{ key: 'netmaster', vendor: 'BROADCOM', name: 'NetMaster Network Management for TCP/IP', cat: 'Networking', group: 'broadcom', releases: [r('12.2')], ...all3('12.2') },

	// Development tools (DEV LPARs only, outside the packages)
	{ key: 'idz', vendor: 'IBM', name: 'IBM Developer for z/OS', cat: 'Development tools', group: 'dev-ibm', releases: [r('V16R0M0'), r('V17R0M0')] },
	{ key: 'debug', vendor: 'IBM', name: 'IBM z/OS Debugger', cat: 'Development tools', group: 'dev-ibm', releases: [r('V16R0M0'), r('V17R0M0')] },
	{ key: 'fm', vendor: 'IBM', name: 'IBM File Manager for z/OS', cat: 'Development tools', group: 'dev-ibm', releases: [r('V15R1M0', '2026-09-30'), r('V16R1M0')] },
	{ key: 'fa', vendor: 'IBM', name: 'IBM Fault Analyzer for z/OS', cat: 'Development tools', group: 'dev-ibm', releases: [r('V15R1M0', '2026-09-30'), r('V16R1M0')] },
	{ key: 'apa', vendor: 'IBM', name: 'IBM Application Performance Analyzer for z/OS', cat: 'Development tools', group: 'dev-ibm', releases: [r('V14R2M0'), r('V15R1M0')] },
	{ key: 'endevor', vendor: 'BROADCOM', name: 'Endevor', cat: 'Change management', group: 'dev-broadcom', releases: [r('18.1', '2026-03-31'), r('19.0')] },
	{ key: 'intertest', vendor: 'BROADCOM', name: 'InterTest for CICS', cat: 'Development tools', group: 'dev-broadcom', releases: [r('11.0')] },
	{ key: 'intertest-b', vendor: 'BROADCOM', name: 'InterTest Batch', cat: 'Development tools', group: 'dev-broadcom', releases: [r('11.0')] },
	{ key: 'fmp', vendor: 'BROADCOM', name: 'File Master Plus', cat: 'Development tools', group: 'dev-broadcom', releases: [r('11.0'), r('12.0')] },
	{ key: 'mat', vendor: 'BROADCOM', name: 'Mainframe Application Tuner', cat: 'Development tools', group: 'dev-broadcom', releases: [r('12.0')] },

	// BMC, installed by two customers themselves (outside the packages)
	{ key: 'mainview', vendor: 'BMC', name: 'MainView for z/OS', cat: 'Monitoring and performance', group: 'bmc', releases: [r('6.1')] },
	{ key: 'controlm', vendor: 'BMC', name: 'Control-M for z/OS', cat: 'Scheduling', group: 'bmc', releases: [r('9.0.21')] }
];
const P = Object.fromEntries(PRODUCTS.map((p) => [p.key, p])) as Record<string, Product>;
const IN_PACKAGES = PRODUCTS.filter((p) => p.q3 || p.q4);
const DEV_SUITE = { IBM: PRODUCTS.filter((p) => p.group === 'dev-ibm'), BROADCOM: PRODUCTS.filter((p) => p.group === 'dev-broadcom') };
const BROADCOM_PRODUCTS = PRODUCTS.filter((p) => p.vendor === 'BROADCOM');

const rel = (p: Product, v: string) => {
	const found = p.releases.find((x) => x.v === v);
	if (!found) throw new Error(`${p.name}: no release ${v}`);
	return found;
};
const levelIdx = (p: Product, idx: number) => (p.frozenFrom !== undefined && idx >= p.frozenFrom ? p.frozenFrom - 1 : idx);
function ptfOf(p: Product, idx: number): string | null {
	if (p.vendor === 'IBM') return IBM_LEVELS[idx];
	if (p.vendor === 'BMC') return null;
	const i = BROADCOM_PRODUCTS.indexOf(p);
	return `LU${21000 + levelIdx(p, idx) * 800 + i * 23}`;
}
const levelDate = (p: Product, idx: number) =>
	p.vendor === 'IBM' ? RSU[IBM_LEVELS[idx]].release_date : p.vendor === 'BROADCOM' ? CARS_LEVELS[levelIdx(p, idx)].date : '2025-11-14';
const supportedAt = (x: Release, date: string) => !x.eos || x.eos > date;

// ---------------------------------------------------------------- customers, LPARs, people

type Env = 'PROD' | 'TEST' | 'DEV' | 'DR';
interface CustomerSpec {
	code: string;
	name: string;
	description: string;
	pkg: 'Q3' | 'Q4';
	dev?: 'IBM' | 'BROADCOM';
	contact: string;
	lpars: [code: string, env: Env][];
}
const CUSTOMERS: CustomerSpec[] = [
	{ code: 'AUDI', name: 'Audi', description: 'Ingolstadt; two data centres', pkg: 'Q3', dev: 'IBM', contact: 'anna',
		lpars: [['AUDP1', 'PROD'], ['AUDT1', 'TEST'], ['AUDD1', 'DEV']] },
	{ code: 'BMW', name: 'BMW', description: 'Munich; largest customer', pkg: 'Q4', dev: 'IBM', contact: 'anna',
		lpars: [['BMWP1', 'PROD'], ['BMWP2', 'PROD'], ['BMWT1', 'TEST'], ['BMWD1', 'DEV']] },
	{ code: 'CITROEN', name: 'Citroen', description: 'Change freeze until Q1 2027', pkg: 'Q3', dev: 'BROADCOM', contact: 'anna',
		lpars: [['CITP1', 'PROD'], ['CITD1', 'DEV']] },
	{ code: 'FORD', name: 'Ford', description: 'Single production LPAR; z/OS upgrade pending', pkg: 'Q3', contact: 'erik', lpars: [['FORP1', 'PROD']] },
	{ code: 'MERCEDES', name: 'Mercedes-Benz', description: 'Stuttgart; DR site in Sindelfingen', pkg: 'Q4', dev: 'BROADCOM', contact: 'erik',
		lpars: [['MBZP1', 'PROD'], ['MBZP2', 'PROD'], ['MBZR1', 'DR'], ['MBZD1', 'DEV']] },
	{ code: 'NISSAN', name: 'Nissan', description: 'European operations', pkg: 'Q3', dev: 'IBM', contact: 'erik', lpars: [['NISP1', 'PROD'], ['NISD1', 'DEV']] },
	{ code: 'RENAULT', name: 'Renault', description: 'MQ upgrade waits for their application release', pkg: 'Q4', dev: 'BROADCOM', contact: 'sara',
		lpars: [['RENP1', 'PROD'], ['RENT1', 'TEST'], ['REND1', 'DEV']] },
	{ code: 'TESLA', name: 'Tesla', description: 'Runs its own BMC MainView', pkg: 'Q3', dev: 'BROADCOM', contact: 'sara', lpars: [['TSLP1', 'PROD'], ['TSLD1', 'DEV']] },
	{ code: 'TOYOTA', name: 'Toyota', description: 'European operations', pkg: 'Q4', dev: 'IBM', contact: 'sara',
		lpars: [['TOYP1', 'PROD'], ['TOYT1', 'TEST'], ['TOYD1', 'DEV']] },
	{ code: 'VOLVO', name: 'Volvo', description: 'Gothenburg; runs BMC Control-M and MainView alongside', pkg: 'Q4', dev: 'IBM', contact: 'sara',
		lpars: [['VOLP1', 'PROD'], ['VOLP2', 'PROD'], ['VOLT1', 'TEST'], ['VOLD1', 'DEV']] }
];

const USERS = [
	{ username: 'anna', display_name: 'Anna Berg', email: 'anna.berg@example.com' },
	{ username: 'erik', display_name: 'Erik Lund', email: 'erik.lund@example.com' },
	{ username: 'sara', display_name: 'Sara Nilsson', email: 'sara.nilsson@example.com' },
	{ username: 'olle', display_name: 'Olle Holm', email: 'olle.holm@example.com' },
	{ username: 'maja', display_name: 'Maja Ek', email: 'maja.ek@example.com' },
	{ username: 'pia', display_name: 'Pia Strand', email: 'pia.strand@example.com' },
	{ username: 'tom', display_name: 'Tom Viewer', email: 'tom.viewer@example.com' }
];

/** Baseline exceptions: LPAR code -> product key -> release */
const BASELINE_OVERRIDES: Record<string, Record<string, string>> = {
	FORP1: { zos: 'V2R5M0', cics: 'V6R1M0' },
	CITP1: { cics: 'V6R1M0' },
	CITD1: { cics: 'V6R1M0' },
	NISP1: { db2: 'V12R1M0' },
	NISD1: { db2: 'V12R1M0' },
	TSLP1: { db2: 'V12R1M0' },
	TSLD1: { db2: 'V12R1M0' }
};
/** Products left out of a package deployment (they stay behind): package -> LPAR code -> product keys */
const DEPLOY_SKIPS: Record<'Q3' | 'Q4', Record<string, string[]>> = {
	Q3: { FORP1: ['zos'] },
	Q4: { RENP1: ['mq'] }
};
/** 2026.Q4 on LPARs that do not have it installed */
type Plan = { stage: 'planned'; date: string } | { stage: 'initiated' } | { stage: 'cancelled'; on: string; notes: string };
const Q4_PLANS: Record<string, Plan> = {
	VOLP2: { stage: 'planned', date: '2026-12-05' },
	MBZR1: { stage: 'planned', date: '2026-11-20' }, // overdue
	AUDD1: { stage: 'planned', date: '2026-12-02' },
	AUDT1: { stage: 'planned', date: '2026-12-09' },
	AUDP1: { stage: 'planned', date: '2027-01-12' },
	TSLD1: { stage: 'planned', date: '2026-11-16' }, // overdue
	TSLP1: { stage: 'planned', date: '2026-12-14' },
	NISP1: { stage: 'initiated' },
	NISD1: { stage: 'initiated' },
	CITP1: { stage: 'cancelled', on: '2026-10-28', notes: 'Customer change freeze until Q1 2027' },
	CITD1: { stage: 'cancelled', on: '2026-10-28', notes: 'Customer change freeze until Q1 2027' }
};

/** Deployment date: DEV first, then TEST, then PROD/DR, spread over the customers */
const PHASE_START: Record<'Q3' | 'Q4', Record<Env, string>> = {
	Q3: { DEV: '2026-07-20', TEST: '2026-08-03', PROD: '2026-08-17', DR: '2026-08-17' },
	Q4: { DEV: '2026-10-19', TEST: '2026-10-26', PROD: '2026-11-02', DR: '2026-11-02' }
};
const DEPLOY_DATE_OVERRIDES: Record<string, string> = { BMWP2: '2026-11-16' };

// ---------------------------------------------------------------- build

/** All writes go through one transaction (one commit instead of thousands: SQLite syncs per commit) */
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
let q: Tx = db;

const ids = { vendor: {} as Record<string, string>, sw: {} as Record<string, string>, user: {} as Record<string, string>, cat: {} as Record<string, string> };
const audit = (entity_type: string, entity_id: string, action: string, changes: object, timestamp: Date, user?: string) =>
	q.audit_log.create({ data: { entity_type, entity_id, action, changes, timestamp, user_id: user ? ids.user[user] : null } });

type VersionRef = { id: string; version: string; ptf_level: string | null };
const versions = new Map<string, VersionRef>();
async function ver(p: Product, v: string, idx: number, vendorVersion?: string): Promise<VersionRef> {
	const release = rel(p, v);
	const ptf = ptfOf(p, idx);
	const key = `${p.key}|${v}|${ptf ?? ''}`;
	const known = versions.get(key);
	if (known) return known;
	const level = p.vendor === 'IBM' ? IBM_LEVELS[idx] : p.vendor === 'BROADCOM' ? CARS_LEVELS[levelIdx(p, idx)].code : null;
	const row = await q.software_versions.create({
		data: {
			software_id: ids.sw[p.key],
			version: v,
			vendor_version: vendorVersion ?? release.vendor ?? null,
			ptf_level: ptf,
			release_date: day(levelDate(p, idx)),
			end_of_support: release.eos ? day(release.eos) : null,
			release_notes:
				p.group === 'cst' ? `CST service level ${level}` : p.vendor === 'IBM' ? `Service to ${level} level`
				: p.vendor === 'BROADCOM' ? `${level} (demo data: invented PTF number)` : null
		}
	});
	const ref = { id: row.id, version: v, ptf_level: ptf };
	versions.set(key, ref);
	return ref;
}

async function build() {

	// People
	const hash = await hashPassword(DEMO_PASSWORD);
	for (const u of USERS) {
		const row = await q.users.create({ data: { ...u, password_hash: hash, created_at: day('2026-03-02') } });
		ids.user[u.username] = row.id;
	}

	// Vendors and categories
	for (const [code, name, website] of [
		['IBM', 'IBM', 'https://www.ibm.com'],
		['BROADCOM', 'Broadcom', 'https://www.broadcom.com'],
		['BMC', 'BMC Software', 'https://www.bmc.com']
	]) {
		ids.vendor[code] = (await q.vendors.create({ data: { code, name, website, created_at: day('2026-01-12') } })).id;
	}
	for (const name of [...SUGGESTED_CATEGORIES, 'Messaging and middleware', 'Development tools']) {
		ids.cat[name] = (await q.software_categories.create({ data: { name } })).id;
	}

	// Products
	for (const p of PRODUCTS) {
		const row = await q.software.create({
			data: {
				name: p.name,
				vendor_id: ids.vendor[p.vendor],
				product_code: p.code ?? null,
				category_id: ids.cat[p.cat],
				created_at: day('2026-04-20')
			}
		});
		ids.sw[p.key] = row.id;
	}

	// Vendor levels. IBM: the real CST reports
	const bundles: Record<string, string> = {};
	for (const [idx, code] of IBM_LEVELS.entries()) {
		const level = RSU[code];
		const bundle = await q.vendor_bundles.create({
			data: {
				vendor_id: ids.vendor.IBM, code, name: level.name, bundle_type: 'RSU', release_date: day(level.release_date),
				description: level.notes, source_url: level.source_url, created_at: at(addDays(level.release_date, 1))
			}
		});
		bundles[code] = bundle.id;
		const seen = new Set<string>();
		for (const [productCode, , raw] of level.rows) {
			const p = PRODUCTS.find((x) => x.code === productCode);
			const release = p?.releases.find((x) => x.vendor === raw || raw.startsWith(`${x.vendor}.`));
			if (!p || !release) throw new Error(`${code}: ${productCode} ${raw} is not in the demo catalog`);
			const v = await ver(p, release.v, idx, raw);
			if (seen.has(v.id)) continue;
			seen.add(v.id);
			await q.vendor_bundle_items.create({ data: { bundle_id: bundle.id, software_id: ids.sw[p.key], software_version_id: v.id, notes: level.notes } });
		}
		await audit('vendor_bundle', bundle.id, 'create', { code, items: seen.size, source: 'bundles:fetch ibm' }, at(addDays(level.release_date, 1), 8), 'olle');
	}
	// Broadcom: invented levels, complete (every supported release of every Broadcom product)
	for (const [idx, level] of CARS_LEVELS.entries()) {
		const bundle = await q.vendor_bundles.create({
			data: {
				vendor_id: ids.vendor.BROADCOM, code: level.code, name: `Broadcom CA RS ${level.code.slice(4)}`, bundle_type: 'CARS',
				release_date: day(level.date), description: 'Demo data: real product names, invented PTF numbers', created_at: at(addDays(level.date, 2))
			}
		});
		bundles[level.code] = bundle.id;
		let n = 0;
		for (const p of BROADCOM_PRODUCTS) {
			for (const release of p.releases.filter((x) => supportedAt(x, level.date))) {
				const v = await ver(p, release.v, idx);
				const unchanged = levelIdx(p, idx) < idx;
				await q.vendor_bundle_items.create({
					data: {
						bundle_id: bundle.id, software_id: ids.sw[p.key], software_version_id: v.id,
						notes: unchanged ? `Unchanged since ${CARS_LEVELS[levelIdx(p, idx)].code}` : `${level.code}: highest ${v.ptf_level}`
					}
				});
				n++;
			}
		}
		await audit('vendor_bundle', bundle.id, 'create', { code: level.code, items: n }, at(addDays(level.date, 2), 8), 'maja');
	}

	// Packages
	const packages: Record<'Q3' | 'Q4', string> = { Q3: '', Q4: '' };
	for (const [key, idx, defined, rsu, cars] of [
		['Q3', 1, '2026-07-11', 'RSU2606', 'CARS2607'],
		['Q4', 2, '2026-10-10', 'RSU2609', 'CARS2610']
	] as const) {
		const pkg = await q.packages.create({
			data: {
				code: `2026-${key}`, name: `2026.${key}`, version: `2026.${key.slice(1)}`, release_date: day(defined), created_at: at(defined, 14),
				description: `Quarterly maintenance package: IBM ${rsu} and Broadcom ${cars} (the newest levels on ${defined}), OMEGAMON serviced to ${rsu}`
			}
		});
		packages[key] = pkg.id;
		let order = 0;
		for (const p of IN_PACKAGES) {
			const v = await ver(p, key === 'Q3' ? p.q3! : p.q4!, idx);
			const inBundle = p.group === 'cst' || p.vendor === 'BROADCOM';
			await q.package_items.create({
				data: {
					package_id: pkg.id, software_id: ids.sw[p.key], software_version_id: v.id, order_index: ++order,
					source_bundle_id: inBundle ? bundles[p.vendor === 'IBM' ? rsu : cars] : null, created_at: at(defined, 14)
				}
			});
		}
		await audit('package', pkg.id, 'create', { code: pkg.code, name: pkg.name, items: order, bundles: [rsu, cars] }, at(defined, 14), 'pia');
	}

	// Customers and LPARs
	const lpars: { id: string; code: string; env: Env; customer: CustomerSpec; ci: number }[] = [];
	for (const [ci, c] of CUSTOMERS.entries()) {
		const customer = await q.customers.create({ data: { code: c.code, name: c.name, description: c.description, created_at: day('2026-01-12') } });
		(c as CustomerSpec & { id?: string }).id = customer.id;
		for (const [code, env] of c.lpars) {
			const row = await q.lpars.create({
				data: {
					code, name: `${c.name} ${env === 'PROD' ? 'production' : env === 'DR' ? 'disaster recovery' : env === 'TEST' ? 'test' : 'development'} ${code.slice(-1)}`,
					customer_id: customer.id, environment: env, created_at: day('2026-03-02')
				}
			});
			lpars.push({ id: row.id, code, env, customer: c, ci });
		}
	}
	const customerId = (c: CustomerSpec) => (c as CustomerSpec & { id: string }).id;

	// Editors and roles
	const role = (user: string, roleName: string, scope_type: string | null = null, scope_id: string | null = null, is_contact = false) =>
		q.user_roles.create({ data: { user_id: ids.user[user], role: roleName, scope_type, scope_id, is_contact, created_at: day('2026-03-02') } });
	for (const c of CUSTOMERS) await role(c.contact, 'editor', 'customer', customerId(c), true);
	await role('erik', 'editor', 'customer', customerId(CUSTOMERS[0])); // second editor of Audi
	await role('olle', 'editor', 'vendor', ids.vendor.IBM, true);
	await role('maja', 'editor', 'vendor', ids.vendor.BROADCOM, true);
	await role('maja', 'editor', 'vendor', ids.vendor.BMC, true);
	await role('pia', 'package_creator');
	for (const id of Object.values(packages)) await role('pia', 'editor', 'package', id, true);

	// ------------------------------------------------------------ install history
	type Row = Awaited<ReturnType<typeof db.lpar_software.create>>;
	const installs = new Map<string, Row>();
	interface Change { lpar: string; p: Product; to: VersionRef | null; rollback?: boolean; reason?: string }
	async function apply(list: Change[], when: Date, source: string, packageId: string | null, user: string | null) {
		const changes: InstallChange[] = [];
		for (const c of list) {
			const key = `${c.lpar}|${c.p.key}`;
			const before = installs.get(key) ?? null;
			const to = c.to ? { version: c.to.version, ptf_level: c.to.ptf_level } : null;
			if (before && to && before.current_version === to.version && (before.current_ptf_level ?? null) === to.ptf_level) continue;
			if (!to) {
				if (!before) continue;
				await q.lpar_software.delete({ where: { id: before.id } });
				installs.delete(key);
			} else if (!before) {
				installs.set(key, await q.lpar_software.create({
					data: { lpar_id: c.lpar, software_id: ids.sw[c.p.key], current_version: to.version, current_ptf_level: to.ptf_level, installed_date: when }
				}));
			} else {
				const moved = { current_version: to.version, current_ptf_level: to.ptf_level, previous_version: before.current_version, previous_ptf_level: before.current_ptf_level };
				installs.set(key, await q.lpar_software.update({
					where: { id: before.id },
					data: c.rollback
						? { ...moved, rolled_back: true, rolled_back_at: when, rollback_reason: c.reason }
						: { ...moved, installed_date: when, rolled_back: false, rolled_back_at: null, rollback_reason: null }
				}));
			}
			changes.push({ lpar_id: c.lpar, software_id: ids.sw[c.p.key], before, to, at: when, rollback: c.rollback, reason: c.reason ?? null });
		}
		await runWithUser(user ? ids.user[user] : null, () => recordInstallChanges(q as never, changes, source as never, packageId));
		return changes;
	}

	// 1. Inventory loaded on 20 April 2026
	for (const l of lpars) {
		const list: Change[] = [];
		for (const p of IN_PACKAGES) list.push({ lpar: l.id, p, to: await ver(p, BASELINE_OVERRIDES[l.code]?.[p.key] ?? p.base!, 0) });
		if (l.env === 'DEV' && l.customer.dev) {
			for (const p of DEV_SUITE[l.customer.dev]) list.push({ lpar: l.id, p, to: await ver(p, p.releases[0].v, 0) });
		}
		if (l.code === 'TSLP1' || l.code === 'VOLP1' || l.code === 'VOLP2') list.push({ lpar: l.id, p: P.mainview, to: await ver(P.mainview, '6.1', 0) });
		if (l.code === 'VOLP1' || l.code === 'VOLP2') list.push({ lpar: l.id, p: P.controlm, to: await ver(P.controlm, '9.0.21', 0) });
		await apply(list, at('2026-04-20', 8), 'import', null, null);
	}

	// 2. Package deployments (rollouts recorded alongside)
	const deployDate = (key: 'Q3' | 'Q4', l: (typeof lpars)[number]) =>
		at((key === 'Q4' && DEPLOY_DATE_OVERRIDES[l.code]) || addDays(PHASE_START[key][l.env], l.ci % 5), 9 + (l.ci % 3) * 2);
	const installedAt: Record<'Q3' | 'Q4', Map<string, Date>> = { Q3: new Map(), Q4: new Map() };
	async function deploy(key: 'Q3' | 'Q4', l: (typeof lpars)[number]) {
		const when = deployDate(key, l);
		const skips = DEPLOY_SKIPS[key][l.code] ?? [];
		const list: Change[] = [];
		for (const p of IN_PACKAGES.filter((x) => !skips.includes(x.key))) {
			list.push({ lpar: l.id, p, to: await ver(p, key === 'Q3' ? p.q3! : p.q4!, key === 'Q3' ? 1 : 2) });
		}
		await apply(list, when, 'deploy', packages[key], l.customer.contact);
		installedAt[key].set(l.id, when);
	}
	const rollback = async (code: string, p: Product, to: VersionRef, date: string, reason: string, user: string) => {
		const l = lpars.find((x) => x.code === code)!;
		const before = installs.get(`${l.id}|${p.key}`)!;
		const when = at(date, 15);
		await apply([{ lpar: l.id, p, to, rollback: true, reason }], when, 'rollback', null, user);
		await audit('lpar_software', l.id, 'rollback', {
			software_id: ids.sw[p.key], from_version: before.current_version, from_ptf: before.current_ptf_level,
			to_version: to.version, to_ptf: to.ptf_level, reason
		}, when, user);
	};

	for (const l of [...lpars].sort((a, b) => deployDate('Q3', a).getTime() - deployDate('Q3', b).getTime())) await deploy('Q3', l);

	// 3. Summer rollbacks: Audi's is still open, Toyota's is fixed by 2026.Q4
	await rollback('AUDP1', P['sv-pm'], await ver(P['sv-pm'], '16.0', 0), '2026-08-26',
		'SYSVIEW 17.0 main task abends (S0C4) at startup with our exits; back on 16.0 until Broadcom ships a fix', 'anna');
	await rollback('TOYP1', P.db2, await ver(P.db2, 'V13R1M0', 0), '2026-08-27',
		'Access path regression in the nightly batch after RSU2606 (IBM case TS018833412); back on RSU2603 until the APAR is in', 'sara');

	// 4. Development tools upgraded in September; Audi's test LPAR runs OMEGAMON for CICS 6.1 ahead of its package
	for (const l of lpars.filter((x) => x.env === 'DEV' && x.customer.dev)) {
		const list: Change[] = [];
		for (const p of DEV_SUITE[l.customer.dev!]) list.push({ lpar: l.id, p, to: await ver(p, p.releases.at(-1)!.v, 1) });
		await apply(list, at(addDays('2026-09-14', l.ci % 5), 10), 'lpar_edit', null, l.customer.contact);
	}
	{
		const l = lpars.find((x) => x.code === 'AUDT1')!;
		await apply([{ lpar: l.id, p: P['om-cics'], to: await ver(P['om-cics'], 'V6R1M0', 2), reason: 'Needs the CICS 6.2 monitoring fix before 2026.Q4' }],
			at('2026-10-20', 11), 'lpar_edit', null, 'anna');
	}

	// 5. 2026.Q4 on the Q4 customers (except the LPARs still planned)
	const q4Lpars = lpars.filter((l) => l.customer.pkg === 'Q4' && !Q4_PLANS[l.code]);
	for (const l of q4Lpars.sort((a, b) => deployDate('Q4', a).getTime() - deployDate('Q4', b).getTime())) await deploy('Q4', l);

	// 6. Autumn rollbacks, both still open
	await rollback('MBZP1', P['sv-db2'], await ver(P['sv-db2'], '21.0', 1), '2026-11-09',
		'Thread display empty after the CARS2610 PTF (Broadcom case 35012345); back on the CARS2607 level', 'erik');
	await rollback('BMWP1', P.cics, await ver(P.cics, 'V6R2M0', 1), '2026-11-12',
		'Storage violations in region CICSPRD3 after the 6.3 upgrade (IBM case TS019284736); back on 6.2 while IBM investigates', 'anna');

	// ------------------------------------------------------------ rollouts (lifecycle per LPAR)
	for (const l of lpars) {
		const q3 = installedAt.Q3.get(l.id)!;
		const q4 = installedAt.Q4.get(l.id);
		const user = l.customer.contact;
		const q3Row = await q.lpar_package_rollouts.create({
			data: {
				lpar_id: l.id, package_id: packages.Q3, stage: q4 ? 'superseded' : 'installed', planned_date: day(q3.toISOString().slice(0, 10)),
				initiated_at: at('2026-07-14'), installed_at: q3, superseded_at: q4 ?? null, created_at: at('2026-07-14')
			}
		});
		await audit('lpar_package_rollout', q3Row.id, 'create', { lpar_id: l.id, package_id: packages.Q3, stage: 'planned', planned_date: q3.toISOString().slice(0, 10) }, at('2026-07-14'), user);
		await audit('lpar_package_rollout', q3Row.id, 'update', { lpar_id: l.id, package_id: packages.Q3, from: 'planned', to: 'installed' }, q3, user);

		const plan = Q4_PLANS[l.code];
		if (!q4 && !plan) continue; // Ford: nothing planned yet
		const initiated = at('2026-10-13');
		const data =
			q4 ? { stage: 'installed', planned_date: day(q4.toISOString().slice(0, 10)), installed_at: q4 }
			: plan.stage === 'planned' ? { stage: 'planned', planned_date: day(plan.date) }
			: plan.stage === 'cancelled' ? { stage: 'cancelled', cancelled_at: at(plan.on), notes: plan.notes }
			: { stage: 'initiated' };
		const q4Row = await q.lpar_package_rollouts.create({ data: { lpar_id: l.id, package_id: packages.Q4, initiated_at: initiated, created_at: initiated, ...data } });
		await audit('lpar_package_rollout', q4Row.id, 'create', { lpar_id: l.id, package_id: packages.Q4, stage: plan?.stage === 'initiated' ? 'initiated' : 'planned' }, initiated, user);
		if (q4) await audit('lpar_package_rollout', q4Row.id, 'update', { lpar_id: l.id, package_id: packages.Q4, from: 'planned', to: 'installed' }, q4, user);
		if (plan?.stage === 'cancelled') await audit('lpar_package_rollout', q4Row.id, 'update', { lpar_id: l.id, package_id: packages.Q4, from: 'planned', to: 'cancelled', notes: plan.notes }, at(plan.on), user);
	}
	for (const l of lpars) {
		await q.lpars.update({ where: { id: l.id }, data: { current_package_id: installedAt.Q4.has(l.id) ? packages.Q4 : packages.Q3 } });
	}

	// ------------------------------------------------------------ current versions
	// Packaged products: the 2026.Q4 level; others: their newest release at the newest level
	for (const p of PRODUCTS) {
		const target = p.q4 ? await ver(p, p.q4, 2) : await ver(p, p.releases.at(-1)!.v, p.vendor === 'BMC' ? 0 : 3);
		await q.software_versions.update({ where: { id: target.id }, data: { is_current: true } });
		await q.software.update({ where: { id: ids.sw[p.key] }, data: { current_version_id: target.id } });
	}

	// ------------------------------------------------------------ LPAR sets
	const set = async (name: string, description: string, codes: string[]) =>
		q.lpar_sets.create({
			data: { name, description, members: { create: codes.map((code) => ({ lpar_id: lpars.find((l) => l.code === code)!.id })) } }
		});
	await set('Q4 pilot', 'Test LPARs that take a new package first', ['BMWT1', 'TOYT1', 'VOLT1', 'RENT1']);
	await set('German production', 'Production LPARs of the German customers', ['AUDP1', 'BMWP1', 'BMWP2', 'MBZP1', 'MBZP2']);

	const counts = {
		customers: CUSTOMERS.length,
		lpars: lpars.length,
		products: PRODUCTS.length,
		versions: versions.size,
		bundles: Object.keys(bundles).length,
		installs: installs.size,
		history: await q.lpar_software_history.count(),
		rollouts: await q.lpar_package_rollouts.count(),
		users: USERS.length
	};
	console.log('Demo data loaded:', Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', '));
	console.log(`Logins (password "${DEMO_PASSWORD}"): ${USERS.map((u) => u.username).join(', ')}; the .env admin works as always.`);
}

try {
	console.log(`Replacing all data in ${process.env.DATABASE_URL?.replace(/\/\/[^@]*@/, '//***@')}`);
	await configureDatabase(db); // SQLite: WAL before the long transaction
	await clearAllData(db);
	await db.$transaction(async (tx) => {
		q = tx;
		await build();
	}, { maxWait: 60_000, timeout: 3_600_000 });
} finally {
	await db.$disconnect();
}
