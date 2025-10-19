import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Read the ODS file
const filePath = path.join(process.cwd(), 'SW Master.ods');
const workbook = XLSX.readFile(filePath);

console.log('=== SW Master.ods Analysis ===\n');
console.log('Sheet names:', workbook.SheetNames);
console.log('\n');

// Analyze each sheet
workbook.SheetNames.forEach((sheetName) => {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  console.log(`Total rows: ${data.length}`);

  if (data.length > 0) {
    console.log('\nFirst 20 rows:');
    data.slice(0, 20).forEach((row: any, index: number) => {
      console.log(`Row ${index}:`, JSON.stringify(row));
    });
  }

  // Analyze structure
  console.log('\n=== Structure Analysis ===');
  const row0: any = data[0] || [];
  const row1: any = data[1] || [];
  const row2: any = data[2] || [];

  console.log('Row 0 (Customers):', row0.filter((v: any) => v !== undefined && v !== null && v !== ''));
  console.log('Row 1 (LPARs):', row1.filter((v: any) => v !== undefined && v !== null && v !== ''));
  console.log('Row 2 (Headers):', row2.filter((v: any) => v !== undefined && v !== null && v !== ''));

  console.log('\n' + '='.repeat(50));
});
