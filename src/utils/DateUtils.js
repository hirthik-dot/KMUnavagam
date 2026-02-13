/**
 * Formats a YYYY-MM-DD string to DD/MM/YYYY
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} - Date in DD/MM/YYYY format
 */
export const formatToDisplayDate = (dateStr) => {
    if (!dateStr) return 'dd/mm/yyyy';
    try {
        const [year, month, day] = dateStr.split('-');
        if (!year || !month || !day) return 'dd/mm/yyyy';
        return `${day}/${month}/${year}`;
    } catch (e) {
        console.error('Error formatting date:', e);
        return 'dd/mm/yyyy';
    }
};
