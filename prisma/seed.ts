import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	console.log('🌱 Starting database seed...');

	// Create vendors
	console.log('Creating vendors...');
	const ibm = await prisma.vendor.create({
		data: {
			name: 'IBM',
			code: 'IBM',
			website: 'https://www.ibm.com',
			contactEmail: 'support@ibm.com',
			active: true
		}
	});

	const broadcom = await prisma.vendor.create({
		data: {
			name: 'Broadcom',
			code: 'BROADCOM',
			website: 'https://www.broadcom.com',
			contactEmail: 'support@broadcom.com',
			active: true
		}
	});

	// Create customers
	console.log('Creating customers...');
	const acme = await prisma.customer.create({
		data: {
			name: 'Acme Corporation',
			code: 'ACME',
			description: 'Large manufacturing company',
			active: true
		}
	});

	const globex = await prisma.customer.create({
		data: {
			name: 'Globex Industries',
			code: 'GLOBEX',
			description: 'International conglomerate',
			active: true
		}
	});

	// Create software
	console.log('Creating software...');
	const cics = await prisma.software.create({
		data: {
			name: 'CICS Transaction Server',
			vendorId: ibm.id,
			description: 'Enterprise transaction processing system',
			currentVersion: 'V5R6M0',
			currentPtfLevel: 'PTF12345',
			versionHistory: [
				{ version: 'V5R5M0', ptfLevel: 'PTF11111' },
				{ version: 'V5R4M0', ptfLevel: 'PTF10000' }
			],
			active: true
		}
	});

	const db2 = await prisma.software.create({
		data: {
			name: 'DB2 for z/OS',
			vendorId: ibm.id,
			description: 'Relational database management system',
			currentVersion: 'V13R1M0',
			currentPtfLevel: 'PTF54321',
			versionHistory: [
				{ version: 'V12R1M0', ptfLevel: 'PTF50000' }
			],
			active: true
		}
	});

	const endevor = await prisma.software.create({
		data: {
			name: 'Endevor',
			vendorId: broadcom.id,
			description: 'Software change management system',
			currentVersion: 'V18R2M0',
			currentPtfLevel: 'SO12345',
			versionHistory: [
				{ version: 'V18R1M0', ptfLevel: 'SO11111' }
			],
			active: true
		}
	});

	// Create packages
	console.log('Creating packages...');
	const package2025Q1 = await prisma.package.create({
		data: {
			name: 'Mainframe Suite Q1 2025',
			code: 'MF-Q1-2025',
			version: '2025.1.0',
			description: 'Q1 2025 mainframe software package release',
			releaseDate: new Date('2025-01-15'),
			active: true,
			items: {
				create: [
					{
						softwareId: cics.id,
						version: 'V5R6M0',
						ptfLevel: 'PTF12345',
						required: true,
						orderIndex: 1
					},
					{
						softwareId: db2.id,
						version: 'V13R1M0',
						ptfLevel: 'PTF54321',
						required: true,
						orderIndex: 2
					},
					{
						softwareId: endevor.id,
						version: 'V18R2M0',
						ptfLevel: 'SO12345',
						required: false,
						orderIndex: 3
					}
				]
			}
		}
	});

	const package2024Q4 = await prisma.package.create({
		data: {
			name: 'Mainframe Suite Q4 2024',
			code: 'MF-Q4-2024',
			version: '2024.4.0',
			description: 'Q4 2024 mainframe software package release',
			releaseDate: new Date('2024-10-01'),
			active: true,
			items: {
				create: [
					{
						softwareId: cics.id,
						version: 'V5R5M0',
						ptfLevel: 'PTF11111',
						required: true,
						orderIndex: 1
					},
					{
						softwareId: db2.id,
						version: 'V12R1M0',
						ptfLevel: 'PTF50000',
						required: true,
						orderIndex: 2
					}
				]
			}
		}
	});

	// Create LPARs
	console.log('Creating LPARs...');
	const prodLpar1 = await prisma.lpar.create({
		data: {
			name: 'Production LPAR 1',
			code: 'PROD-LPAR-1',
			customerId: acme.id,
			description: 'Primary production LPAR for Acme Corporation',
			currentPackageId: package2025Q1.id,
			active: true,
			softwareInstalled: {
				create: [
					{
						softwareId: cics.id,
						currentVersion: 'V5R6M0',
						currentPtfLevel: 'PTF12345',
						previousVersion: 'V5R5M0',
						previousPtfLevel: 'PTF11111',
						installedDate: new Date('2025-01-20'),
						rolledBack: false
					},
					{
						softwareId: db2.id,
						currentVersion: 'V13R1M0',
						currentPtfLevel: 'PTF54321',
						previousVersion: 'V12R1M0',
						previousPtfLevel: 'PTF50000',
						installedDate: new Date('2025-01-20'),
						rolledBack: false
					},
					{
						softwareId: endevor.id,
						currentVersion: 'V18R2M0',
						currentPtfLevel: 'SO12345',
						installedDate: new Date('2025-01-22'),
						rolledBack: false
					}
				]
			}
		}
	});

	const testLpar1 = await prisma.lpar.create({
		data: {
			name: 'Test LPAR 1',
			code: 'TEST-LPAR-1',
			customerId: acme.id,
			description: 'Test environment for Acme Corporation',
			currentPackageId: package2024Q4.id,
			active: true,
			softwareInstalled: {
				create: [
					{
						softwareId: cics.id,
						currentVersion: 'V5R5M0',
						currentPtfLevel: 'PTF11111',
						installedDate: new Date('2024-10-15'),
						rolledBack: false
					},
					{
						softwareId: db2.id,
						currentVersion: 'V12R1M0',
						currentPtfLevel: 'PTF50000',
						installedDate: new Date('2024-10-15'),
						rolledBack: false
					}
				]
			}
		}
	});

	const globexProd = await prisma.lpar.create({
		data: {
			name: 'Globex Production',
			code: 'GLOBEX-PROD',
			customerId: globex.id,
			description: 'Production LPAR for Globex Industries',
			currentPackageId: package2025Q1.id,
			active: true,
			softwareInstalled: {
				create: [
					{
						softwareId: cics.id,
						currentVersion: 'V5R6M0',
						currentPtfLevel: 'PTF12345',
						installedDate: new Date('2025-01-25'),
						rolledBack: false
					},
					{
						softwareId: db2.id,
						currentVersion: 'V13R1M0',
						currentPtfLevel: 'PTF54321',
						installedDate: new Date('2025-01-25'),
						rolledBack: false
					}
				]
			}
		}
	});

	// Create audit logs
	console.log('Creating audit logs...');
	await prisma.auditLog.create({
		data: {
			entityType: 'lpar',
			entityId: prodLpar1.id,
			action: 'create',
			changes: {
				name: 'Production LPAR 1',
				code: 'PROD-LPAR-1',
				customerId: acme.id
			},
			timestamp: new Date()
		}
	});

	await prisma.auditLog.create({
		data: {
			entityType: 'lpar',
			entityId: prodLpar1.id,
			action: 'update',
			changes: {
				before: { packageId: package2024Q4.id },
				after: { packageId: package2025Q1.id }
			},
			timestamp: new Date('2025-01-20')
		}
	});

	console.log('✅ Seed data created successfully!');
	console.log('');
	console.log('📊 Summary:');
	console.log(`   - ${2} Vendors created`);
	console.log(`   - ${2} Customers created`);
	console.log(`   - ${3} Software products created`);
	console.log(`   - ${2} Packages created`);
	console.log(`   - ${3} LPARs created`);
	console.log(`   - ${2} Audit log entries created`);
	console.log('');
	console.log('🌐 View your data:');
	console.log('   - Prisma Studio: http://localhost:5556');
	console.log('   - Application: http://localhost:5173');
}

main()
	.catch((e) => {
		console.error('❌ Error seeding database:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
