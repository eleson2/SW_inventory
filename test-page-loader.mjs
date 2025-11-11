import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function testPageLoader() {
    try {
        console.log('\n=== Simulating Page Loader ===\n');

        // Get IBM vendor ID
        const ibmVendor = await db.vendors.findUnique({
            where: { code: 'IBM' }
        });
        console.log(`IBM vendor ID: ${ibmVendor.id}\n`);

        // Simulate what page-loader.ts does
        const whereConditions = [];

        // No search term - just filter
        const vendorId = ibmVendor.id; // From URL param
        const customFilters = { vendor_id: vendorId };

        if (Object.keys(customFilters).length > 0) {
            whereConditions.push(customFilters);
        }

        const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

        console.log('Generated where clause:');
        console.log(JSON.stringify(where, null, 2));

        // Test the actual query
        const results = await db.software.findMany({
            where,
            include: {
                vendors: true,
                current_version: true
            },
            take: 5
        });

        console.log(`\nResults: ${results.length}`);
        results.forEach(s => {
            console.log(`  - ${s.name} (${s.vendors.name})`);
        });

        // Count total
        const total = await db.software.count({ where });
        console.log(`\nTotal count: ${total}`);

        // Now test with search AND filter combined
        console.log('\n--- Testing with search + filter ---');
        const whereConditions2 = [];

        // Add search
        const searchTerm = 'db2';
        whereConditions2.push({
            OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { vendors: { name: { contains: searchTerm, mode: 'insensitive' } } }
            ]
        });

        // Add filter
        whereConditions2.push({ vendor_id: ibmVendor.id });

        const where2 = { AND: whereConditions2 };
        console.log('\nWhere clause with search + filter:');
        console.log(JSON.stringify(where2, null, 2));

        const results2 = await db.software.findMany({
            where: where2,
            include: { vendors: true }
        });

        console.log(`\nResults: ${results2.length}`);
        results2.forEach(s => {
            console.log(`  - ${s.name} (${s.vendors.name})`);
        });

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    } finally {
        await db.$disconnect();
    }
}

testPageLoader();
