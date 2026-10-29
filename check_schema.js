const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'hotel.db');
const db = new Database(dbPath);
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='credit_bills'").get();
console.log('--- SCHEMA FOR credit_bills ---');
console.log(schema.sql);
db.close();
