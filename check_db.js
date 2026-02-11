const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'hotel.db');

try {
    const db = new Database(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables in database:');
    tables.forEach(t => console.log(' - ' + t.name));

    const hasTable = tables.some(t => t.name === 'credit_customers');
    console.log('\ncredit_customers table exists:', hasTable);
} catch (err) {
    console.error('Error:', err.message);
}
