import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function testVendorFilter() {
    try {
        console.log('\n=== Testing Vendor Filter ===\n');

        // 1. Check all vendors and their active status
        const allVendors = await db.vendors.findMany({
            select: { id: true, name: true, code: true, active: true }
        });
        console.log('All vendors:');
        allVendors.forEach(v => {
            console.log(`  ${v.name} (${v.code}): active=${v.active}, id=${v.id}`);
        });

        // 2. Check active vendors (what's loaded in dropdown)
        const activeVendors = await db.vendors.findMany({
            where: { active: true },
            select: { id: true, name: true }
        });
        console.log(`\nActive vendors (loaded in filter): ${activeVendors.length}`);
        activeVendors.forEach(v => {
            console.log(`  ${v.name}: ${v.id}`);
        });

        // 3. Get IBM vendor
        const ibmVendor = allVendors.find(v => v.code === 'IBM');
        if (!ibmVendor) {
            console.log('\n❌ IBM vendor not found!');
            return;
        }

        console.log(`\nIBM vendor: ${ibmVendor.name}, ID: ${ibmVendor.id}, active: ${ibmVendor.active}`);

        // 4. Test filtering by IBM vendor ID
        const ibmSoftware = await db.software.findMany({
            where: { vendor_id: ibmVendor.id },
            include: { vendors: true },
            take: 5
        });
        console.log(`\nSoftware with vendor_id='${ibmVendor.id}': ${ibmSoftware.length} results`);
        if (ibmSoftware.length > 0) {
            console.log('First 3:');
            ibmSoftware.slice(0, 3).forEach(s => {
                console.log(`  - ${s.name} (vendor: ${s.vendors.name})`);
            });
        }

        // 5. Count total IBM software
        const totalIbmSoftware = await db.software.count({
            where: { vendor_id: ibmVendor.id }
        });
        console.log(`\nTotal IBM software products: ${totalIbmSoftware}`);

        // 6. Test with combined filters (like the actual query)
        const combinedWhere = {
            AND: [
                { vendor_id: ibmVendor.id }
            ]
        };
        const combinedResults = await db.software.count({ where: combinedWhere });
        console.log(`Software with combined filter (vendor_id): ${combinedResults}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await db.$disconnect();
    }
}

testVendorFilter();
