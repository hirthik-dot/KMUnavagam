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
      category TEXT DEFAULT 'Others',
      image_path TEXT,
      is_active INTEGER DEFAULT 1
    )
  `);

  // Check if category column exists (for existing databases)
  try {
    const tableInfo = db.prepare("PRAGMA table_info(items)").all();
    const hasCategory = tableInfo.some(column => column.name === 'category');
    if (!hasCategory) {
      console.log('Adding "category" column to "items" table...');
      db.exec("ALTER TABLE items ADD COLUMN category TEXT DEFAULT 'Others'");
    }
  } catch (err) {
    console.error('Error checking/adding category column:', err.message);
  }

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

  // Table 4: expenses - stores daily expenses
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL
    )
  `);

  // Table 5: credit_customers - stores customers who buy on credit
  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT
    )
  `);

  // Table 6: credit_bills - links bills to credit customers
  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_bills (
      bill_id INTEGER PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (customer_id) REFERENCES credit_customers(id)
    )
  `);

  // Table 7: credit_payments - stores payments made by credit customers
  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES credit_customers(id)
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
    { tamil: 'தோசை', english: 'Dosa', price: 40, category: 'Breakfast' },
    { tamil: 'இட்லி', english: 'Idly', price: 30, category: 'Breakfast' },
    { tamil: 'வடை', english: 'Vada', price: 20, category: 'Breakfast' },
    { tamil: 'பூரி', english: 'Poori', price: 35, category: 'Breakfast' },
    { tamil: 'சப்பாத்தி', english: 'Chapathi', price: 35, category: 'Breakfast' },
    { tamil: 'பொங்கல்', english: 'Pongal', price: 45, category: 'Breakfast' },
    { tamil: 'உப்புமா', english: 'Upma', price: 30, category: 'Breakfast' },
    { tamil: 'பரோட்டா', english: 'Parotta', price: 15, category: 'Dinner' },
    { tamil: 'சாதம்', english: 'Rice', price: 50, category: 'Lunch' },
    { tamil: 'சாம்பார்', english: 'Sambar', price: 20, category: 'Lunch' },
    { tamil: 'ரசம்', english: 'Rasam', price: 15, category: 'Lunch' },
    { tamil: 'தயிர்', english: 'Curd', price: 20, category: 'Lunch' },
  ];

  const insert = db.prepare(`
    INSERT INTO items (name_tamil, name_english, price, category, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);

  for (const item of sampleItems) {
    insert.run(item.tamil, item.english, item.price, item.category);
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
function addItem(nameTamil, nameEnglish, price, category, imagePath = null) {
  const stmt = db.prepare(`
    INSERT INTO items (name_tamil, name_english, price, category, image_path, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  const result = stmt.run(nameTamil, nameEnglish, price, category, imagePath);
  return result.lastInsertRowid;
}

/**
 * Update an existing food item
 * Used by: Admin Page when editing items
 */
function updateItem(id, nameTamil, nameEnglish, price, category, imagePath = null) {
  const stmt = db.prepare(`
    UPDATE items 
    SET name_tamil = ?, name_english = ?, price = ?, category = ?, image_path = ?
    WHERE id = ?
  `);
  stmt.run(nameTamil, nameEnglish, price, category, imagePath, id);
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
function saveBill(items, totalAmount, customerId = null) {
  console.log('--- Database: saveBill called ---');
  console.log('Total Amount:', totalAmount);
  console.log('Raw Customer ID Type:', typeof customerId);

  // Ensure customerId is an integer if provided
  const targetCustomerId = customerId ? parseInt(customerId, 10) : null;
  console.log('Parsed Customer ID:', targetCustomerId);

  // Generate local timestamp (YYYY-MM-DDTHH:MM:SS)
  const now = new Date();
  const localTimestamp = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + 'T' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');

  const transaction = db.transaction((billItems) => {
    // 1. Insert the bill
    const billStmt = db.prepare(`
      INSERT INTO bills (created_at, total_amount)
      VALUES (?, ?)
    `);
    const billResult = billStmt.run(localTimestamp, totalAmount);
    const billId = billResult.lastInsertRowid;
    console.log('Bill created with ID:', billId);

    // 2. Insert all bill items
    const itemStmt = db.prepare(`
      INSERT INTO bill_items (bill_id, item_id, quantity, rate)
      VALUES (?, ?, ?, ?)
    `);
    for (const item of billItems) {
      itemStmt.run(billId, item.id, item.quantity, item.price);
    }

    // 3. If a customerId is provided, link the bill to the credit customer
    if (targetCustomerId) {
      console.log('Linking bill to customer...', targetCustomerId);
      try {
        // Check if credit_bills table exists
        const creditBillsTableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='credit_bills'").get();
        if (!creditBillsTableCheck) {
          console.error('CRITICAL ERROR: credit_bills table does NOT exist!');
          throw new Error('Database table "credit_bills" is missing. Please restart the app.');
        }
        const creditBillStmt = db.prepare(`
                INSERT INTO credit_bills (bill_id, customer_id)
                VALUES (?, ?)
            `);
        creditBillStmt.run(billId, targetCustomerId);
        console.log('Successfully inserted into credit_bills');

        // Verify immediate insertion
        const verify = db.prepare("SELECT * FROM credit_bills WHERE bill_id = ?").get(billId);
        console.log('Verification check (in transaction):', verify);
      } catch (linkError) {
        console.error('ERROR linking bill to customer:', linkError.message);
        throw linkError;
      }
    }

    return billId;
  });

  try {
    const finalBillId = transaction(items);
    console.log('Transaction committed successfully for Bill ID:', finalBillId);
    return finalBillId;
  } catch (err) {
    console.error('TRANSACTION FAILED:', err.message);
    throw err;
  }
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

/**
 * Add a new expense
 * Used by: Expenses Page
 */
function addExpense(description, amount, expenseDate = null) {
  // If no date provided, use today's local date (YYYY-MM-DD)
  const now = new Date();
  const date = expenseDate || (now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0'));

  const stmt = db.prepare(`
    INSERT INTO expenses (expense_date, description, amount)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(date, description, amount);
  return result.lastInsertRowid;
}

/**
 * Get expenses for a date range
 * Used by: Records Page
 */
function getExpensesByDateRange(startDate, endDate) {
  const stmt = db.prepare(`
    SELECT * FROM expenses
    WHERE expense_date >= ? AND expense_date <= ?
    ORDER BY expense_date DESC
  `);
  return stmt.all(startDate, endDate);
}

/**
 * Get daily records (sales, expenses, profit) for a date range
 * Used by: Records Page
 */
function getDailyRecords(startDate, endDate) {
  const stmt = db.prepare(`
    SELECT 
      DATE(b.created_at) as date,
      COALESCE(SUM(CASE WHEN cb.customer_id IS NULL THEN b.total_amount ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN cb.customer_id IS NOT NULL THEN b.total_amount ELSE 0 END), 0) as credit_sales,
      COALESCE(SUM(b.total_amount), 0) as total_sales,
      COUNT(b.id) as bill_count
    FROM bills b
    LEFT JOIN credit_bills cb ON b.id = cb.bill_id
    WHERE DATE(b.created_at) >= ? AND DATE(b.created_at) <= ?
    GROUP BY DATE(b.created_at)
    ORDER BY date DESC
  `);

  const sales = stmt.all(startDate, endDate);

  // Get expenses grouped by date
  const expenseStmt = db.prepare(`
    SELECT 
      expense_date as date,
      COALESCE(SUM(amount), 0) as total_expenses
    FROM expenses
    WHERE expense_date >= ? AND expense_date <= ?
    GROUP BY expense_date
  `);

  const expenses = expenseStmt.all(startDate, endDate);

  // Create a map of expenses by date
  const expenseMap = {};
  expenses.forEach(exp => {
    expenseMap[exp.date] = exp.total_expenses;
  });

  // Combine sales and expenses
  const records = sales.map(sale => ({
    date: sale.date,
    cash_sales: sale.cash_sales,
    credit_sales: sale.credit_sales,
    total_sales: sale.total_sales,
    bill_count: sale.bill_count,
    total_expenses: expenseMap[sale.date] || 0,
    profit: sale.total_sales - (expenseMap[sale.date] || 0)
  }));

  // Add dates that have only expenses (no sales)
  expenses.forEach(exp => {
    if (!records.find(r => r.date === exp.date)) {
      records.push({
        date: exp.date,
        cash_sales: 0,
        credit_sales: 0,
        total_sales: 0,
        bill_count: 0,
        total_expenses: exp.total_expenses,
        profit: -exp.total_expenses
      });
    }
  });

  // Sort by date descending
  records.sort((a, b) => b.date.localeCompare(a.date));

  return records;
}

/**
 * Get bills for a specific date
 * Used by: Records Page when clicking on a day
 */
function getBillsByDate(date) {
  const stmt = db.prepare(`
    SELECT 
      b.id,
      b.created_at,
      b.total_amount,
      TIME(b.created_at) as time,
      cc.name as customer_name,
      CASE WHEN cb.customer_id IS NOT NULL THEN 'CREDIT' ELSE 'CASH' END as bill_type
    FROM bills b
    LEFT JOIN credit_bills cb ON b.id = cb.bill_id
    LEFT JOIN credit_customers cc ON cb.customer_id = cc.id
    WHERE DATE(b.created_at) = ?
    ORDER BY b.created_at DESC
  `);
  return stmt.all(date);
}

/**
 * Get expenses for a specific date
 * Used by: Records Page when clicking on a day
 */
function getExpensesByDate(date) {
  const stmt = db.prepare(`
    SELECT * FROM expenses
    WHERE expense_date = ?
    ORDER BY id DESC
  `);
  return stmt.all(date);
}

// ========== CREDIT SYSTEM FUNCTIONS ==========

/**
 * Add a new credit customer
 */
function addCreditCustomer(name, phone = '') {
  try {
    console.log('--- Attempting to add credit customer ---');
    console.log('Name:', name);
    console.log('Phone:', phone);

    // Check if table exists just in case
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='credit_customers'").get();
    if (!tableCheck) {
      console.error('CRITICAL ERROR: credit_customers table does NOT exist!');
      throw new Error('Database table "credit_customers" is missing. Please restart the app.');
    }

    const stmt = db.prepare(`
      INSERT INTO credit_customers (name, phone)
      VALUES (?, ?)
    `);
    const result = stmt.run(name, phone);
    console.log('Success! New Customer ID:', result.lastInsertRowid);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('DATABASE ERROR in addCreditCustomer:', error.message);
    throw error;
  }
}

/**
 * Add a payment from a credit customer
 */
function addCreditPayment(customerId, amount, date = null) {
  const now = new Date();
  const paymentDate = date || (now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0'));
  const stmt = db.prepare(`
    INSERT INTO credit_payments (customer_id, date, amount)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(customerId, paymentDate, amount);
  return result.lastInsertRowid;
}

/**
 * Get all credit customers with totals and balances
 */
function getAllCreditCustomers() {
  const stmt = db.prepare(`
    SELECT 
      cc.id,
      cc.name,
      cc.phone,
      COALESCE((
        SELECT SUM(b.total_amount)
        FROM bills b
        JOIN credit_bills cb ON b.id = cb.bill_id
        WHERE cb.customer_id = cc.id
      ), 0) as total_credit,
      COALESCE((
        SELECT SUM(amount)
        FROM credit_payments
        WHERE customer_id = cc.id
      ), 0) as total_paid
    FROM credit_customers cc
    ORDER BY cc.name ASC
  `);

  const customers = stmt.all();
  return customers.map(c => ({
    ...c,
    balance: c.total_credit - c.total_paid
  }));
}

/**
 * Get detailed info for a specific credit customer
 */
function getCreditCustomerDetails(customerId) {
  console.log('--- Database: getCreditCustomerDetails called ---');
  console.log('Input Customer ID:', customerId, 'Type:', typeof customerId);

  const targetId = parseInt(customerId, 10);
  console.log('Target ID for query:', targetId);

  // Get customer info and balance
  const customerStmt = db.prepare(`
     SELECT 
      cc.id,
      cc.name,
      cc.phone,
      COALESCE((
        SELECT SUM(b.total_amount)
        FROM bills b
        JOIN credit_bills cb ON b.id = cb.bill_id
        WHERE cb.customer_id = cc.id
      ), 0) as total_credit,
      COALESCE((
        SELECT SUM(amount)
        FROM credit_payments
        WHERE customer_id = cc.id
      ), 0) as total_paid
    FROM credit_customers cc
    WHERE cc.id = ?
  `);

  const customer = customerStmt.get(targetId);
  if (!customer) {
    console.log('No customer found with ID:', targetId);
    return null;
  }

  // Use the ID from the database record for subsequent queries
  const databaseId = customer.id;
  customer.balance = (customer.total_credit || 0) - (customer.total_paid || 0);
  console.log('--- Debug details for', customer.name, '(DB ID:', databaseId, ') ---');

  // Get bills linked to this customer
  const billsStmt = db.prepare(`
    SELECT 
      b.id,
      b.created_at,
      b.total_amount,
      b.created_at as raw_date
    FROM bills b
    JOIN credit_bills cb ON b.id = cb.bill_id
    WHERE cb.customer_id = ?
    ORDER BY b.created_at DESC
  `);

  const rawBills = billsStmt.all(databaseId);
  customer.bills = rawBills.map(b => ({
    ...b,
    // Provide safe defaults for date/time if SQL functions act up
    date: b.raw_date ? b.raw_date.split('T')[0] : '',
    time: b.raw_date ? b.raw_date.split('T')[1]?.split('.')[0] : ''
  }));

  console.log('Bills query result count:', customer.bills.length);
  if (customer.bills.length > 0) {
    console.log('First bill example:', customer.bills[0]);
  }

  // Get payments made by this customer
  const paymentsStmt = db.prepare(`
    SELECT id, date, amount
    FROM credit_payments
    WHERE customer_id = ?
    ORDER BY date DESC, id DESC
  `);
  customer.payments = paymentsStmt.all(databaseId);
  console.log('Payments query result count:', customer.payments.length);

  return customer;
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
  // New expense functions
  addExpense,
  getExpensesByDateRange,
  getDailyRecords,
  getBillsByDate,
  getExpensesByDate,
  // New credit functions
  addCreditCustomer,
  addCreditPayment,
  getAllCreditCustomers,
  getCreditCustomerDetails,
  db, // Export the database connection for advanced use
};
