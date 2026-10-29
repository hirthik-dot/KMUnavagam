const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join('d:', 'VS Code', 'KM-BACKUP-CODE', 'KMUnavagam', 'KMUnavagam', 'database', 'hotel.db');
const db = new Database(dbPath);
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='items'").get();
console.log('--- SCHEMA FOR items ---');
console.log(schema.sql);
db.close();
