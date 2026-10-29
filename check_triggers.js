const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'hotel.db');

try {
  const db = new Database(dbPath);
  const triggers = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='trigger'").all();
  console.log('--- TRIGGERS FOUND ---');
  console.log(JSON.stringify(triggers, null, 2));
  db.close();
} catch (err) {
  console.error('Error:', err.message);
}
