// Money helpers: amounts are exact to the paisa (2 decimals), never rounded to whole rupees.
// Keep formatMoney in sync with the copy in electron/main.js (print templates).

/**
 * Round to 2 decimals (removes float noise like 0.30000000000000004)
 */
export function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Display an amount: whole rupees as "40", otherwise exactly 2 decimals "12.50".
 * grouping: true adds Indian digit grouping ("1,25,000.50") for screens that already used it.
 */
export function formatMoney(value, { grouping = false } = {}) {
    const amount = roundMoney(value);
    const decimals = Number.isInteger(amount) ? 0 : 2;
    if (grouping) {
        return amount.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    return amount.toFixed(decimals);
}
