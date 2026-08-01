export const getNormalizedUserYear = (user) => {
    if (!user) return '6th Year';
    const yr = user.year || user.academicYear;
    if (!yr) return '6th Year';
    if (typeof yr === 'number') {
        const suffix = yr === 1 ? 'st' : yr === 2 ? 'nd' : yr === 3 ? 'rd' : 'th';
        return `${yr}${suffix} Year`;
    }
    const str = String(yr);
    if (str.includes('1')) return '1st Year';
    if (str.includes('2')) return '2nd Year';
    if (str.includes('3')) return '3rd Year';
    if (str.includes('4')) return '4th Year';
    if (str.includes('5')) return '5th Year';
    if (str.includes('6') || str.toLowerCase().includes('final')) return '6th Year';
    return str;
};
