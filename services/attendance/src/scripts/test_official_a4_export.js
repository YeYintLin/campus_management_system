const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const toMyanmarDigits = (num) => {
    const myanmarNumbers = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
    return String(num).replace(/\d/g, d => myanmarNumbers[parseInt(d, 10)]);
};

async function testExportA4() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('V', {
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 1,
            margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3 }
        }
    });

    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    };

    // Column Widths for A4 Portrait Fit
    ws.columns = [
        { width: 4 },    // A: Serial (စဉ်)
        { width: 11 },   // B: Roll No (ခုံအမှတ်)
        { width: 24 },   // C: Name (အမည်)
        ...Array(19).fill({ width: 2.2 }), // D-V: 19 Period columns
        { width: 3.5 },  // W: Attended (တက်ချိန်ပေါင်း)
        { width: 3.5 },  // X: Absent (ပျက်ချိန်ပေါင်း)
        { width: 3.5 }   // Y: Pct (ရာခိုင်နှုန်း)
    ];

    // Row 1: Form No. TUHMB-028 (Top Right)
    const row1 = ws.addRow([...Array(24).fill(''), 'Form No. TUHMB-028']);
    ws.mergeCells('U1:Y1');
    ws.getCell('U1').font = { size: 9, bold: false };
    ws.getCell('U1').alignment = { horizontal: 'right', vertical: 'middle' };

    // Row 2: Technological University ( Hmawbi )
    const row2 = ws.addRow(['Technological University ( Hmawbi )']);
    ws.mergeCells('A2:Y2');
    ws.getCell('A2').font = { size: 13, bold: true };
    ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: Attendance Record ( 2025 - 2026 )
    const row3 = ws.addRow(['Attendance Record ( 2025 - 2026 )']);
    ws.mergeCells('A3:Y3');
    ws.getCell('A3').font = { size: 11, bold: true };
    ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 4: V MC & Subject Name
    const row4 = ws.addRow(['V MC', '', '', '', '', '', '', '', '', '', '', '', 'ဘာသာရပ် - Industrial Automation II ( McE-52039 )']);
    ws.mergeCells('A4:B4');
    ws.mergeCells('M4:Y4');
    ws.getCell('A4').font = { bold: true, size: 10 };
    ws.getCell('M4').font = { bold: true, size: 10 };
    ws.getCell('M4').alignment = { horizontal: 'right', vertical: 'middle' };

    // Row 5: Academic Year/Month & Monthly Hours
    const row5 = ws.addRow(['၂၀၂၅ - ၂၀၂၆ ခုနှစ်၊ ဇန်နဝါရီ (Jan) လ', '', '', '', '', '', '', '', '', '', '', '', 'ယခုလတက်ချိန် - 36 နာရီ']);
    ws.mergeCells('A5:L5');
    ws.mergeCells('M5:Y5');
    ws.getCell('A5').font = { size: 10 };
    ws.getCell('M5').font = { bold: true, size: 10 };
    ws.getCell('M5').alignment = { horizontal: 'right', vertical: 'middle' };

    // Empty space
    ws.addRow([]);

    // Table Header (Row 7)
    const headerValues = ['စဉ်', 'ခုံအမှတ်', 'အမည်', ...Array(19).fill(''), 'တက်ချိန်ပေါင်း', 'ပျက်ချိန်ပေါင်း', 'ရာခိုင်နှုန်း'];
    const tableHeader = ws.addRow(headerValues);
    tableHeader.height = 70; // High height for vertical rotated text

    for (let col = 1; col <= 25; col++) {
        const cell = tableHeader.getCell(col);
        cell.border = thinBorder;
        cell.font = { bold: true, size: 9 };
        if (col >= 23) {
            // Rotated Vertical Text for W, X, Y
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

    // Student Rows (Row 8 to 21) + Padded Blank Rows up to Row 32 for A4 page fit
    const totalRowsToRender = 25;
    for (let i = 0; i < totalRowsToRender; i++) {
        const isRealStudent = i < sampleStudents.length;
        const rowNum = i + 8;
        const myanmarNo = isRealStudent ? toMyanmarDigits(i + 1) : '';
        const rollNo = isRealStudent ? `V-MC-${i + 1}` : '';
        const name = isRealStudent ? sampleStudents[i] : '';

        const rowValues = [myanmarNo, rollNo, name, ...Array(19).fill(''), '', '', ''];
        const row = ws.addRow(rowValues);
        row.height = 20;

        for (let col = 1; col <= 25; col++) {
            const cell = row.getCell(col);
            cell.border = thinBorder;
            cell.font = { size: 9 };

            if (col === 1 || col === 2) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (col === 3) {
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
            } else if (col >= 23 && isRealStudent) {
                // Formulas for W, X, Y
                if (col === 23) cell.value = { formula: `=COUNTIF(D${rowNum}:V${rowNum}, "✓") * 3` };
                if (col === 24) cell.value = { formula: `=(COUNTA(D$7:V$7) - COUNTIF(D${rowNum}:V${rowNum}, "✓")) * 3` };
                if (col === 25) cell.value = { formula: `=IF((W${rowNum}+X${rowNum})>0, ROUND((W${rowNum}/(W${rowNum}+X${rowNum}))*100, 1) & "%", "100%")` };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
        }
    }

    // Footer Signature
    ws.addRow([]);
    const sigRowNumber = ws.rowCount + 1;
    const sigRow = ws.addRow(['', '', '', '', '', '', '', '', '', '', '', '', 'လက်မှတ် -------------------------------------------']);
    ws.mergeCells(`M${sigRowNumber}:Y${sigRowNumber}`);
    ws.getCell(`M${sigRowNumber}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(`M${sigRowNumber}`).font = { size: 9 };

    // Footer Form Revision ID
    const formFooterRowNumber = ws.rowCount + 1;
    const formFooterRow = ws.addRow(['TUHMB/F-028/Rev-0/25.2.2022']);
    ws.mergeCells(`A${formFooterRowNumber}:H${formFooterRowNumber}`);
    ws.getCell(`A${formFooterRowNumber}`).font = { size: 8, italic: true };
    ws.getCell(`A${formFooterRowNumber}`).alignment = { horizontal: 'left', vertical: 'middle' };

    const outPath = path.join(__dirname, 'official_a4_test_output.xlsx');
    await wb.xlsx.writeFile(outPath);
    console.log('✅ Generated official A4 Excel output:', outPath);
}

testExportA4();
