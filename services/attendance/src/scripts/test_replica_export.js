const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const toMyanmarDigits = (num) => {
    const myanmarNumbers = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
    return String(num).replace(/\d/g, d => myanmarNumbers[parseInt(d, 10)]);
};

async function generateExactOfficialRollCall() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Campus Management System (CMS)';
    wb.created = new Date();

    const sheet = wb.addWorksheet('V', {
        headerFooter: {
            oddHeader: '&RForm No. TUHMB-028',
            oddFooter: '&LTUHMB/F-028/Rev-0/25.2.2022'
        },
        pageSetup: {
            paperSize: 9, // A4 Portrait
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 1,
            horizontalDpi: 300,
            verticalDpi: 300,
            margins: { left: 0.45, right: 0.0, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
        }
    });

    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    };

    // Exact Column Widths matching official template
    sheet.columns = [
        { width: 4.44 },   // Col A: No (စဉ်)
        { width: 13.55 },  // Col B: Roll No (ခုံအမှတ်)
        { width: 26.33 },  // Col C: Name (အမည်)
        ...Array(19).fill({ width: 2.11 }), // Cols D-V: 19 Period columns
        { width: 3.44 },   // Col W: Attended (တက်ချိန်ပေါင်း)
        { width: 3.89 },   // Col X: Absent (ပျက်ချိန်ပေါင်း)
        { width: 3.89 }    // Col Y: Pct (ရာခိုင်နှုန်း)
    ];

    // Row 1: Technological University ( Hmawbi ) (Height 22.8)
    const row1 = sheet.addRow(['Technological University ( Hmawbi )']);
    row1.height = 22.8;
    sheet.mergeCells('A1:Y1');
    sheet.getCell('A1').font = { bold: true, size: 14 };
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 2: Attendance Record ( 2025 - 2026 ) (Height 22.8)
    const row2 = sheet.addRow(['Attendance Record ( 2025 - 2026 )']);
    row2.height = 22.8;
    sheet.mergeCells('A2:Y2');
    sheet.getCell('A2').font = { bold: true, size: 12 };
    sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: Class Code & Subject Header
    const row3 = sheet.addRow(['V MC', '', '', '', '', '', 'ဘာသာရပ် - Industrial Automation II ( McE-52039 )']);
    sheet.mergeCells('A3:B3');
    sheet.getCell('A3').font = { bold: true, size: 10 };
    sheet.getCell('G3').font = { bold: true, size: 10 };
    sheet.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getCell('G3').alignment = { horizontal: 'left', vertical: 'middle' };

    // Row 4: Academic Year/Month & Monthly Total Hours (Height 24.75)
    const row4 = sheet.addRow(['၂၀၂၅ - ၂၀၂၆ ခုနှစ်၊ ဇန်နဝါရီ (Jan) လ', '', '', '', '', '', 'ယခုလတက်ချိန် - 36 နာရီ']);
    row4.height = 24.75;
    sheet.getCell('A4').font = { size: 10 };
    sheet.getCell('G4').font = { bold: true, size: 10 };
    sheet.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getCell('G4').alignment = { horizontal: 'left', vertical: 'middle' };

    // Row 5: Table Header (Height 79.5) with 90° Rotated Text
    const headerValues = ['စဉ်', 'ခုံအမှတ်', 'အမည်', ...Array(19).fill(''), 'တက်ချိန်ပေါင်း', 'ပျက်ချိန်ပေါင်း', 'ရာခိုင်နှုန်း'];
    const tableHeader = sheet.addRow(headerValues);
    tableHeader.height = 79.5;

    for (let col = 1; col <= 25; col++) {
        const cell = tableHeader.getCell(col);
        cell.border = thinBorder;
        cell.font = { bold: true, size: 9 };
        if (col >= 23) {
            cell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center', wrapText: true };
        } else {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
    }

    // Sample 14 Students
    const sampleStudents = [
        'မဟန်နီစိုး', 'မဆူးအိလှိုင်', 'မခိုင်ရတနာထွဋ်', 'မရွှန်းလဲ့လဲ့ဖြိုး', 'မအိမ့်ဖူးစံ',
        'မောင်ကောင်းထက်မြတ်', 'မလင်းလဲ့ကြည်ဖြူသန့်', 'မောင်ဇင်မင်းထက်', 'မောင်နိုင်လင်းအောင်',
        'မောင်ကောင်းသီဟသူ', 'မောင်ပိုင်စွမ်းပြည့်', 'မောင်စွမ်းရည်ကောင်းမြတ်', 'မောင်စိုးရဲထက်', 'မောင်ဇေညီညီစိုး'
    ];

    // Student Rows (Rows 6 to 25) - Height 27.75
    const totalRowsToRender = 20;
    for (let i = 0; i < totalRowsToRender; i++) {
        const isRealStudent = i < sampleStudents.length;
        const rowNum = i + 6;
        const myanmarNo = isRealStudent ? toMyanmarDigits(i + 1) : '';
        const rollNo = isRealStudent ? `V-MC-${i + 1}` : '';
        const name = isRealStudent ? sampleStudents[i] : '';

        const rowValues = [myanmarNo, rollNo, name, ...Array(19).fill(''), '', '', ''];
        const row = sheet.addRow(rowValues);
        row.height = 27.75;

        for (let col = 1; col <= 25; col++) {
            const cell = row.getCell(col);
            cell.border = thinBorder;
            cell.font = { size: 9.5 };

            if (col === 1 || col === 2) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (col === 3) {
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
            } else if (col >= 23 && isRealStudent) {
                // Formulas for W, X, Y
                if (col === 23) cell.value = { formula: `=COUNTIF(D${rowNum}:V${rowNum}, "✓") * 3` };
                if (col === 24) cell.value = { formula: `=(COUNTA(D$5:V$5) - COUNTIF(D${rowNum}:V${rowNum}, "✓")) * 3` };
                if (col === 25) cell.value = { formula: `=IF((W${rowNum}+X${rowNum})>0, ROUND((W${rowNum}/(W${rowNum}+X${rowNum}))*100, 1) & "%", "100%")` };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
        }
    }

    // Row 26: Signature Line
    const sig1RowNumber = sheet.rowCount + 1; // 26
    const sig1Row = sheet.addRow(['', '', 'လက်မှတ် -------------------------------------------']);
    sheet.mergeCells(`C${sig1RowNumber}:Y${sig1RowNumber}`);
    sig1Row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    sig1Row.getCell(3).font = { size: 9.5 };

    // Row 27: Teacher Signature Name Line
    const sig2RowNumber = sheet.rowCount + 1; // 27
    const sig2Row = sheet.addRow(['', '', 'ဘာသာရပ်ဆရာအမည် ------------------------------------------- (Subject Teacher)']);
    sheet.mergeCells(`C${sig2RowNumber}:Y${sig2RowNumber}`);
    sig2Row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    sig2Row.getCell(3).font = { size: 9.5, italic: true };

    const outPath = path.join(__dirname, 'official_replica_output.xlsx');
    await wb.xlsx.writeFile(outPath);
    console.log('✅ Generated 100% replica official Excel file:', outPath);
}

generateExactOfficialRollCall();
