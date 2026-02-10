// database.js - SQLite Database Handler
// This file manages all database operations for the hotel billing app

const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

// Get the path where we'll store the database
// For development: inside the project folder
// For production: inside the user's AppData folder
const isDev = process.env.NODE_ENV === 'development';
const dbPath = isDev 
  ? path.join(__dirname, '..', 'database', 'hotel.db')
  : path.join(app.getPath('userData'), 'database', 'hotel.db');

// Make sure the database folder exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log('📁 Database location:', dbPath);

// Open the database connection
const db = new Database(dbPath);

// Enable foreign keys for data integrity
db.pragma('foreign_keys = ON');

/**
 * Initialize the database - create tables if they don't exist
 * This runs when the app starts for the first time
 */
function initializeDatabase() {
  console.log('🔧 Initializing database...');

  // Table 1: items - stores all food items
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_tamil TEXT NOT NULL,
      name_english TEXT NOT NULL,
      price REAL NOT NULL,
      image_path TEXT,
      is_active INTEGER DEFAULT 1
    )
  `);

  // Table 2: bills - stores bill information
  db.exec(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      total_amount REAL NOT NULL
    )
  `);

  // Table 3: bill_items - stores items in each bill
  db.exec(`
    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      rate REAL NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (item_id) REFERENCES items(id)
    )
  `);

  // Add some sample food items if the database is empty
  const count = db.prepare('SELECT COUNT(*) as count FROM items').get();
  if (count.count === 0) {
    console.log('📝 Adding sample food items...');
    addSampleItems();
  }

  console.log('✅ Database initialized successfully!');
}

/**
 * Add sample food items to the database
 * This helps you test the app immediately
 */
function addSampleItems() {
  const sampleItems = [
    { tamil: 'தோசை', english: 'Dosa', price: 40 },
    { tamil: 'இட்லி', english: 'Idly', price: 30 },
    { tamil: 'வடை', english: 'Vada', price: 20 },
    { tamil: 'பூரி', english: 'Poori', price: 35 },
    { tamil: 'சப்பாத்தி', english: 'Chapathi', price: 35 },
    { tamil: 'பொங்கல்', english: 'Pongal', price: 45 },
    { tamil: 'உப்புமா', english: 'Upma', price: 30 },
    { tamil: 'பரோட்டா', english: 'Parotta', price: 15 },
    { tamil: 'சாதம்', english: 'Rice', price: 50 },
    { tamil: 'சாம்பார்', english: 'Sambar', price: 20 },
    { tamil: 'ரசம்', english: 'Rasam', price: 15 },
    { tamil: 'தயிர்', english: 'Curd', price: 20 },
  ];

  const insert = db.prepare(`
    INSERT INTO items (name_tamil, name_english, price, is_active)
    VALUES (?, ?, ?, 1)
  `);

  for (const item of sampleItems) {
    insert.run(item.tamil, item.english, item.price);
  }
}

// ==================== DATABASE OPERATIONS ====================

/**
 * Get all active food items
 * Used by: Billing Page to show food items
 */
function getAllItems() {
  const stmt = db.prepare('SELECT * FROM items WHERE is_active = 1 ORDER BY name_english');
  return stmt.all();
}

/**
 * Get all items (including inactive ones)
 * Used by: Admin Page to manage all items
 */
function getAllItemsAdmin() {
  const stmt = db.prepare('SELECT * FROM items ORDER BY name_english');
  return stmt.all();
}

/**
 * Add a new food item
 * Used by: Admin Page when adding new items
 */
function addItem(nameTamil, nameEnglish, price, imagePath = null) {
  const stmt = db.prepare(`
    INSERT INTO items (name_tamil, name_english, price, image_path, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);
  const result = stmt.run(nameTamil, nameEnglish, price, imagePath);
  return result.lastInsertRowid;
}

/**
 * Update an existing food item
 * Used by: Admin Page when editing items
 */
function updateItem(id, nameTamil, nameEnglish, price, imagePath = null) {
  const stmt = db.prepare(`
    UPDATE items 
    SET name_tamil = ?, name_english = ?, price = ?, image_path = ?
    WHERE id = ?
  `);
  stmt.run(nameTamil, nameEnglish, price, imagePath, id);
}

/**
 * Toggle item active status (enable/disable)
 * Used by: Admin Page to hide/show items
 */
function toggleItemStatus(id, isActive) {
  const stmt = db.prepare('UPDATE items SET is_active = ? WHERE id = ?');
  stmt.run(isActive ? 1 : 0, id);
}

/**
 * Delete a food item
 * Used by: Admin Page to remove items
 */
function deleteItem(id) {
  const stmt = db.prepare('DELETE FROM items WHERE id = ?');
  stmt.run(id);
}

/**
 * Save a new bill to the database
 * Used by: Billing Page when printing a bill
 */
function saveBill(items, totalAmount) {
  // Get current date and time
  const now = new Date().toISOString();
  
  // Start a transaction (all or nothing - prevents partial saves)
  const transaction = db.transaction((billItems) => {
    // Insert the bill
    const billStmt = db.prepare(`
      INSERT INTO bills (created_at, total_amount)
      VALUES (?, ?)
    `);
    const billResult = billStmt.run(now, totalAmount);
    const billId = billResult.lastInsertRowid;

    // Insert all bill items
    const itemStmt = db.prepare(`
      INSERT INTO bill_items (bill_id, item_id, quantity, rate)
      VALUES (?, ?, ?, ?)
    `);

    for (const item of billItems) {
      itemStmt.run(billId, item.id, item.quantity, item.price);
    }

    return billId;
  });

  return transaction(items);
}

/**
 * Get bill history (for future reports feature)
 * Used by: Future reports page
 */
function getBillHistory(limit = 50) {
  const stmt = db.prepare(`
    SELECT * FROM bills 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(limit);
}

/**
 * Get items for a specific bill
 * Used by: Future reports page to show bill details
 */
function getBillItems(billId) {
  const stmt = db.prepare(`
    SELECT 
      bi.quantity,
      bi.rate,
      i.name_tamil,
      i.name_english
    FROM bill_items bi
    JOIN items i ON bi.item_id = i.id
    WHERE bi.bill_id = ?
  `);
  return stmt.all(billId);
}

// Export all functions so Electron can use them
module.exports = {
  initializeDatabase,
  getAllItems,
  getAllItemsAdmin,
  addItem,
  updateItem,
  toggleItemStatus,
  deleteItem,
  saveBill,
  getBillHistory,
  getBillItems,
  db, // Export the database connection for advanced use
};
