const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join('d:', 'KM', 'KMUnavagam', 'database', 'hotel.db');

try {
    const db = new Database(dbPath);
    console.log('Connected to database at:', dbPath);

    // Get valid categories
    const validCategories = db.prepare('SELECT name FROM categories').all().map(c => c.name);
    console.log('Valid categories in DB:', validCategories);

    const categoryMap = {
        'Breakfast': 'Tiffin',
        'Lunch': 'Other',
        'Dinner': 'Parotta',
        'breakfast': 'Tiffin',
        'lunch': 'Other',
        'dinner': 'Parotta'
    };

    let totalUpdated = 0;
    for (const [oldCat, newCat] of Object.entries(categoryMap)) {
        const result = db.prepare('UPDATE items SET category = ? WHERE category = ?').run(newCat, oldCat);
        if (result.changes > 0) {
            console.log(`Migrated ${result.changes} items from '${oldCat}' to '${newCat}'`);
            totalUpdated += result.changes;
        }
    }

    // Check for any other categories not in the valid list
    const items = db.prepare('SELECT id, name_english, category FROM items').all();
    let otherFixes = 0;
    for (const item of items) {
        if (!validCategories.includes(item.category)) {
            console.log(`Item "${item.name_english}" (ID: ${item.id}) has invalid category "${item.category}". Resetting to "Other".`);
            db.prepare('UPDATE items SET category = ? WHERE id = ?').run('Other', item.id);
            otherFixes++;
        }
    }

    console.log('\nMigration Summary:');
    console.log('Total items updated via map:', totalUpdated);
    console.log('Total items reset to "Other":', otherFixes);

    db.close();
} catch (err) {
    console.error('Migration failed:', err.message);
}
