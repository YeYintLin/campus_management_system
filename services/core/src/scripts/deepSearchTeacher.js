const fs = require('fs');
const XLSX = require('xlsx');

const filePath = 'C:\\Users\\ASUS\\Downloads\\Time Table 2025-2026 (1.6.25).xlsx';
if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
}

const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

console.log('====================================================');
console.log('FULL DEEP CELL SEARCH FOR DAW MYAT THU ZAR ACROSS ALL SHEETS');
console.log('====================================================\n');

workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    console.log(`\n--- SHEET: "${sheetName}" ---`);
    let foundInSheet = false;

    jsonRows.forEach((row, rIdx) => {
        if (!Array.isArray(row)) return;
        row.forEach((cell, cIdx) => {
            const str = String(cell || '').trim();
            if (str.toLowerCase().includes('myat thu zar')) {
                foundInSheet = true;
                const rowContext = row.filter(Boolean).join(' | ');
                console.log(`  [Row ${rIdx + 1}, Col ${cIdx + 1}] Cell Text: "${str}"`);
                console.log(`    Full Row Context: ${rowContext}\n`);
            }
        });
    });

    if (!foundInSheet) {
        console.log('  (No occurrences found in this sheet)');
    }
});
