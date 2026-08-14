export const parseYearNumber = (yr) => {
    if (!yr) return 1;
    if (typeof yr === 'number') return yr;
    const str = String(yr).trim().toLowerCase();
    if (str === 'all') return 0;
    if (str === 'i' || str.includes('1st') || str.includes('first')) return 1;
    if (str === 'ii' || str.includes('2nd') || str.includes('second')) return 2;
    if (str === 'iii' || str.includes('3rd') || str.includes('third')) return 3;
    if (str === 'iv' || str.includes('4th') || str.includes('fourth')) return 4;
    if (str === 'v' || str.includes('5th') || str.includes('fifth')) return 5;
    if (str === 'vi' || str.includes('6th') || str.includes('sixth') || str.includes('final')) return 6;
    if (str.includes('me') || str.includes('master') || str.includes('7')) return 7;

    const numMatch = str.match(/\b([1-7])\b/);
    if (numMatch) return parseInt(numMatch[1], 10);
    return 1;
};

export const normalizeYear = (yr) => {
    if (!yr) return 'All';
    const str = String(yr).trim();
    if (str.toLowerCase() === 'all') return 'All';
    if (str.toLowerCase().includes('me program') || str.toLowerCase().includes('master')) return 'ME Program';
    const num = parseYearNumber(yr);
    const labels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year', 6: '6th Year', 7: 'ME Program' };
    return labels[num] || '1st Year';
};

export const getNormalizedUserYear = (user) => {
    if (!user) return '5th Year';
    const yr = user.year || user.academicYear;
    if (yr) return normalizeYear(yr);

    // Check email prefix (e.g. v.mc.1, vi.mc.2, etc.)
    const email = String(user.email || '').toLowerCase();
    if (email.startsWith('vi.') || email.startsWith('6.')) return '6th Year';
    if (email.startsWith('v.') || email.startsWith('5.')) return '5th Year';
    if (email.startsWith('iv.') || email.startsWith('4.')) return '4th Year';
    if (email.startsWith('iii.') || email.startsWith('3.')) return '3rd Year';
    if (email.startsWith('ii.') || email.startsWith('2.')) return '2nd Year';
    if (email.startsWith('i.') || email.startsWith('1.')) return '1st Year';

    // Check rollNo
    const roll = String(user.rollNo || user.enrollmentNumber || '').toUpperCase();
    if (roll.startsWith('VI-') || roll.startsWith('6-')) return '6th Year';
    if (roll.startsWith('V-') || roll.startsWith('5-')) return '5th Year';
    if (roll.startsWith('IV-') || roll.startsWith('4-')) return '4th Year';
    if (roll.startsWith('III-') || roll.startsWith('3-')) return '3rd Year';
    if (roll.startsWith('II-') || roll.startsWith('2-')) return '2nd Year';
    if (roll.startsWith('I-') || roll.startsWith('1-')) return '1st Year';

    if (user.semester) {
        const sem = Number(user.semester);
        const yNum = Math.min(6, Math.max(1, Math.ceil(sem / 2)));
        const labels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year', 6: '6th Year' };
        return labels[yNum] || '5th Year';
    }

    return '5th Year';
};
