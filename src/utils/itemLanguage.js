// Item name language helpers: bill printing + on-screen display (Billing, Cart, Admin)
// Keep getItemPrintName in sync with the copy in electron/main.js

export const PRINT_LANGUAGE_SETTING_KEY = 'printLanguage';

// 'ta' is the default so existing bills keep printing exactly as before
export const DEFAULT_PRINT_LANGUAGE = 'ta';

export const PRINT_LANGUAGES = [
    { code: 'ta', label: 'தமிழ்' },
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
];

/**
 * Pick the item name to print for the chosen language.
 * Falls back to English when the item has no name in that language.
 */
export function getItemPrintName(item, language) {
    if (language === 'en') return item.name_english;
    if (language === 'hi') return item.name_hindi || item.name_english;
    return item.name_tamil || item.name_english;
}

export const DISPLAY_LANGUAGE_SETTING_KEY = 'displayLanguage';
export const DEFAULT_DISPLAY_LANGUAGE = 'ta';

/**
 * Names to show on food cards / cart for the chosen display language.
 * primary   = big name, secondary = small name underneath.
 * Missing Hindi name → English big, Tamil small (never "Dosa / Dosa").
 * secondary is null when it would just repeat the primary name.
 */
export function getItemDisplayNames(item, language) {
    let primary;
    let secondary;

    if (language === 'en') {
        primary = item.name_english;
        secondary = item.name_tamil;
    } else if (language === 'hi' && item.name_hindi) {
        primary = item.name_hindi;
        secondary = item.name_english;
    } else if (language === 'hi') {
        primary = item.name_english;
        secondary = item.name_tamil;
    } else {
        primary = item.name_tamil || item.name_english;
        secondary = item.name_english;
    }

    return { primary, secondary: secondary && secondary !== primary ? secondary : null };
}
