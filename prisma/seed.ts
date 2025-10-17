import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	console.log('🌱 Starting database seed...');

	// Create vendors
	console.log('Creating vendors...');
	const ibm = await prisma.vendors.create({
		data: {
			name: 'IBM',
			code: 'IBM',
			website: 'https://www.ibm.com',
			contact_email: 'support@ibm.com',
			active: true,
			created_at: new Date()
		}
	});

	const broadcom = await prisma.vendors.create({
		data: {
			name: 'Broadcom',
			code: 'BROADCOM',
			website: 'https://www.broadcom.com',
			contact_email: 'support@broadcom.com',
			active: true,
			created_at: new Date()
		}
	});

	// Create customers
	console.log('Creating customers...');
	const acme = await prisma.customers.create({
		data: {
			name: 'Acme Corporation',
			code: 'ACME',
			description: 'Large manufacturing company',
			active: true,
			created_at: new Date()
		}
	});

	const globex = await prisma.customers.create({
		data: {
			name: 'Globex Industries',
			code: 'GLOBEX',
			description: 'International conglomerate',
			active: true,
			created_at: new Date()
		}
	});

	// Create software products (without versions yet)
	console.log('Creating software products...');
	const cics = await prisma.software.create({
		data: {
			name: 'CICS Transaction Server',
			vendor_id: ibm.id,
			description: 'Enterprise transaction processing system',
			active: true,
			created_at: new Date()
		}
	});

	const db2 = await prisma.software.create({
		data: {
			name: 'DB2 for z/OS',
			vendor_id: ibm.id,
			description: 'Relational database management system',
			active: true,
			created_at: new Date()
		}
	});

	const endevor = await prisma.software.create({
		data: {
			name: 'Endevor',
			vendor_id: broadcom.id,
			description: 'Software change management system',
			active: true,
			created_at: new Date()
		}
	});

	// Create software versions
	console.log('Creating software versions...');

	// CICS versions
	const cicsV5R4M0 = await prisma.software_versions.create({
		data: {
			software_id: cics.id,
			version: 'V5R4M0',
			ptf_level: 'PTF10000',
			release_date: new Date('2023-03-01'),
			release_notes: 'CICS TS 5.4 - Baseline release',
			is_current: false,
			created_at: new Date()
		}
	});

	const cicsV5R5M0 = await prisma.software_versions.create({
		data: {
			software_id: cics.id,
			version: 'V5R5M0',
			ptf_level: 'PTF11111',
			release_date: new Date('2024-06-15'),
			release_notes: 'CICS TS 5.5 - Enhanced security features',
			is_current: false,
			created_at: new Date()
		}
	});

	const cicsV5R6M0 = await prisma.software_versions.create({
		data: {
			software_id: cics.id,
			version: 'V5R6M0',
			ptf_level: 'PTF12345',
			release_date: new Date('2025-01-10'),
			release_notes: 'CICS TS 5.6 - Performance improvements and cloud integration',
			is_current: true,
			created_at: new Date()
		}
	});

	// DB2 versions
	const db2V12R1M0 = await prisma.software_versions.create({
		data: {
			software_id: db2.id,
			version: 'V12R1M0',
			ptf_level: 'PTF50000',
			release_date: new Date('2023-09-01'),
			release_notes: 'DB2 12 - Baseline release',
			is_current: false,
			created_at: new Date()
		}
	});

	const db2V13R1M0 = await prisma.software_versions.create({
		data: {
			software_id: db2.id,
			version: 'V13R1M0',
			ptf_level: 'PTF54321',
			release_date: new Date('2025-01-05'),
			release_notes: 'DB2 13 - AI-powered query optimization',
			is_current: true,
			created_at: new Date()
		}
	});

	// Endevor versions
	const endevorV18R1M0 = await prisma.software_versions.create({
		data: {
			software_id: endevor.id,
			version: 'V18R1M0',
			ptf_level: 'SO11111',
			release_date: new Date('2024-04-01'),
			release_notes: 'Endevor 18.1 - DevOps integration',
			is_current: false,
			created_at: new Date()
		}
	});

	const endevorV18R2M0 = await prisma.software_versions.create({
		data: {
			software_id: endevor.id,
			version: 'V18R2M0',
			ptf_level: 'SO12345',
			release_date: new Date('2025-01-08'),
			release_notes: 'Endevor 18.2 - Enhanced Git bridge and API improvements',
			is_current: true,
			created_at: new Date()
		}
	});

	// Update software to point to current versions
	await prisma.software.update({
		where: { id: cics.id },
		data: { current_version_id: cicsV5R6M0.id }
	});

	await prisma.software.update({
		where: { id: db2.id },
		data: { current_version_id: db2V13R1M0.id }
	});

	await prisma.software.update({
		where: { id: endevor.id },
		data: { current_version_id: endevorV18R2M0.id }
	});

	// Create packages
	console.log('Creating packages...');
	const package2025Q1 = await prisma.packages.create({
		data: {
			name: 'Mainframe Suite Q1 2025',
			code: 'MF-Q1-2025',
			version: '2025.1.0',
			description: 'Q1 2025 mainframe software package release',
			release_date: new Date('2025-01-15'),
			active: true,
			created_at: new Date(),
			package_items: {
				create: [
					{
						software_id: cics.id,
						software_version_id: cicsV5R6M0.id,
						required: true,
						order_index: 1,
						created_at: new Date()
					},
					{
						software_id: db2.id,
						software_version_id: db2V13R1M0.id,
						required: true,
						order_index: 2,
						created_at: new Date()
					},
					{
						software_id: endevor.id,
						software_version_id: endevorV18R2M0.id,
						required: false,
						order_index: 3,
						created_at: new Date()
					}
				]
			}
		}
	});

	const package2024Q4 = await prisma.packages.create({
		data: {
			name: 'Mainframe Suite Q4 2024',
			code: 'MF-Q4-2024',
			version: '2024.4.0',
			description: 'Q4 2024 mainframe software package release',
			release_date: new Date('2024-10-01'),
			active: true,
			created_at: new Date(),
			package_items: {
				create: [
					{
						software_id: cics.id,
						software_version_id: cicsV5R5M0.id,
						required: true,
						order_index: 1,
						created_at: new Date()
					},
					{
						software_id: db2.id,
						software_version_id: db2V12R1M0.id,
						required: true,
						order_index: 2,
						created_at: new Date()
					}
				]
			}
		}
	});

	// Create LPARs
	console.log('Creating LPARs...');
	const prodLpar1 = await prisma.lpars.create({
		data: {
			name: 'Production LPAR 1',
			code: 'PROD-LPAR-1',
			customer_id: acme.id,
			description: 'Primary production LPAR for Acme Corporation',
			current_package_id: package2025Q1.id,
			active: true,
			created_at: new Date(),
			lpar_software: {
				create: [
					{
						software_id: cics.id,
						current_version: 'V5R6M0',
						current_ptf_level: 'PTF12345',
						previous_version: 'V5R5M0',
						previous_ptf_level: 'PTF11111',
						installed_date: new Date('2025-01-20'),
						rolled_back: false
					},
					{
						software_id: db2.id,
						current_version: 'V13R1M0',
						current_ptf_level: 'PTF54321',
						previous_version: 'V12R1M0',
						previous_ptf_level: 'PTF50000',
						installed_date: new Date('2025-01-20'),
						rolled_back: false
					},
					{
						software_id: endevor.id,
						current_version: 'V18R2M0',
						current_ptf_level: 'SO12345',
						installed_date: new Date('2025-01-22'),
						rolled_back: false
					}
				]
			}
		}
	});

	const testLpar1 = await prisma.lpars.create({
		data: {
			name: 'Test LPAR 1',
			code: 'TEST-LPAR-1',
			customer_id: acme.id,
			description: 'Test environment for Acme Corporation',
			current_package_id: package2024Q4.id,
			active: true,
			created_at: new Date(),
			lpar_software: {
				create: [
					{
						software_id: cics.id,
						current_version: 'V5R5M0',
						current_ptf_level: 'PTF11111',
						installed_date: new Date('2024-10-15'),
						rolled_back: false
					},
					{
						software_id: db2.id,
						current_version: 'V12R1M0',
						current_ptf_level: 'PTF50000',
						installed_date: new Date('2024-10-15'),
						rolled_back: false
					}
				]
			}
		}
	});

	const globexProd = await prisma.lpars.create({
		data: {
			name: 'Globex Production',
			code: 'GLOBEX-PROD',
			customer_id: globex.id,
			description: 'Production LPAR for Globex Industries',
			current_package_id: package2025Q1.id,
			active: true,
			created_at: new Date(),
			lpar_software: {
				create: [
					{
						software_id: cics.id,
						current_version: 'V5R6M0',
						current_ptf_level: 'PTF12345',
						installed_date: new Date('2025-01-25'),
						rolled_back: false
					},
					{
						software_id: db2.id,
						current_version: 'V13R1M0',
						current_ptf_level: 'PTF54321',
						installed_date: new Date('2025-01-25'),
						rolled_back: false
					}
				]
			}
		}
	});

	// Create audit logs
	console.log('Creating audit logs...');
	await prisma.audit_log.create({
		data: {
			entity_type: 'lpar',
			entity_id: prodLpar1.id,
			action: 'create',
			changes: {
				name: 'Production LPAR 1',
				code: 'PROD-LPAR-1',
				customerId: acme.id
			},
			timestamp: new Date()
		}
	});

	await prisma.audit_log.create({
		data: {
			entity_type: 'lpar',
			entity_id: prodLpar1.id,
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
	console.log(`   - ${8} Software versions created`);
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
