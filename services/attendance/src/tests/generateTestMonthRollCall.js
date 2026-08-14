const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function generateTestMonthRollCall() {
    console.log('Generating 1-Month Official TU Hmawbi Roll Call Excel Test File...');

    const courseInfo = {
        code: 'McE-52039',
        name: 'Control Systems Engineering (McE-52039)',
        year: '5th Year',
        teacher: 'Daw Hla Hla Win',
    };

    const monthLabel = 'ဇန်နဝါရီ (January)';
    const hourWeight = 3; // 5th Year 3-hour period weight

    const studentsList = [
        { rollNo: 'V-MC-1',  name: 'မဟန်နီစိုး' },
        { rollNo: 'V-MC-2',  name: 'မဆူးအိလှိုင်' },
        { rollNo: 'V-MC-3',  name: 'မခိုင်ရတနာထွဋ်' },
        { rollNo: 'V-MC-4',  name: 'မရွှန်းလဲ့လဲ့ဖြိုး' },
        { rollNo: 'V-MC-5',  name: 'မအိမ့်ဖူးစံ' },
        { rollNo: 'V-MC-6',  name: 'မောင်ကောင်းထက်မြတ်' },
        { rollNo: 'V-MC-7',  name: 'မလင်းလဲ့ကြည်ဖြူသန့်' },
        { rollNo: 'V-MC-8',  name: 'မောင်ဇင်မင်းထက်' },
        { rollNo: 'V-MC-9',  name: 'မောင်နိုင်လင်းအောင်' },
        { rollNo: 'V-MC-10', name: 'မောင်ကောင်းသီဟသူ' },
        { rollNo: 'V-MC-11', name: 'မောင်ပိုင်စွမ်းပြည့်' },
        { rollNo: 'V-MC-12', name: 'မောင်စွမ်းရည်ကောင်းမြတ်' },
        { rollNo: 'V-MC-13', name: 'မောင်စိုးရဲထက်' },
        { rollNo: 'V-MC-14', name: 'မောင်ဇေညီညီစိုး' },
        { rollNo: 'V-MC-15', name: 'မောင်သီဟဇော်' }
    ];

    const toMyanmarDigits = (num) => {
        const myanmarNumbers = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
        return String(num).replace(/\d/g, d => myanmarNumbers[parseInt(d, 10)]);
    };

    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Campus Management System (CMS)';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('V', {
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

    // Exact Column Widths matching official V Year MC Roll Call template
    sheet.columns = [
        { width: 4.44 },   // Col A: Serial (စဉ်)
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

    const classCode = 'V MC';

    // Row 3: Class Code & Subject Header
    const row3 = sheet.addRow([classCode, '', '', '', '', '', `ဘာသာရပ် - ${courseInfo.name}`]);
    sheet.mergeCells('A3:B3');
    sheet.getCell('A3').font = { bold: true, size: 10 };
    sheet.getCell('G3').font = { bold: true, size: 10 };
    sheet.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getCell('G3').alignment = { horizontal: 'left', vertical: 'middle' };

    // Row 4: Academic Year/Month & Monthly Total Hours (Height 24.75)
    // 12 teaching periods in this test month = 36 total class hours
    const totalPeriodsInMonth = 12;
    const totalMonthlyHours = totalPeriodsInMonth * hourWeight;
    const row4 = sheet.addRow([`၂၀၂၅ - ၂၀၂၆ ခုနှစ်၊ ${monthLabel} လ`, '', '', '', '', '', `ယခုလတက်ချိန် - ${totalMonthlyHours} နာရီ`]);
    row4.height = 24.75;
    sheet.getCell('A4').font = { size: 10 };
    sheet.getCell('G4').font = { bold: true, size: 10 };
    sheet.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getCell('G4').alignment = { horizontal: 'left', vertical: 'middle' };

    // Row 5: Table Header (Height 79.5) with Rotated 90-degree Vertical Text
    const headerValues = ['စဉ်', 'ခုံအမှတ်', 'အမည်'];
    // Put period numbers for the 12 active periods
    for (let p = 1; p <= 19; p++) {
        headerValues.push(p <= totalPeriodsInMonth ? toMyanmarDigits(p) : '');
    }
    headerValues.push('တက်ချိန်ပေါင်း', 'ပျက်ချိန်ပေါင်း', 'ရာခိုင်နှုန်း');

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

    // Student Roster Rows (Rows 6 to 25) - Height 27.75
    const totalRowsToRender = Math.max(studentsList.length, 20);

    for (let i = 0; i < totalRowsToRender; i++) {
        const isRealStudent = i < studentsList.length;
        const st = isRealStudent ? studentsList[i] : null;
        const rowNum = i + 6;
        const myanmarNo = isRealStudent ? toMyanmarDigits(i + 1) : '';
        const rollStr = isRealStudent ? st.rollNo : '';
        const nameStr = isRealStudent ? st.name : '';

        const rowValues = [myanmarNo, rollStr, nameStr];

        // Fill test attendance checkmarks for 12 periods (simulating realistic student attendance)
        for (let p = 0; p < 19; p++) {
            if (isRealStudent && p < totalPeriodsInMonth) {
                // High attendance simulation: occasional absence on period 4 or 8 for some students
                const isAbsent = (i === 3 && p === 4) || (i === 7 && p === 8) || (i === 11 && (p === 2 || p === 9));
                rowValues.push(isAbsent ? '' : '✓');
            } else {
                rowValues.push('');
            }
        }

        // Empty slots for formulas
        rowValues.push('', '', '');
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
                // W: Attended Hours = Count of checkmarks * 3 hours
                if (col === 23) cell.value = { formula: `=COUNTIF(D${rowNum}:V${rowNum}, "✓") * ${hourWeight}` };
                // X: Absent Hours = (Total active periods in header row - Attended) * 3 hours
                if (col === 24) cell.value = { formula: `=(COUNTA(D$5:V$5) - COUNTIF(D${rowNum}:V${rowNum}, "✓")) * ${hourWeight}` };
                // Y: Attendance Percentage = (Attended / (Attended + Absent)) * 100%
                if (col === 25) cell.value = { formula: `=IF((W${rowNum}+X${rowNum})>0, ROUND((W${rowNum}/(W${rowNum}+X${rowNum}))*100, 1) & "%", "100%")` };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
        }
    }

    // Row 26: Signature Line
    const sig1RowNumber = sheet.rowCount + 1;
    const sig1Row = sheet.addRow(['', '', 'လက်မှတ် -------------------------------------------']);
    sheet.mergeCells(`C${sig1RowNumber}:Y${sig1RowNumber}`);
    sig1Row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    sig1Row.getCell(3).font = { size: 9.5 };

    // Row 27: Teacher Signature Name Line
    const sig2RowNumber = sheet.rowCount + 1;
    const sig2Row = sheet.addRow(['', '', `ဘာသာရပ်ဆရာအမည် ------------------------------------------- (${courseInfo.teacher})`]);
    sheet.mergeCells(`C${sig2RowNumber}:Y${sig2RowNumber}`);
    sig2Row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    sig2Row.getCell(3).font = { size: 9.5, italic: true };

    const outputPath = path.join(__dirname, 'Test_Official_Roll_Call_January_2026.xlsx');
    await workbook.xlsx.writeFile(outputPath);
    console.log(`\n✅ Successfully generated test roll call workbook at:\n${outputPath}`);
    console.log('File is self-contained with no database footprint and ready for download/inspection.\n');
}

generateTestMonthRollCall().catch(err => {
    console.error('Error generating roll call test:', err);
});
