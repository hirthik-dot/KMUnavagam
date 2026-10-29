// database.js - SQLite Database Handler
// This file manages all database operations for the hotel billing app

const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");
const fs = require("fs");
const dbSafety = require("./dbSafety");
const logger = require("./logger");

// Get the path where we'll store the database
// For development: inside the project folder
// For production: inside the user's AppData folder
const isDev = process.env.NODE_ENV === "development";
const dbPath = isDev
  ? path.join(__dirname, "..", "database", "hotel.db")
  : path.join(app.getPath("userData"), "database", "hotel.db");

// Make sure the database folder exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Backup directory definition
const backupDir = isDev
  ? path.join(__dirname, "..", "backups")
  : path.join(app.getPath("userData"), "backups");

// The DB instance
let db = null;

// FIX A: At top of database.js, after let db = null;, add global runtime guard
function assertDbReady() {
  if (!db) {
    throw new Error("Database accessed before initialization");
  }
}

/**
 * Guard: Strictly prevent usage before initialization
 */
function ensureDb() {
  assertDbReady(); // Call assertDbReady() inside ensureDb() before returning
  return db;
}

/**
 * Validate and round monetary values before writing to DB.
 * Rejects NaN, Infinity, and negative values.
 * Rounds to 2 decimal places to prevent float drift.
 */
function validateAndRound(val, fieldName) {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Invalid numeric value for ${fieldName}: ${val}`);
  }
  return Math.round(num * 100) / 100;
}

/**
 * Bill total computed from its item lines (rate rounded to the paisa x whole quantity).
 * The stored bill total is always this value, so it can never disagree with the items.
 */
function billTotalFromItems(items, clientTotal) {
  let paise = 0;
  for (const item of items) {
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error(`Invalid quantity for item ${item.id}: ${item.quantity}`);
    }
    paise += Math.round(validateAndRound(item.price, 'item.price') * 100) * qty;
  }
  const total = paise / 100;
  if (Math.abs(total - clientTotal) > 0.001) {
    logger.log(`[DB] Bill total corrected from ${clientTotal} to ${total} (sum of items)`, 'WARN');
  }
  return total;
}

/**
 * Helper: Get table structure info
 * Uses PRAGMA table_info() to safely check existing columns
 */
function getTableColumns(tableName) {
  const database = ensureDb();
  try {
    const stmt = database.prepare(`PRAGMA table_info(${tableName})`);
    return stmt.all().map((col) => col.name);
  } catch (error) {
    return [];
  }
}

/**
 * Initialize the database - create tables if they don't exist
 * This runs when the app starts.
 */
async function initializeDatabase() {
  logger.log("🔧 Starting deterministic DB initialization...", "INFO");

  try {
    logger.log(`📁 Database location: ${dbPath}`, "INFO");

    // 1. Create SQLite connection (db instance)
    db = new Database(dbPath);

    // CRITICAL: Verify DB integrity before proceeding.
    // Prevents a silently corrupted DB from contaminating backups.
    const integrity = db.pragma('integrity_check');
    if (!Array.isArray(integrity) || integrity[0].integrity_check !== 'ok') {
      throw new Error('Database integrity check failed on startup. Refusing to start.');
    }
    logger.log('[DB] Integrity check passed ✅', 'INFO');

    // 2. Enable WAL + synchronous FULL (immediate safety) — will throw if it fails
    dbSafety.enableWAL(db);

    // Proceed with table initialization...
    logger.log("🔧 Initializing tables...", "INFO");

    /**
     * Helper: Safely add column if it doesn't exist
     * Prevents "column already exists" errors
     */
    function addColumnIfNotExists(tableName, columnDef) {
      try {
        const columns = getTableColumns(tableName);
        const columnName = columnDef.split(" ")[0];

        if (!columns.includes(columnName)) {
          ensureDb().exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`);
          console.log(`✅ Added column: ${tableName}.${columnName}`);
        }
      } catch (error) {
        console.warn(
          `⚠️  Failed to add column to ${tableName}:`,
          error.message,
        );
      }
    }

    /**
     * FIX C — Add Logical Schema Integrity Check
     * Verifies existence of required tables.
     */
    function verifyRequiredSchema() {
      const database = ensureDb();

      const requiredTables = [
        "items",
        "bills",
        "bill_items",
        "expenses",
        "credit_customers",
        "credit_bills",
        "credit_payments",
        "categories",
        "suppliers",
        "employees",
        "employee_transactions",
        "vendors",
        "vendor_transactions"
      ];

      for (const table of requiredTables) {
        const exists = database
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          )
          .get(table);

        if (!exists) {
          throw new Error(`CRITICAL: Missing required table: ${table}`);
        }
      }
    }

    /**
     * Initialize the database - create tables if they don't exist
     * This runs when the app starts for the first time
     * Uses PRAGMA table_info() for safe migrations
     */
    async function initializeDatabaseTablesAndData() {
      // Renamed to avoid conflict with outer function
      logger.log("🔧 Initializing database...", "INFO");

      try {
        // ... (omitting table creation for brevity)
        // Table 1: items - stores all food items
        // FIXED: Removed duplicate category column definition
        ensureDb().exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_tamil TEXT NOT NULL,
        name_english TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT DEFAULT 'Other',
        image_path TEXT,
        is_active INTEGER DEFAULT 1
      )
    `);

        // Safe migration: Ensure critical columns exist
        addColumnIfNotExists("items", "category TEXT DEFAULT 'Other'");
        addColumnIfNotExists("items", "image_path TEXT");
        addColumnIfNotExists("items", "is_active INTEGER DEFAULT 1");
        addColumnIfNotExists("items", "name_hindi TEXT");

        // Table 2: bills - stores bill information
        ensureDb().exec(`
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        total_amount REAL NOT NULL,
        supplier_id INTEGER,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      )
    `);

        // Safe migration: Add supplier_id if missing
        addColumnIfNotExists("bills", "supplier_id INTEGER");

        // Table 3: suppliers - stores staff/waiters who attend orders
        ensureDb().exec(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        is_active INTEGER DEFAULT 1,
        is_deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Safe migration: Add is_deleted if missing
        addColumnIfNotExists("suppliers", "is_deleted INTEGER DEFAULT 0");
        addColumnIfNotExists("suppliers", "is_active INTEGER DEFAULT 1");
        addColumnIfNotExists("suppliers", "daily_wage REAL DEFAULT 0");

        // Table 4: bill_items - stores items in each bill
        ensureDb().exec(`
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

        // Table 5: expenses - stores daily expenses
        ensureDb().exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL
      )
    `);

        // Table 6: credit_customers - stores customers who buy on credit
        ensureDb().exec(`
      CREATE TABLE IF NOT EXISTS credit_customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        is_deleted INTEGER DEFAULT 0
      )
    `);

        // Safe migration: Add is_deleted if missing
        addColumnIfNotExists("credit_customers", "is_deleted INTEGER DEFAULT 0");

        // Table 7: credit_bills - links bills to credit customers
        ensureDb().exec(`
      CREATE TABLE IF NOT EXISTS credit_bills (
        bill_id INTEGER PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES bills(id),
        FOREIGN KEY (customer_id) REFERENCES credit_customers(id)
      )
    `);

        // Table 8: credit_payments - stores payments made by credit customers
        ensureDb().exec(`
      CREATE TABLE IF NOT EXISTS credit_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES credit_customers(id)
      )
    `);

        // Table 9: categories - stores food item categories
        ensureDb().exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Table 10: vendors - stores shops/vendors for credit
        ensureDb().exec(`
      CREATE TABLE IF NOT EXISTS vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        phone TEXT,
        is_active INTEGER DEFAULT 1,
        is_deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Safe migration: Add is_deleted and is_active if missing
        addColumnIfNotExists("vendors", "is_deleted INTEGER DEFAULT 0");
        addColumnIfNotExists("vendors", "is_active INTEGER DEFAULT 1");

        // Table 11: vendor_transactions - stores credit taking and payments
        ensureDb().exec(`
      CREATE TABLE IF NOT EXISTS vendor_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        transaction_date TEXT NOT NULL,
        type TEXT NOT NULL, -- 'CREDIT' (debt) or 'PAYMENT' (repayment)
        description TEXT,
        expense_id INTEGER, -- Link to expenses table if it's a payment
        FOREIGN KEY (vendor_id) REFERENCES vendors(id),
        FOREIGN KEY (expense_id) REFERENCES expenses(id)
      )
    `);

      // Table 12: employee_transactions - stores wages and payments for employees
      ensureDb().exec(`
      CREATE TABLE IF NOT EXISTS employee_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        transaction_date TEXT NOT NULL,
        type TEXT NOT NULL, -- 'WAGE' (earned) or 'PAYMENT' (given)
        description TEXT,
        expense_id INTEGER, -- Link to expenses table if it's a payment
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (expense_id) REFERENCES expenses(id)
      )
    `);

      // Table 13: employees - stores staff members (cleaning, cooking, etc.)
      ensureDb().exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        is_active INTEGER DEFAULT 1,
        is_deleted INTEGER DEFAULT 0,
        daily_wage REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

      // Safe migration for employees
      addColumnIfNotExists("employees", "is_deleted INTEGER DEFAULT 0");
      addColumnIfNotExists("employees", "is_active INTEGER DEFAULT 1");
      addColumnIfNotExists("employees", "daily_wage REAL DEFAULT 0");

      // Table 14: staff_transactions (Legacy/Suppliers-related)
      ensureDb().exec(`
      CREATE TABLE IF NOT EXISTS staff_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        staff_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        transaction_date TEXT NOT NULL,
        type TEXT NOT NULL, -- 'WAGE' (earned) or 'PAYMENT' (given)
        description TEXT,
        expense_id INTEGER, -- Link to expenses table if it's a payment
        FOREIGN KEY (staff_id) REFERENCES suppliers(id),
        FOREIGN KEY (expense_id) REFERENCES expenses(id)
      )
    `);

        // PERFORMANCE: Index on DATE(created_at) prevents full-table scans
        // on all date-range queries (getDailyRecords, getBillsByDate, getTodayStats).
        // This becomes critical after ~50,000 bills.
        ensureDb().exec(`
          CREATE INDEX IF NOT EXISTS idx_bills_date ON bills (DATE(created_at))
        `);

        // Add default categories if table is empty
        const categoryCount = ensureDb()
          .prepare("SELECT COUNT(*) as count FROM categories")
          .get();
        if (categoryCount.count === 0) {
          console.log("📝 Adding default categories...");
          const defaultCategories = [
            "Tiffin",
            "Dosa",
            "Parotta",
            "Gravy",
            "Chinese",
            "Other",
          ];
          const insertCategory = ensureDb().prepare(
            "INSERT INTO categories (name) VALUES (?)",
          );
          for (const cat of defaultCategories) {
            insertCategory.run(cat);
          }
        }

        // FIX C: Verify schema before migrations/operations
        verifyRequiredSchema();

        // Migrate legacy categories to new ones
        logger.log("🔄 Checking for legacy categories...", "INFO");
        migrateLegacyCategories();

        // Add some sample food items if the database is empty
        const count = ensureDb()
          .prepare("SELECT COUNT(*) as count FROM items")
          .get();
        if (count.count === 0) {
          logger.log("📝 Adding sample food items...", "INFO");
          addSampleItems();
        }

        logger.log("✅ Database initialized successfully!", "INFO");

        // FEATURE 2D: STARTUP & FIRST-DAY PROTECTION
        // 1. Initial daily snapshot (idempotent, ensures we have history even if app crashed yesterday)
        await dbSafety.createDailySnapshot(db, dbPath, backupDir);

        // 2. Ensure basic backups exist
        await dbSafety.ensureFirstDayBackups(db, dbPath, backupDir);
      } catch (error) {
        logger.log(
          `❌ Database initialization failed: ${error.message}`,
          "ERROR",
        );
        logger.log(error, "ERROR");
        throw error; // Re-throw to prevent app from running with broken DB
      }
    }

    /**
     * Migrate legacy categories to new category system
     * Maps old hardcoded categories to new database categories
     */
    function migrateLegacyCategories() {
      try {
        const database = ensureDb();
        // Get all valid categories from the categories table
        const validCategories = database
          .prepare("SELECT name FROM categories")
          .all()
          .map((c) => c.name);
        console.log("✅ Valid categories:", validCategories.join(", "));

        // Define mapping from old categories to new ones
        const categoryMap = {
          Breakfast: "Tiffin",
          Lunch: "Other",
          Dinner: "Parotta",
        };

        // Update items with mapped categories
        let totalUpdated = 0;
        for (const [oldCat, newCat] of Object.entries(categoryMap)) {
          const result = database
            .prepare("UPDATE items SET category = ? WHERE category = ?")
            .run(newCat, oldCat);
          if (result.changes > 0) {
            console.log(
              `  ✓ Migrated ${result.changes} items from '${oldCat}' to '${newCat}'`,
            );
            totalUpdated += result.changes;
          }
        }

        // Set any remaining invalid categories to 'Other'
        // FIX: Wrap in a single transaction — if app crashes mid-loop,
        // all updates roll back atomically. Without this, partial migration is permanent.
        const items = database.prepare("SELECT id, category FROM items").all();
        let invalidCount = 0;
        const updateInvalidCategory = database.prepare("UPDATE items SET category = ? WHERE id = ?");
        database.transaction(() => {
          for (const item of items) {
            if (!validCategories.includes(item.category)) {
              updateInvalidCategory.run("Other", item.id);
              console.log(
                `  ✓ Set invalid category '${item.category}' to 'Other' for item ID ${item.id}`,
              );
              invalidCount++;
            }
          }
        })();

        if (totalUpdated > 0 || invalidCount > 0) {
          console.log(
            `✅ Migration complete: ${totalUpdated + invalidCount} items updated`,
          );
        } else {
          console.log("✅ No legacy categories found - all items up to date");
        }
      } catch (error) {
        console.error("⚠️  Category migration failed:", error.message);
      }
    }

    /**
     * Add sample food items to the database
     * This helps you test the app immediately
     */
    function addSampleItems() {
      const sampleItems = [
        { tamil: "தோசை", english: "Dosa", price: 40, category: "Dosa" },
        { tamil: "இட்லி", english: "Idly", price: 30, category: "Tiffin" },
        { tamil: "வடை", english: "Vada", price: 20, category: "Tiffin" },
        { tamil: "பூரி", english: "Poori", price: 35, category: "Tiffin" },
        {
          tamil: "சப்பாத்தி",
          english: "Chapathi",
          price: 35,
          category: "Tiffin",
        },
        { tamil: "பொங்கல்", english: "Pongal", price: 45, category: "Tiffin" },
        { tamil: "உப்புமா", english: "Upma", price: 30, category: "Tiffin" },
        {
          tamil: "பரோட்டா",
          english: "Parotta",
          price: 15,
          category: "Parotta",
        },
        { tamil: "சாதம்", english: "Rice", price: 50, category: "Other" },
        { tamil: "சாம்பார்", english: "Sambar", price: 20, category: "Gravy" },
        { tamil: "ரசம்", english: "Rasam", price: 15, category: "Gravy" },
        { tamil: "தயிர்", english: "Curd", price: 20, category: "Other" },
      ];

      const insert = ensureDb().prepare(`
    INSERT INTO items (name_tamil, name_english, price, category, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);

      for (const item of sampleItems) {
        insert.run(item.tamil, item.english, item.price, item.category);
      }
    }

    // Call the inner initialization function
    await initializeDatabaseTablesAndData();
  } catch (error) {
    logger.log(
      `❌ FATAL: Database initialization failed: ${error.message}`,
      "ERROR",
    );
    logger.log(error.stack, "ERROR");
    // Ensure the app exits if DB init fails
    app.exit(1);
  }
}

// ==================== DATABASE OPERATIONS ====================

/**
 * Get all active food items
 * Used by: Billing Page to show food items
 */
function getAllItems() {
  const stmt = ensureDb().prepare(
    "SELECT * FROM items WHERE is_active = 1 ORDER BY name_english",
  );
  return stmt.all();
}

/**
 * Get all items (including inactive ones)
 * Used by: Admin Page to manage all items
 */
function getAllItemsAdmin() {
  const stmt = ensureDb().prepare("SELECT * FROM items ORDER BY name_english");
  return stmt.all();
}

/**
 * Add a new food item
 * Used by: Admin Page when adding new items
 * If an item with the same English name already exists (even if inactive/deleted),
 * reactivate it with the new details instead of inserting a duplicate.
 */
function addItem(
  nameTamil,
  nameEnglish,
  price,
  imagePath = null,
  category = "Other",
  nameHindi = null,
) {
  const database = ensureDb();

  // Check if an item with the same English name already exists (active or inactive)
  const existing = database
    .prepare("SELECT id, is_active FROM items WHERE LOWER(name_english) = LOWER(?)")
    .get(nameEnglish);

  if (existing) {
    if (existing.is_active === 1) {
      // Item is already active — don't allow duplicate
      throw new Error(`An active item named "${nameEnglish}" already exists.`);
    } else {
      // Item was previously deleted (soft-deleted) — reactivate and update it
      database
        .prepare(`
          UPDATE items
          SET name_tamil = ?, name_hindi = ?, price = ?, image_path = ?, category = ?, is_active = 1
          WHERE id = ?
        `)
        .run(nameTamil, nameHindi, price, imagePath, category, existing.id);
      return existing.id;
    }
  }

  // No existing item — insert fresh
  const stmt = database.prepare(`
    INSERT INTO items (name_tamil, name_english, name_hindi, price, image_path, category, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  const result = stmt.run(nameTamil, nameEnglish, nameHindi, price, imagePath, category);
  return result.lastInsertRowid;
}

/**
 * Update an existing food item
 * Used by: Admin Page when editing items
 */
function updateItem(
  id,
  nameTamil,
  nameEnglish,
  price,
  imagePath = null,
  category = "Other",
  nameHindi = null,
) {
  const stmt = ensureDb().prepare(`
    UPDATE items
    SET name_tamil = ?, name_english = ?, name_hindi = ?, price = ?, image_path = ?, category = ?
    WHERE id = ?
  `);
  stmt.run(nameTamil, nameEnglish, nameHindi, price, imagePath, category, id);
}

/**
 * Read a value from app_settings
 * Used by: Admin Page / Print Preview (e.g. default bill print language)
 */
function getSetting(key, defaultValue = null) {
  const row = ensureDb()
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key);
  return row ? row.value : defaultValue;
}

/**
 * Save a value to app_settings (insert or overwrite)
 */
function setSetting(key, value) {
  ensureDb()
    .prepare(`
      INSERT INTO app_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .run(key, value);
}

/**
 * Toggle item active status (enable/disable)
 * Used by: Admin Page to hide/show items
 */
function toggleItemStatus(id, isActive) {
  const stmt = ensureDb().prepare(
    "UPDATE items SET is_active = ? WHERE id = ?",
  );
  stmt.run(isActive ? 1 : 0, id);
}

/**
 * Delete a food item
 * Used by: Admin Page to remove items
 *
 * If the item has NEVER been used in a bill, it is hard-deleted permanently.
 * If it HAS been used in bills, it is soft-deleted (is_active = 0) to preserve
 * financial history (getBillItems JOIN still works for past records).
 */
function deleteItem(id) {
  const database = ensureDb();

  // Check if this item has ever been used in any bill
  const usedInBill = database
    .prepare("SELECT COUNT(*) as cnt FROM bill_items WHERE item_id = ?")
    .get(id);

  if (usedInBill && usedInBill.cnt > 0) {
    // Item is referenced in bill history — soft delete to protect financial records
    const result = database
      .prepare("UPDATE items SET is_active = 0 WHERE id = ?")
      .run(id);
    return result.changes;
  } else {
    // Item has never been billed — safe to permanently delete
    const result = database
      .prepare("DELETE FROM items WHERE id = ?")
      .run(id);
    return result.changes;
  }
}

/**
 * Get the next likely bill ID (for preview purposes)
 */
function getNextBillId() {
  try {
    const database = ensureDb();
    // Check sqlite_sequence for the last auto-increment value
    const stmt = database.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'bills'");
    const result = stmt.get();
    
    // If no bills yet, start at 1. Otherwise next is seq + 1
    return result ? result.seq + 1 : 1;
  } catch (error) {
    console.error("Error getting next bill ID:", error);
    return 1; // Fallback
  }
}

/**
 * Save a new bill to the database
 * Used by: Billing Page when printing a bill
 */
function saveBill(items, totalAmount, customerId = null, supplierId = null, customDate = null) {

  // Validate monetary input — reject NaN, Infinity, negatives
  totalAmount = validateAndRound(totalAmount, 'totalAmount');
  totalAmount = billTotalFromItems(items, totalAmount);

  // Ensure IDs are integers if provided
  const targetCustomerId = customerId ? parseInt(customerId, 10) : null;
  const targetSupplierId = supplierId ? parseInt(supplierId, 10) : null;

  // Generate local timestamp (YYYY-MM-DDTHH:MM:SS)
  let localTimestamp;
  if (customDate) {
    // If customDate is provided (YYYY-MM-DD), add current time to it
    const now = new Date();
    localTimestamp = customDate + "T" +
      String(now.getHours()).padStart(2, "0") + ":" +
      String(now.getMinutes()).padStart(2, "0") + ":" +
      String(now.getSeconds()).padStart(2, "0");
  } else {
    const now = new Date();
    localTimestamp =
      now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0") + "T" +
      String(now.getHours()).padStart(2, "0") + ":" +
      String(now.getMinutes()).padStart(2, "0") + ":" +
      String(now.getSeconds()).padStart(2, "0");
  }

  logger.log(`[DB] Saving bill — total: ${totalAmount}, customer: ${targetCustomerId ?? 'none'}, supplier: ${targetSupplierId ?? 'none'}, date: ${localTimestamp}`, 'INFO');

  const database = ensureDb();
  const transaction = database.transaction((billItems) => {
    // 1. Insert the bill
    const billStmt = database.prepare(`
      INSERT INTO bills (created_at, total_amount, supplier_id)
      VALUES (?, ?, ?)
    `);
    const billResult = billStmt.run(
      localTimestamp,
      totalAmount,
      targetSupplierId,
    );
    const billId = billResult.lastInsertRowid;
  
    // 2. Insert all bill items
    const itemStmt = database.prepare(`
      INSERT INTO bill_items (bill_id, item_id, quantity, rate)
      VALUES (?, ?, ?, ?)
    `);
    for (const item of billItems) {
      itemStmt.run(billId, item.id, item.quantity, validateAndRound(item.price, 'item.price'));
    }

    // 3. If a customerId is provided, link the bill to the credit customer
    if (targetCustomerId) {
      try {
        const creditBillStmt = database.prepare(`
                INSERT INTO credit_bills (bill_id, customer_id)
                VALUES (?, ?)
            `);
        creditBillStmt.run(billId, targetCustomerId);
      } catch (linkError) {
        logger.log(`Error linking bill ${billId} to customer ${targetCustomerId}: ${linkError.message}`, 'ERROR');
        throw linkError;
      }
    }

    return billId;
  });

  try {
    const finalBillId = transaction(items);
    logger.log(`✅ Bill ${finalBillId} saved successfully for date: ${localTimestamp}`, "INFO");

    /*
    CRITICAL DURABILITY FIX:
    Immediately update rolling backup AFTER successful commit.
    This guarantees crash safety even if power loss happens 1 second later.
    */
    // FIX B: Handled as non-blocking background task to keep billing UI responsive
    // Use queueMicrotask and await as per FIX B requirements
    queueMicrotask(async () => {
      await dbSafety.updateLatestBackup(db, dbPath, backupDir);
    });

    return finalBillId;
  } catch (err) {
    logger.log(`❌ TRANSACTION FAILED in saveBill: ${err.message}`, "ERROR");
    throw err;
  }
}

/**
 * Get bill history (for future reports feature)
 * Used by: Future reports page
 */
function getBillHistory(limit = 50) {
  const stmt = ensureDb().prepare(`
    SELECT b.*, s.name as supplier_name 
    FROM bills b
    LEFT JOIN suppliers s ON b.supplier_id = s.id
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
  const stmt = ensureDb().prepare(`
    SELECT 
      bi.quantity,
      bi.rate,
      bi.item_id,
      i.id,
      i.name_tamil,
      i.name_english,
      i.name_hindi,
      i.image_path
    FROM bill_items bi
    JOIN items i ON bi.item_id = i.id
    WHERE bi.bill_id = ?
  `);
  return stmt.all(billId);
}

/**
 * Update an existing bill
 * Used by: Edit & Reprint feature
 */
function updateBill(billId, items, totalAmount, supplierId = null, customDate = null) {

  // Validate monetary input — reject NaN, Infinity, negatives
  totalAmount = validateAndRound(totalAmount, 'totalAmount');
  totalAmount = billTotalFromItems(items, totalAmount);

  const database = ensureDb();
  const transaction = database.transaction((billItems) => {
    // 1. ALWAYS update bill total and supplier; only update date if customDate provided
    if (customDate) {
      const now = new Date();
      const localTimestamp = customDate + "T" +
        String(now.getHours()).padStart(2, "0") + ":" +
        String(now.getMinutes()).padStart(2, "0") + ":" +
        String(now.getSeconds()).padStart(2, "0");

      database.prepare(`
        UPDATE bills 
        SET created_at = ?, total_amount = ?, supplier_id = ?
        WHERE id = ?
      `).run(localTimestamp, totalAmount, supplierId, billId);
    } else {
      // FIX C1: Always update total and supplier even without date change
      database.prepare(`
        UPDATE bills 
        SET total_amount = ?, supplier_id = ?
        WHERE id = ?
      `).run(totalAmount, supplierId, billId);
    }
    // SAFETY FIX: Preserve existing credit_bills link if it exists
    // This allows editing a bill without losing its "Credit" status.
    const existingCredit = database.prepare("SELECT customer_id FROM credit_bills WHERE bill_id = ?").get(billId);
    if (existingCredit) {
      // Re-insert link (using INSERT OR IGNORE just in case, though it should stay)
      database.prepare("INSERT OR IGNORE INTO credit_bills (bill_id, customer_id) VALUES (?, ?)").run(billId, existingCredit.customer_id);
    }

    // 2. Delete old bill items
    const deleteStmt = database.prepare(`
      DELETE FROM bill_items 
      WHERE bill_id = ?
    `);
    deleteStmt.run(billId);

    // 3. Insert new bill items
    const itemStmt = database.prepare(`
      INSERT INTO bill_items (bill_id, item_id, quantity, rate)
      VALUES (?, ?, ?, ?)
    `);
    for (const item of billItems) {
      const itemId = item.item_id || item.id;
      itemStmt.run(billId, itemId, item.quantity, validateAndRound(item.price, 'item.price'));
    }
    return billId;
  });

  try {
    const finalBillId = transaction(items);
    logger.log(`✅ Bill ${finalBillId} updated successfully for date: ${customDate || 'original'}`, "INFO");

    /*
    CRITICAL DURABILITY FIX:
    Immediately update rolling backup AFTER successful commit.
    This guarantees crash safety even if power loss happens 1 second later.
    */
    // FIX B: Handled as non-blocking background task to keep billing UI responsive
    // Use queueMicrotask and await as per FIX B requirements
    queueMicrotask(async () => {
      await dbSafety.updateLatestBackup(db, dbPath, backupDir);
    });

    return finalBillId;
  } catch (err) {
    logger.log(`❌ UPDATE TRANSACTION FAILED: ${err.message}`, "ERROR");
    throw err;
  }
}

/**
 * Delete a bill permanently
 * Used when an order is cancelled
 */
function deleteBill(billId) {
  const bId = parseInt(billId);
  if (isNaN(bId)) {
    logger.log(`❌ deleteBill called with invalid ID: ${billId}`, "ERROR");
    throw new Error(`Invalid Bill ID: ${billId}`);
  }

  logger.log(`📡 Attempting to delete bill ${bId}...`, "INFO");
  const database = ensureDb();

  try {
    return database.transaction(() => {
      // 1. Delete from child tables FIRST (Foreign Key safety)
      const res1 = database.prepare("DELETE FROM credit_bills WHERE bill_id = ?").run(bId);
      logger.log(`   - Deleted from credit_bills: ${res1.changes} rows`, "INFO");

      const res2 = database.prepare("DELETE FROM bill_items WHERE bill_id = ?").run(bId);
      logger.log(`   - Deleted from bill_items: ${res2.changes} rows`, "INFO");

      // 2. Delete from main bills table
      const result = database.prepare("DELETE FROM bills WHERE id = ?").run(bId);

      if (result.changes > 0) {
        logger.log(`✅ Successfully deleted bill ${bId} from all tables.`, "INFO");
        return true;
      } else {
        logger.log(`⚠️  No bill found with ID ${bId} in main table.`, "WARN");
        return false;
      }
    })();
  } catch (error) {
    logger.log(`❌ Error in deleteBill transaction (ID: ${bId}): ${error.message}`, "ERROR");
    throw error; // Let main.js handle the IPC throw
  }
}

/**
 * Add a new expense
 * Used by: Expenses Page
 */
function addExpense(description, amount, expenseDate = null) {
  // Validate monetary input before transaction
  amount = validateAndRound(amount, 'amount');
  return ensureDb().transaction(() => {
    // If no date provided, use today's local date (YYYY-MM-DD)
    const now = new Date();
    const date =
      expenseDate ||
      now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0");

    const stmt = ensureDb().prepare(`
      INSERT INTO expenses (expense_date, description, amount)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(date, description, amount);
    return result.lastInsertRowid;
  })();
}

/**
 * Update an existing expense
 */
function updateExpense(expenseId, description, amount, expenseDate = null) {
  // FIX H2: Validate monetary input on update path
  amount = validateAndRound(amount, 'amount');
  return ensureDb().transaction(() => {
    const database = ensureDb();
    
    // 1. Update the linked vendor payment if it exists.
    // Its note is the part inside "Vendor Payment: Name (note)", not the whole expense text
    // (copying the whole text nested it again on every edit)
    const vendorLink = database.prepare(`
      SELECT vt.id, vt.description, v.name FROM vendor_transactions vt
      JOIN vendors v ON v.id = vt.vendor_id
      WHERE vt.expense_id = ?
    `).get(expenseId);
    if (vendorLink) {
      const note = linkedNoteFromExpense(description, `Vendor Payment: ${vendorLink.name}`, vendorLink.description);
      database.prepare(`
        UPDATE vendor_transactions 
        SET amount = ?, description = ?, transaction_date = COALESCE(?, transaction_date)
        WHERE id = ?
      `).run(amount, note, expenseDate, vendorLink.id);
    }

    // 2. Update the linked staff transaction if it exists
    if (expenseDate) {
      database.prepare(`
        UPDATE staff_transactions 
        SET amount = ?, description = ?, transaction_date = ?
        WHERE expense_id = ?
      `).run(amount, description, expenseDate, expenseId);
    } else {
      database.prepare(`
        UPDATE staff_transactions
        SET amount = ?, description = ?
        WHERE expense_id = ?
      `).run(amount, description, expenseId);
    }

    // 2b. Update the linked employee payment (Staff page "Give Cash") so the employee balance matches.
    // Its note is the part inside "Staff Payment: Name (note)"
    const employeeLink = database.prepare(`
      SELECT et.id, et.description, e.name FROM employee_transactions et
      JOIN employees e ON e.id = et.employee_id
      WHERE et.expense_id = ?
    `).get(expenseId);
    if (employeeLink) {
      const note = linkedNoteFromExpense(description, `Staff Payment: ${employeeLink.name}`, employeeLink.description);
      database.prepare(`
        UPDATE employee_transactions
        SET amount = ?, description = ?, transaction_date = COALESCE(?, transaction_date)
        WHERE id = ?
      `).run(amount, note, expenseDate, employeeLink.id);
    }

    // 3. Update the expense itself
    if (expenseDate) {
      database.prepare(`
        UPDATE expenses 
        SET description = ?, amount = ?, expense_date = ?
        WHERE id = ?
      `).run(description, amount, expenseDate, expenseId);
    } else {
      database.prepare(`
        UPDATE expenses 
        SET description = ?, amount = ?
        WHERE id = ?
      `).run(description, amount, expenseId);
    }
    return 1;
  })();
}

/**
 * Note for a vendor/staff payment from its linked expense text.
 * "Vendor Payment: Ravi (rice)" -> "rice", "Vendor Payment: Ravi" -> "".
 * If the text was changed to something else entirely, the existing note is kept.
 */
function linkedNoteFromExpense(expenseDescription, prefix, currentNote) {
  const text = (expenseDescription || '').trim();
  if (text === prefix) return '';
  if (text.startsWith(prefix + ' (') && text.endsWith(')')) {
    return text.slice(prefix.length + 2, -1);
  }
  return currentNote;
}

/**
 * Delete an expense
 */
function deleteExpense(expenseId) {
  const eId = parseInt(expenseId, 10);
  if (isNaN(eId)) {
    logger.log(`❌ deleteExpense called with invalid ID: ${expenseId}`, "ERROR");
    throw new Error(`Invalid Expense ID: ${expenseId}`);
  }

  try {
    return ensureDb().transaction(() => {
      const database = ensureDb();
      
      // 1. Delete linked transactions from all possible child tables
      // This is necessary to satisfy foreign key constraints before deleting the parent expense
      
      const vRes = database.prepare('DELETE FROM vendor_transactions WHERE expense_id = ?').run(eId);
      if (vRes.changes > 0) logger.log(`   - Deleted ${vRes.changes} linked vendor transactions`, "INFO");
      
      const sRes = database.prepare('DELETE FROM staff_transactions WHERE expense_id = ?').run(eId);
      if (sRes.changes > 0) logger.log(`   - Deleted ${sRes.changes} linked staff transactions`, "INFO");

      // Employee payment ("Give Cash" on the Staff page) is the same money: remove it too
      const eRes = database.prepare('DELETE FROM employee_transactions WHERE expense_id = ?').run(eId);
      if (eRes.changes > 0) logger.log(`   - Deleted ${eRes.changes} linked employee payments`, "INFO");
      
      // 2. Now delete the expense itself
      const result = database.prepare('DELETE FROM expenses WHERE id = ?').run(eId);
      
      if (result.changes > 0) {
        logger.log(`✅ Successfully deleted expense ${eId} and its associations.`, "INFO");
        return result.changes;
      } else {
        logger.log(`⚠️ No expense found with ID ${eId}`, "WARN");
        return 0;
      }
    })();
  } catch (error) {
    logger.log(`❌ Error in deleteExpense (ID: ${eId}): ${error.message}`, "ERROR");
    throw error;
  }
}

/**
 * Get today's expenses
 */
function getTodayExpenses() {
  const now = new Date();
  const today =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");

  const stmt = ensureDb().prepare(`
    SELECT * FROM expenses
    WHERE expense_date = ?
    ORDER BY id DESC
  `);
  return stmt.all(today);
}

/**
 * Get today's summary stats (cash sales, credit sales, expenses)
 */
function getTodayStats() {
  const now = new Date();
  const today =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");

  const database = ensureDb();
  // Get today's cash, credit and total sales
  const salesStmt = database.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN cb.bill_id IS NULL THEN b.total_amount ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN cb.bill_id IS NOT NULL THEN b.total_amount ELSE 0 END), 0) as credit_sales,
      COALESCE(SUM(b.total_amount), 0) as total_sales
    FROM bills b
    LEFT JOIN credit_bills cb ON b.id = cb.bill_id
    WHERE DATE(b.created_at) = ?
  `);
  const sales = salesStmt.get(today) || {
    cash_sales: 0,
    credit_sales: 0,
    total_sales: 0,
  };

  // Get today's total expenses
  const expenseStmt = database.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_expenses
    FROM expenses
    WHERE expense_date = ?
  `);
  const expenses = expenseStmt.get(today) || { total_expenses: 0 };

  return {
    cashSales: sales.cash_sales,
    creditSales: sales.credit_sales,
    totalSales: sales.total_sales,
    totalExpenses: expenses.total_expenses,
  };
}

/**
 * Get expenses for a date range
 * Used by: Records Page
 */
function getExpensesByDateRange(startDate, endDate) {
  const stmt = ensureDb().prepare(`
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
function getDailyRecords(startDate, endDate, supplierId = null) {
  let query = `
    SELECT 
      DATE(b.created_at) as date,
      COALESCE(SUM(CASE WHEN cb.bill_id IS NULL THEN b.total_amount ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN cb.bill_id IS NOT NULL THEN b.total_amount ELSE 0 END), 0) as credit_sales,
      COALESCE(SUM(b.total_amount), 0) as total_sales,
      COUNT(b.id) as bill_count
    FROM bills b
    LEFT JOIN credit_bills cb ON b.id = cb.bill_id
    WHERE DATE(b.created_at) >= ? AND DATE(b.created_at) <= ?
  `;

  const params = [startDate, endDate];

  if (supplierId) {
    query += ` AND b.supplier_id = ? `;
    params.push(parseInt(supplierId, 10));
  }

  query += ` GROUP BY DATE(b.created_at) ORDER BY date DESC`;

  const database = ensureDb();
  const stmt = database.prepare(query);
  const sales = stmt.all(...params);

  // Get expenses grouped by date
  const expenseStmt = database.prepare(`
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
  expenses.forEach((exp) => {
    expenseMap[exp.date] = exp.total_expenses;
  });

  // Combine sales and expenses
  const records = sales.map((sale) => ({
    date: sale.date,
    cash_sales: sale.cash_sales,
    credit_sales: sale.credit_sales,
    total_sales: sale.total_sales,
    bill_count: sale.bill_count,
    total_expenses: expenseMap[sale.date] || 0,
    profit: sale.total_sales - (expenseMap[sale.date] || 0),
  }));

  // Add dates that have only expenses (no sales)
  expenses.forEach((exp) => {
    if (!records.find((r) => r.date === exp.date)) {
      records.push({
        date: exp.date,
        cash_sales: 0,
        credit_sales: 0,
        total_sales: 0,
        bill_count: 0,
        total_expenses: exp.total_expenses,
        profit: -exp.total_expenses,
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
  const stmt = ensureDb().prepare(`
    SELECT 
      b.id,
      b.created_at,
      b.total_amount,
      TIME(b.created_at) as time,
      CASE 
        WHEN cc.is_deleted = 1 THEN cc.name || ' (Deleted)' 
        ELSE COALESCE(cc.name, '-') 
      END as customer_name,
      cb.customer_id as credit_customer_id,
      s.name as supplier_name,
      s.is_deleted as supplier_deleted,
      CASE WHEN cb.bill_id IS NOT NULL THEN 'CREDIT' ELSE 'CASH' END as bill_type
    FROM bills b
    LEFT JOIN credit_bills cb ON b.id = cb.bill_id
    LEFT JOIN credit_customers cc ON cb.customer_id = cc.id
    LEFT JOIN suppliers s ON b.supplier_id = s.id
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
  const stmt = ensureDb().prepare(`
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
function addCreditCustomer(name, phone = "") {
  try {
    const database = ensureDb();
    const tableCheck = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='credit_customers'",
      )
      .get();
    if (!tableCheck) {
      console.error("CRITICAL ERROR: credit_customers table does NOT exist!");
      throw new Error(
        'Database table "credit_customers" is missing. Please restart the app.',
      );
    }

    const stmt = database.prepare(`
      INSERT INTO credit_customers (name, phone)
      VALUES (?, ?)
    `);
    const result = stmt.run(name, phone);
    return result.lastInsertRowid;
  } catch (error) {
    logger.log(`Error in addCreditCustomer: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Add a payment from a credit customer
 */
function addCreditPayment(customerId, amount, date = null) {
  // Validate monetary input before transaction
  amount = validateAndRound(amount, 'amount');
  return ensureDb().transaction(() => {
    // FIX H3: Guard against payments to deleted customers
    const customer = ensureDb().prepare('SELECT is_deleted FROM credit_customers WHERE id = ?').get(customerId);
    if (!customer) throw new Error('Customer not found');
    if (customer.is_deleted === 1) throw new Error('Cannot add payment to a deleted customer');
    const now = new Date();
    const paymentDate =
      date ||
      now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0");
    const stmt = ensureDb().prepare(`
      INSERT INTO credit_payments (customer_id, date, amount)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(customerId, paymentDate, amount);
    return result.lastInsertRowid;
  })();
}

/**
 * Correct a credit payment (amount and/or date)
 */
function updateCreditPayment(paymentId, amount, date) {
  amount = validateAndRound(amount, 'amount');
  if (amount <= 0) throw new Error('Payment amount must be greater than 0');
  const result = ensureDb()
    .prepare('UPDATE credit_payments SET amount = ?, date = ? WHERE id = ?')
    .run(amount, date, paymentId);
  if (result.changes === 0) throw new Error('Payment not found');
  return result.changes;
}

/**
 * Delete a credit payment (customer's balance goes back up by that amount)
 */
function deleteCreditPayment(paymentId) {
  const result = ensureDb()
    .prepare('DELETE FROM credit_payments WHERE id = ?')
    .run(paymentId);
  if (result.changes === 0) throw new Error('Payment not found');
  return result.changes;
}

/**
 * Current balance (owed by the customer) = credit bills - payments
 */
function getCreditBalance(customerId) {
  const database = ensureDb();
  const billed = database.prepare(`
    SELECT COALESCE(SUM(b.total_amount), 0) as total
    FROM bills b JOIN credit_bills cb ON b.id = cb.bill_id
    WHERE cb.customer_id = ?
  `).get(customerId).total;
  const settled = database.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM credit_payments WHERE customer_id = ?
  `).get(customerId).total;
  return Math.round((billed - settled) * 100) / 100;
}

/**
 * Get all credit customers with totals and balances
 */
function getAllCreditCustomers(includeDeleted = false) {
  const stmt = ensureDb().prepare(`
    SELECT 
      cc.id,
      cc.name,
      cc.phone,
      cc.is_deleted,
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
    WHERE cc.is_deleted = 0 OR ? = 1
    ORDER BY cc.is_deleted ASC, cc.name ASC
  `);

  const customers = stmt.all(includeDeleted ? 1 : 0);
  return customers.map((c) => ({
    ...c,
    balance: c.total_credit - c.total_paid,
  }));
}

/**
 * Delete a credit customer and their linked records (payments and bill-links)
 * NOTE: The main 'bills' records are preserved for accounting.
 */
function deleteCreditCustomer(customerId) {
  try {
    const targetId = parseInt(customerId, 10);
    logger.log(`[DB] Soft-deleting credit customer ID: ${targetId}`, 'INFO');

    const deleteTx = ensureDb().transaction((id) => {
      // SAFETY: We NO LONGER delete child records (payments and bill links).
      // Keeping them preserves financial history and audit trails.

      // A customer who has not fully paid can't be deleted: the money owed would vanish from the Credits list
      const balance = getCreditBalance(id);
      if (balance > 0) {
        throw new Error(`Customer still owes ₹${balance}. Record their payments before deleting.`);
      }
      
      // Update the customer record to mark as deleted (soft delete)
      const custInfo = ensureDb()
        .prepare("UPDATE credit_customers SET is_deleted = 1 WHERE id = ?")
        .run(id);
      if (custInfo.changes === 0) {
        throw new Error("Customer record not found");
      }

      return true;
    });

    return deleteTx(targetId);
  } catch (error) {
    logger.log(`Error in deleteCreditCustomer: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Undo a customer delete: they show in the Credits list again with their full history
 */
function restoreCreditCustomer(customerId) {
  const result = ensureDb()
    .prepare("UPDATE credit_customers SET is_deleted = 0 WHERE id = ?")
    .run(customerId);
  if (result.changes === 0) throw new Error("Customer record not found");
  return result.changes;
}

/**
 * Get detailed info for a specific credit customer
 */
function getCreditCustomerDetails(customerId) {
  const targetId = parseInt(customerId, 10);

  // Get customer info and balance
  const customerStmt = ensureDb().prepare(`
     SELECT 
      cc.id,
      cc.name,
      cc.phone,
      cc.is_deleted,
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
    return null;
  }

  // Use the ID from the database record for subsequent queries
  const databaseId = customer.id;
  customer.balance = (customer.total_credit || 0) - (customer.total_paid || 0);

  // Get bills linked to this customer
  const billsStmt = ensureDb().prepare(`
    SELECT 
      b.id,
      b.created_at,
      b.total_amount,
      b.supplier_id,
      b.created_at as raw_date
    FROM bills b
    JOIN credit_bills cb ON b.id = cb.bill_id
    WHERE cb.customer_id = ?
    ORDER BY b.created_at DESC
  `);

  const rawBills = billsStmt.all(databaseId);
  customer.bills = rawBills.map((b) => ({
    ...b,
    // Provide safe defaults for date/time if SQL functions act up
    date: b.raw_date ? b.raw_date.split("T")[0] : "",
    time: b.raw_date ? b.raw_date.split("T")[1]?.split(".")[0] : "",
  }));

  // Get payments made by this customer
  const paymentsStmt = ensureDb().prepare(`
    SELECT id, date, amount
    FROM credit_payments
    WHERE customer_id = ?
    ORDER BY date DESC, id DESC
  `);
  customer.payments = paymentsStmt.all(databaseId);

  return customer;
}

/**
 * Get bills for a specific credit customer within a date range
 * Grouped by date as per user request for summary bill
 */
function getBillsByDateRange(customerId, startDate, endDate) {
  const database = ensureDb();
  const stmt = database.prepare(`
    SELECT 
      DATE(b.created_at) as bill_date,
      SUM(b.total_amount) as daily_total
    FROM bills b
    JOIN credit_bills cb ON b.id = cb.bill_id
    WHERE cb.customer_id = ? 
    AND DATE(b.created_at) >= ? 
    AND DATE(b.created_at) <= ?
    GROUP BY DATE(b.created_at)
    ORDER BY DATE(b.created_at) ASC
  `);
  return stmt.all(customerId, startDate, endDate);
}

/**
 * Full credit statement for a customer over a date range (YYYY-MM-DD, inclusive)
 * Used by: PDF / Excel export on the Summary Preview page
 * Opening balance = all credit bills minus all payments BEFORE startDate.
 */
function getCreditStatement(customerId, startDate, endDate) {
  const database = ensureDb();

  const customer = database
    .prepare("SELECT id, name, phone FROM credit_customers WHERE id = ?")
    .get(customerId);
  if (!customer) throw new Error("Customer not found");

  const billedBefore = database.prepare(`
    SELECT COALESCE(SUM(b.total_amount), 0) as total
    FROM bills b
    JOIN credit_bills cb ON b.id = cb.bill_id
    WHERE cb.customer_id = ? AND DATE(b.created_at) < ?
  `).get(customerId, startDate).total;

  const paidBefore = database.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM credit_payments
    WHERE customer_id = ? AND date < ?
  `).get(customerId, startDate).total;

  const bills = database.prepare(`
    SELECT b.id, b.created_at, DATE(b.created_at) as bill_date, b.total_amount
    FROM bills b
    JOIN credit_bills cb ON b.id = cb.bill_id
    WHERE cb.customer_id = ?
      AND DATE(b.created_at) >= ? AND DATE(b.created_at) <= ?
    ORDER BY b.created_at ASC, b.id ASC
  `).all(customerId, startDate, endDate);

  const itemsStmt = database.prepare(`
    SELECT i.name_english, i.name_tamil, bi.quantity, bi.rate
    FROM bill_items bi
    JOIN items i ON bi.item_id = i.id
    WHERE bi.bill_id = ?
  `);
  for (const bill of bills) {
    bill.items = itemsStmt.all(bill.id);
  }

  const payments = database.prepare(`
    SELECT id, date, amount
    FROM credit_payments
    WHERE customer_id = ? AND date >= ? AND date <= ?
    ORDER BY date ASC, id ASC
  `).all(customerId, startDate, endDate);

  const totalBilled = bills.reduce((sum, b) => sum + b.total_amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const openingBalance = billedBefore - paidBefore;

  return {
    customer,
    startDate,
    endDate,
    openingBalance,
    bills,
    payments,
    dailyTotals: getBillsByDateRange(customerId, startDate, endDate),
    totalBilled,
    totalPaid,
    closingBalance: openingBalance + totalBilled - totalPaid,
  };
}

// ========================================
// CATEGORY MANAGEMENT FUNCTIONS
// ========================================

/**
 * Get all categories
 * Used by: Admin Page and Billing Page
 */
function getAllCategories() {
  const stmt = ensureDb().prepare("SELECT * FROM categories ORDER BY name ASC");
  return stmt.all();
}

/**
 * Add a new category
 * Used by: Admin Page
 */
function addCategory(name) {
  return ensureDb().transaction(() => {
    const stmt = ensureDb().prepare("INSERT INTO categories (name) VALUES (?)");
    const result = stmt.run(name);
    return result.lastInsertRowid;
  })();
}

/**
 * Update a category name
 * Used by: Admin Page
 */
function updateCategory(id, name) {
  return ensureDb().transaction((id, newName) => {
    const database = ensureDb();
    const oldCategory = database
      .prepare("SELECT name FROM categories WHERE id = ?")
      .get(id);

    if (!oldCategory) {
      throw new Error(`Category with id=${id} not found`);
    }

    database.prepare(`
      UPDATE items 
      SET category = ? 
      WHERE category = ?
    `).run(newName, oldCategory.name);

    const result = database
      .prepare("UPDATE categories SET name = ? WHERE id = ?")
      .run(newName, id);

    return result.changes;
  })(id, name);
}

/**
 * Delete a category
 * Used by: Admin Page
 * Note: Items with this category will be set to 'Other'
 */
function deleteCategory(id) {
  const transaction = (id) => {
    const database = ensureDb();
    // First, update all items with this category to 'Other'
    const updateStmt = database.prepare(`
      UPDATE items 
      SET category = 'Other' 
      WHERE category = (SELECT name FROM categories WHERE id = ?)
      `);
    updateStmt.run(id);

    // Then delete the category
    const deleteStmt = database.prepare("DELETE FROM categories WHERE id = ?");
    deleteStmt.run(id);
  };

  ensureDb().transaction(transaction)(id);
}

// ========================================
// SUPPLIER MANAGEMENT FUNCTIONS
// ========================================

/**
 * Get all active suppliers
 */
function getAllSuppliers() {
  const stmt = ensureDb().prepare(
    "SELECT * FROM suppliers WHERE is_active = 1 AND is_deleted = 0 ORDER BY name ASC",
  );
  return stmt.all();
}

/**
 * Get all suppliers (including inactive)
 */
function getAllSuppliersAdmin() {
  const stmt = ensureDb().prepare(
    "SELECT * FROM suppliers WHERE is_deleted = 0 ORDER BY name ASC",
  );
  return stmt.all();
}

/**
 * Add a new staff/supplier
 */
function addSupplier(name, dailyWage = 0) {
  return ensureDb().transaction(() => {
    const database = ensureDb();
    // FIX M3: Check for existing deleted supplier and reactivate
    const existing = database.prepare("SELECT id, is_deleted FROM suppliers WHERE name = ?").get(name);
    if (existing) {
      if (existing.is_deleted === 0) {
        throw new Error("A supplier/staff with this name already exists");
      } else {
        // Re-activate deleted supplier
        database.prepare("UPDATE suppliers SET is_deleted = 0, is_active = 1, daily_wage = ? WHERE id = ?").run(dailyWage, existing.id);
        return existing.id;
      }
    }
    const stmt = database.prepare("INSERT INTO suppliers (name, daily_wage) VALUES (?, ?)");
    const result = stmt.run(name, dailyWage);
    return result.lastInsertRowid;
  })();
}

/**
 * Update staff/supplier
 */
function updateSupplier(id, name, dailyWage, isActive) {
  return ensureDb().transaction(() => {
    const stmt = ensureDb().prepare(
      "UPDATE suppliers SET name = ?, daily_wage = ?, is_active = ? WHERE id = ?",
    );
    stmt.run(name, dailyWage, isActive ? 1 : 0, id);
  })();
}

/**
 * Delete a supplier
 * We use soft delete (is_deleted = 1) to preserve historical data
 */
function deleteSupplier(id) {
  return ensureDb().transaction(() => {
    const stmt = ensureDb().prepare(
      "UPDATE suppliers SET is_deleted = 1 WHERE id = ?",
    );
    const result = stmt.run(id);
    return result.changes > 0;
  })();
}

/**
 * Get supplier-wise sales for a date range
 */
function getSupplierWiseSales(startDate, endDate, supplierId = null) {
  let query = `
    SELECT
      s.id as supplier_id,
      s.name as supplier_name,
      s.is_deleted,
      COUNT(b.id) as bill_count,
      SUM(b.total_amount) as total_sales
    FROM bills b
    -- LEFT JOIN: bills with no staff are kept as one "Unassigned" row, so the rows add up to total sales
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    WHERE DATE(b.created_at) >= ? AND DATE(b.created_at) <= ?
      `;

  const params = [startDate, endDate];

  if (supplierId) {
    query += ` AND s.id = ? `;
    params.push(parseInt(supplierId, 10));
  }

  query += ` GROUP BY s.id ORDER BY total_sales DESC`;

  const stmt = ensureDb().prepare(query);
  return stmt.all(...params);
}

// ========================================
// EMPLOYEE MAINTENANCE FUNCTIONS (Standalone Staff)
// ========================================

/**
 * Get employee list with balances
 */
function getEmployeeList(showInactive = false) {
  const showInactiveBool = Boolean(showInactive);
  let whereClause = "WHERE e.is_deleted = 0";
  if (!showInactiveBool) {
    whereClause += " AND e.is_active = 1";
  }

  const stmt = ensureDb().prepare(`
    SELECT 
      e.*,
      COALESCE(SUM(CASE WHEN et.type = 'WAGE' THEN et.amount ELSE -et.amount END), 0) as balance
    FROM employees e
    LEFT JOIN employee_transactions et ON e.id = et.employee_id
    ${whereClause}
    GROUP BY e.id
    ORDER BY e.name
  `);
  return stmt.all();
}

/**
 * Get detailed history for an employee
 */
function getEmployeeDetails(employeeId) {
  const db = ensureDb();
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
  if (!employee) throw new Error("Employee not found");

  const transactions = db.prepare(`
    SELECT * FROM employee_transactions
    WHERE employee_id = ?
    ORDER BY transaction_date DESC, id DESC
  `).all(employeeId);

  // Absent / holiday days (no auto wage) so the history can show them
  const skips = db.prepare(`
    SELECT skip_date, reason FROM employee_wage_skips
    WHERE employee_id = ? AND reason IN ('ABSENT', 'HOLIDAY')
    ORDER BY skip_date DESC
  `).all(employeeId);

  const balanceResult = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type = 'WAGE' THEN amount ELSE -amount END), 0) as balance
    FROM employee_transactions 
    WHERE employee_id = ?
  `).get(employeeId);

  return {
    ...employee,
    balance: balanceResult.balance,
    transactions,
    skips
  };
}

/**
 * Add a new employee or re-activate if deleted
 * autoWage: credit dailyWage automatically every day from wageStartDate (YYYY-MM-DD)
 */
function addEmployee(name, dailyWage = 0) {
  const database = ensureDb();
  
  // Check if employee already exists (including deleted ones)
  const existing = database.prepare("SELECT id, is_deleted FROM employees WHERE name = ?").get(name);
  
  if (existing) {
    if (existing.is_deleted === 0) {
      throw new Error("An employee with this name already exists");
    } else {
      // Re-activate deleted employee
      database.prepare("UPDATE employees SET is_deleted = 0, is_active = 1, daily_wage = ? WHERE id = ?").run(dailyWage, existing.id);
      return existing.id;
    }
  }

  const stmt = database.prepare(`
    INSERT INTO employees (name, daily_wage, is_active, is_deleted)
    VALUES (?, ?, 1, 0)
  `);
  const result = stmt.run(name, dailyWage);
  return result.lastInsertRowid;
}

/**
 * Update employee info
 * A new daily wage applies from today: today's untouched auto wage is moved to the new rate.
 */
function updateEmployee(id, name, dailyWage, isActive) {
  const stmt = ensureDb().prepare(`
    UPDATE employees 
    SET name = ?, daily_wage = ?, is_active = ?
    WHERE id = ?
  `);
  const result = stmt.run(name, dailyWage, isActive ? 1 : 0, id);
  return result.changes;
}

/**
 * Called on app start and when the date changes while the app is open.
 * Credits today's wages and returns the days in between that were never processed
 * (app not opened) so the user can decide whether to add wages for them.
 */
function runDailyWages() {
  const today = getLocalDateString();
  const credited = creditDailyWages(today);

  let processedThrough = getSetting(WAGE_PROCESSED_THROUGH_KEY);
  if (!processedThrough) {
    // First run after this feature ships: never back-fill history
    processedThrough = getLocalDateString(-1);
    setSetting(WAGE_PROCESSED_THROUGH_KEY, processedThrough);
  }

  const pendingDays = getPendingWageDays(processedThrough, today);
  if (pendingDays.length === 0) {
    setSetting(WAGE_PROCESSED_THROUGH_KEY, today);
  }
  return { credited, pendingDays };
}

/**
 * Dates strictly between processedThrough and today (YYYY-MM-DD), with what auto wages would cost.
 * Only returned if at least one employee has auto wages on.
 */
function getPendingWageDays(processedThrough, today) {
  const database = ensureDb();
  const autoCount = database.prepare(`
    SELECT COUNT(*) as c FROM employees
    WHERE is_deleted = 0 AND is_active = 1 AND auto_wage = 1 AND daily_wage > 0
  `).get().c;
  if (autoCount === 0) return [];

  const days = [];
  const cursor = new Date(processedThrough + 'T00:00:00');
  cursor.setDate(cursor.getDate() + 1);
  // Cap at 90 days so a very long gap can't build a huge list
  while (days.length < 90) {
    const date = cursor.getFullYear() + '-' +
      String(cursor.getMonth() + 1).padStart(2, '0') + '-' +
      String(cursor.getDate()).padStart(2, '0');
    if (date >= today) break;
    days.push(date);
    cursor.setDate(cursor.getDate() + 1);
  }

  const preview = database.prepare(`
    SELECT COUNT(*) as employees, COALESCE(SUM(e.daily_wage), 0) as total
    FROM employees e
    WHERE e.is_deleted = 0 AND e.is_active = 1 AND e.auto_wage = 1 AND e.daily_wage > 0
      AND (e.wage_start_date IS NULL OR e.wage_start_date <= ?)
      AND NOT EXISTS (SELECT 1 FROM employee_wage_skips s WHERE s.employee_id = e.id AND s.skip_date = ?)
      AND NOT EXISTS (
        SELECT 1 FROM employee_transactions t
        WHERE t.employee_id = e.id AND t.transaction_date = ? AND t.is_auto = 1
      )
  `);
  return days
    .map((date) => ({ date, ...preview.get(date, date, date) }))
    .filter((d) => d.employees > 0);
}

/**
 * User's answer to the "app wasn't opened on these days" prompt.
 * Credits wages for the chosen dates; all other missed days get no wage.
 */
function resolvePendingWageDays(datesToCredit = []) {
  return ensureDb().transaction(() => {
    let credited = 0;
    for (const date of datesToCredit) {
      credited += creditDailyWages(date);
    }
    setSetting(WAGE_PROCESSED_THROUGH_KEY, getLocalDateString());
    return credited;
  })();
}

/**
 * Mark an employee absent for a day: removes that day's auto wage and stops it being re-added
 */
function markEmployeeAbsent(employeeId, date) {
  return ensureDb().transaction(() => {
    const database = ensureDb();
    database.prepare(`
      DELETE FROM employee_transactions
      WHERE employee_id = ? AND transaction_date = ? AND is_auto = 1
    `).run(employeeId, date);
    database.prepare(`
      INSERT OR REPLACE INTO employee_wage_skips (employee_id, skip_date, reason)
      VALUES (?, ?, 'ABSENT')
    `).run(employeeId, date);
  })();
}

/**
 * Shop holiday: no auto wage for anyone with auto wages on that day
 */
function markShopHoliday(date) {
  return ensureDb().transaction(() => {
    const database = ensureDb();
    database.prepare('INSERT OR IGNORE INTO shop_holidays (holiday_date) VALUES (?)').run(date);
    const employees = database.prepare(`
      SELECT id FROM employees WHERE is_deleted = 0 AND auto_wage = 1
    `).all();
    for (const { id } of employees) {
      database.prepare(`
        DELETE FROM employee_transactions
        WHERE employee_id = ? AND transaction_date = ? AND is_auto = 1
      `).run(id, date);
      database.prepare(`
        INSERT OR REPLACE INTO employee_wage_skips (employee_id, skip_date, reason)
        VALUES (?, ?, 'HOLIDAY')
      `).run(id, date);
    }
    return employees.length;
  })();
}

/**
 * Give an employee the shop holidays from today onwards (no auto wage on those days).
 * Used when someone is added, re-activated or switched to auto wage after a holiday was marked.
 */
function applyShopHolidays(employeeId) {
  ensureDb().prepare(`
    INSERT OR IGNORE INTO employee_wage_skips (employee_id, skip_date, reason)
    SELECT ?, holiday_date, 'HOLIDAY' FROM shop_holidays WHERE holiday_date >= ?
  `).run(employeeId, getLocalDateString());
}

/**
 * Undo Absent / Holiday for one employee on a day: the auto wage is credited again (not for future days)
 */
function removeWageSkip(employeeId, date) {
  return ensureDb().transaction(() => {
    ensureDb().prepare(`
      DELETE FROM employee_wage_skips WHERE employee_id = ? AND skip_date = ?
    `).run(employeeId, date);
    if (date <= getLocalDateString()) {
      creditDailyWages(date);
    }
  })();
}

/**
 * Soft delete an employee
 */
function deleteEmployee(id) {
  const stmt = ensureDb().prepare(`
    UPDATE employees 
    SET is_deleted = 1, is_active = 0
    WHERE id = ?
  `);
  const result = stmt.run(id);
  return result.changes;
}

/**
 * Add an employee transaction (WAGE or PAYMENT)
 */
function addEmployeeTransaction(employeeId, amount, type, description, date = null) {
  amount = validateAndRound(amount, 'amount');
  return ensureDb().transaction(() => {
    const database = ensureDb();
    const now = new Date();
    const transactionDate = date || (now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0'));

    let expenseId = null;

    if (type === 'PAYMENT') {
      const employee = database.prepare('SELECT name FROM employees WHERE id = ?').get(employeeId);
      const expenseDesc = `Staff Payment: ${employee ? employee.name : ''} ${description ? '(' + description + ')' : ''}`.trim();
      
      const expenseStmt = database.prepare(`
        INSERT INTO expenses (expense_date, description, amount)
        VALUES (?, ?, ?)
      `);
      const expenseResult = expenseStmt.run(transactionDate, expenseDesc, amount);
      expenseId = expenseResult.lastInsertRowid;
    }

    const stmt = database.prepare(`
      INSERT INTO employee_transactions (employee_id, amount, transaction_date, type, description, expense_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(employeeId, amount, transactionDate, type, description, expenseId);
    return result.lastInsertRowid;
  })();
}

/**
 * Update an employee transaction
 */
function updateEmployeeTransaction(id, amount, description, date) {
  amount = validateAndRound(amount, 'amount');
  return ensureDb().transaction(() => {
    const database = ensureDb();
    const original = database.prepare('SELECT * FROM employee_transactions WHERE id = ?').get(id);
    if (!original) throw new Error("Transaction not found");

    if (original.expense_id) {
      const employee = database.prepare('SELECT name FROM employees WHERE id = ?').get(original.employee_id);
      const expenseDesc = `Staff Payment: ${employee ? employee.name : ''} ${description ? '(' + description + ')' : ''}`.trim();
      
      database.prepare(`
        UPDATE expenses 
        SET expense_date = ?, description = ?, amount = ?
        WHERE id = ?
      `).run(date, expenseDesc, amount, original.expense_id);
    }

    const stmt = database.prepare(`
      UPDATE employee_transactions
      SET amount = ?, description = ?, transaction_date = ?
      WHERE id = ?
    `);
    const result = stmt.run(amount, description, date, id);
    return result.changes;
  })();
}

/**
 * Delete an employee transaction
 */
function deleteEmployeeTransaction(transactionId) {
  return ensureDb().transaction(() => {
    const database = ensureDb();
    const transaction = database.prepare('SELECT id, expense_id, employee_id, transaction_date, is_auto FROM employee_transactions WHERE id = ?').get(transactionId);
    if (!transaction) return 0;

    if (transaction.expense_id) {
      database.prepare('UPDATE employee_transactions SET expense_id = NULL WHERE id = ?').run(transactionId);
      database.prepare('DELETE FROM expenses WHERE id = ?').run(transaction.expense_id);
    }

    // A deleted auto wage must stay deleted (otherwise it is re-credited on the next app start)
    if (transaction.is_auto) {
      database.prepare(`
        INSERT OR IGNORE INTO employee_wage_skips (employee_id, skip_date, reason)
        VALUES (?, ?, 'REMOVED')
      `).run(transaction.employee_id, transaction.transaction_date);
    }

    const result = database.prepare('DELETE FROM employee_transactions WHERE id = ?').run(transactionId);
    return result.changes;
  })();
}

// ========================================
// STAFF MAINTENANCE FUNCTIONS (LEGACY/WAITERS)
// ========================================

/**
 * Get staff with balances
 */
function getStaffList(showInactive = false) {
  const showInactiveBool = Boolean(showInactive);
  let whereClause = "WHERE s.is_deleted = 0";
  if (!showInactiveBool) {
    whereClause += " AND s.is_active = 1";
  }

  const stmt = ensureDb().prepare(`
    SELECT 
      s.*,
      COALESCE(SUM(CASE WHEN st.type = 'WAGE' THEN st.amount ELSE -st.amount END), 0) as balance
    FROM suppliers s
    LEFT JOIN staff_transactions st ON s.id = st.staff_id
    ${whereClause}
    GROUP BY s.id
    ORDER BY s.name
  `);
  return stmt.all();
}

/**
 * Get detailed history for a staff member
 */
function getStaffDetails(staffId) {
  const db = ensureDb();
  const staff = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(staffId);
  if (!staff) throw new Error("Staff not found");

  const transactions = db.prepare(`
    SELECT * FROM staff_transactions 
    WHERE staff_id = ? 
    ORDER BY transaction_date DESC, id DESC
  `).all(staffId);

  const balanceResult = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type = 'WAGE' THEN amount ELSE -amount END), 0) as balance
    FROM staff_transactions 
    WHERE staff_id = ?
  `).get(staffId);

  return {
    ...staff,
    balance: balanceResult.balance,
    transactions
  };
}

/**
 * Add a staff transaction (WAGE or PAYMENT)
 */
function addStaffTransaction(staffId, amount, type, description, date = null) {
  // Validate monetary input before transaction
  amount = validateAndRound(amount, 'amount');
  return ensureDb().transaction(() => {
    const database = ensureDb();
    const now = new Date();
    const transactionDate = date || (now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0'));

    let expenseId = null;

    // If it's a payment, we also add it to the daily expenses table
    if (type === 'PAYMENT') {
      const staff = database.prepare('SELECT name FROM suppliers WHERE id = ?').get(staffId);
      const expenseDesc = `Staff Salary: ${staff ? staff.name : ''} ${description ? '(' + description + ')' : ''}`.trim();
      
      const expenseStmt = database.prepare(`
        INSERT INTO expenses (expense_date, description, amount)
        VALUES (?, ?, ?)
      `);
      const expenseResult = expenseStmt.run(transactionDate, expenseDesc, amount);
      expenseId = expenseResult.lastInsertRowid;
    }

    const stmt = database.prepare(`
      INSERT INTO staff_transactions (staff_id, amount, transaction_date, type, description, expense_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(staffId, amount, transactionDate, type, description, expenseId);
    return result.lastInsertRowid;
  })();
}

/**
 * Sync daily wages for all active staff
 * This should be called once per day (or checks if already done)
 */

/**
 * Update a staff transaction
 */
function updateStaffTransaction(id, amount, description, date) {
  // FIX H1: Validate monetary input on update path
  amount = validateAndRound(amount, 'amount');
  return ensureDb().transaction(() => {
    const database = ensureDb();
    const original = database.prepare('SELECT * FROM staff_transactions WHERE id = ?').get(id);
    if (!original) throw new Error("Transaction not found");

    if (original.expense_id) {
      const staff = database.prepare('SELECT name FROM suppliers WHERE id = ?').get(original.staff_id);
      const expenseDesc = `Staff Salary: ${staff ? staff.name : ''} ${description ? '(' + description + ')' : ''}`.trim();
      
      database.prepare(`
        UPDATE expenses 
        SET expense_date = ?, description = ?, amount = ?
        WHERE id = ?
      `).run(date, expenseDesc, amount, original.expense_id);
    }

    const stmt = database.prepare(`
      UPDATE staff_transactions
      SET amount = ?, description = ?, transaction_date = ?
      WHERE id = ?
    `);
    const result = stmt.run(amount, description, date, id);
    return result.changes;
  })();
}

/**
 * Delete a staff transaction
 */
function deleteStaffTransaction(transactionId) {
  try {
    return ensureDb().transaction(() => {
      const database = ensureDb();
      const transaction = database.prepare('SELECT id, expense_id FROM staff_transactions WHERE id = ?').get(transactionId);
      if (!transaction) return 0;

      if (transaction.expense_id) {
        database.prepare('UPDATE staff_transactions SET expense_id = NULL WHERE id = ?').run(transactionId);
        database.prepare('DELETE FROM expenses WHERE id = ?').run(transaction.expense_id);
      }

      const result = database.prepare('DELETE FROM staff_transactions WHERE id = ?').run(transactionId);
      return result.changes;
    })();
  } catch (error) {
    logger.log(`❌ Error deleting staff transaction: ${error.message}`, "ERROR");
    throw error;
  }
}

/**
 * Backup the database to a specific file path
 * Uses better-sqlite3's built-in backup method for safety and consistency
 */
async function backupDatabase(destinationPath) {
  try {
    console.log("📡 Starting database backup to:", destinationPath);
    // In better-sqlite3, .backup() returns a promise
    await ensureDb().backup(destinationPath);
    console.log("✅ Backup completed successfully");
    return true;
  } catch (error) {
    console.error("❌ Backup failed:", error);
    throw error;
  }
}

// ========== VENDOR CREDIT FUNCTIONS ==========

/**
 * Get all vendors with their current balance
 */
function getAllVendors() {
  const stmt = ensureDb().prepare(`
    SELECT 
      v.*,
      COALESCE(SUM(CASE WHEN vt.type = 'CREDIT' THEN vt.amount ELSE -vt.amount END), 0) as balance
    FROM vendors v
    LEFT JOIN vendor_transactions vt ON v.id = vt.vendor_id
    WHERE v.is_deleted = 0
    GROUP BY v.id
    ORDER BY v.name
  `);
  return stmt.all();
}

/**
 * Add a new vendor or re-activate if exists
 */
function addVendor(name, phone) {
  try {
    const database = ensureDb();
    
    // Check if vendor already exists (including deleted ones)
    const existing = database.prepare("SELECT id, is_deleted FROM vendors WHERE name = ?").get(name);
    
    if (existing) {
      if (existing.is_deleted === 0) {
        throw new Error("A vendor with this name already exists");
      } else {
        // Re-activate deleted vendor
        database.prepare("UPDATE vendors SET is_deleted = 0, is_active = 1, phone = ? WHERE id = ?").run(phone, existing.id);
        return existing.id;
      }
    }

    const stmt = database.prepare(`
      INSERT INTO vendors (name, phone)
      VALUES (?, ?)
    `);
    const result = stmt.run(name, phone);
    return result.lastInsertRowid;
  } catch (error) {
    logger.log(`❌ Error in addVendor: ${error.message}`, "ERROR");
    throw error;
  }
}

/**
 * Add a vendor transaction (CREDIT or PAYMENT)
 */
function addVendorTransaction(vendorId, amount, type, description, date = null) {
  // Validate monetary input before transaction
  amount = validateAndRound(amount, 'amount');
  return ensureDb().transaction(() => {
    const database = ensureDb();
    const now = new Date();
    const transactionDate = date || (now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0'));

    let expenseId = null;

    // If it's a payment, we also add it to the expenses table
    if (type === 'PAYMENT') {
      const vendor = database.prepare('SELECT name FROM vendors WHERE id = ?').get(vendorId);
      const expenseDesc = `Vendor Payment: ${vendor ? vendor.name : ''} ${description ? '(' + description + ')' : ''}`.trim();
      
      const expenseStmt = database.prepare(`
        INSERT INTO expenses (expense_date, description, amount)
        VALUES (?, ?, ?)
      `);
      const expenseResult = expenseStmt.run(transactionDate, expenseDesc, amount);
      expenseId = expenseResult.lastInsertRowid;
    }

    const stmt = database.prepare(`
      INSERT INTO vendor_transactions (vendor_id, amount, transaction_date, type, description, expense_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(vendorId, amount, transactionDate, type, description, expenseId);
    return result.lastInsertRowid;
  })();
}

/**
 * Get details and transaction history for a vendor
 */
function getVendorDetails(vendorId) {
  const database = ensureDb();
  const vendor = database.prepare('SELECT * FROM vendors WHERE id = ?').get(vendorId);

  if (!vendor) return null;

  const transactions = database.prepare(`
    SELECT * FROM vendor_transactions
    WHERE vendor_id = ?
    ORDER BY transaction_date DESC, id DESC
  `).all(vendorId);

  // FIX: Use SQL aggregate instead of JS reduce to eliminate float accumulation drift
  const balanceResult = database.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END
    ), 0) as balance
    FROM vendor_transactions
    WHERE vendor_id = ?
  `).get(vendorId);

  return {
    ...vendor,
    balance: balanceResult.balance,
    transactions
  };
}

/**
 * Delete a vendor (soft delete)
 */
function deleteVendor(id) {
  // SAFETY: Standardize on is_deleted = 1 for soft-delete.
  // This preserves all linked vendor_transactions and expenses for history.
  const stmt = ensureDb().prepare('UPDATE vendors SET is_deleted = 1, is_active = 0 WHERE id = ?');
  const result = stmt.run(id);
  return result.changes;
}

/**
 * Update a vendor transaction
 */
function updateVendorTransaction(id, amount, description, date) {
  // FIX H1: Validate monetary input on update path
  amount = validateAndRound(amount, 'amount');
  return ensureDb().transaction(() => {
    const database = ensureDb();
    
    // Get original transaction to handle expense update if it was a payment
    const original = database.prepare('SELECT * FROM vendor_transactions WHERE id = ?').get(id);
    if (!original) throw new Error("Transaction not found");

    if (original.expense_id) {
      // Update linked expense
      const vendor = database.prepare('SELECT name FROM vendors WHERE id = ?').get(original.vendor_id);
      const expenseDesc = `Vendor Payment: ${vendor ? vendor.name : ''} ${description ? '(' + description + ')' : ''}`.trim();
      
      database.prepare(`
        UPDATE expenses 
        SET expense_date = ?, description = ?, amount = ?
        WHERE id = ?
      `).run(date, expenseDesc, amount, original.expense_id);
    }

    const stmt = database.prepare(`
      UPDATE vendor_transactions
      SET amount = ?, description = ?, transaction_date = ?
      WHERE id = ?
    `);
    const result = stmt.run(amount, description, date, id);
    return result.changes;
  })();
}

/**
 * Delete a vendor transaction
 */
function deleteVendorTransaction(transactionId) {
  try {
    return ensureDb().transaction(() => {
      const database = ensureDb();
      
      // Get the transaction details
      const transaction = database.prepare('SELECT id, expense_id FROM vendor_transactions WHERE id = ?').get(transactionId);
      if (!transaction) {
        logger.log(`⚠️ Attempted to delete non-existent transaction ID: ${transactionId}`, "WARN");
        return 0;
      }

      const expenseId = transaction.expense_id;

      // 1. If it has an expense, we need to handle it carefully
      if (expenseId) {
        // First null it out in vendor_transactions to break the link
        database.prepare('UPDATE vendor_transactions SET expense_id = NULL WHERE id = ?').run(transactionId);
        // Then delete the expense
        database.prepare('DELETE FROM expenses WHERE id = ?').run(expenseId);
        logger.log(`🗑️ Deleted associated expense ID: ${expenseId}`, "INFO");
      }

      // 2. Now delete the vendor transaction itself
      const result = database.prepare('DELETE FROM vendor_transactions WHERE id = ?').run(transactionId);
      logger.log(`✅ Deleted vendor transaction ID: ${transactionId}`, "INFO");

      return result.changes;
    })();
  } catch (error) {
    logger.log(`❌ Error deleting vendor transaction: ${error.message}`, "ERROR");
    throw error;
  }
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
  // Settings functions
  getSetting,
  setSetting,
  saveBill,
  updateBill,
  deleteBill,
  getBillHistory,
  getBillItems,
  getNextBillId,
  // New expense functions
  addExpense,
  updateExpense,
  deleteExpense,
  getTodayExpenses,
  getTodayStats,
  getExpensesByDateRange,
  getDailyRecords,
  getBillsByDate,
  getExpensesByDate,
  // New credit functions
  addCreditCustomer,
  addCreditPayment,
  deleteCreditCustomer,
  getAllCreditCustomers,
  getCreditCustomerDetails,
  getBillsByDateRange,
  getCreditStatement,
  updateCreditPayment,
  deleteCreditPayment,
  getCreditBalance,
  restoreCreditCustomer,
  // Supplier functions
  getAllSuppliers,
  getAllSuppliersAdmin,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierWiseSales,
  // Category functions
  getAllCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  // Vendor functions
  getAllVendors,
  addVendor,
  addVendorTransaction,
  getVendorDetails,
  deleteVendor,
  updateVendorTransaction,
  deleteVendorTransaction,
  // Staff functions
  getStaffList,
  getStaffDetails,
  addStaffTransaction,
  updateStaffTransaction,
  deleteStaffTransaction,
  // Employee functions (Standalone)
  getEmployeeList,
  getEmployeeDetails,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  addEmployeeTransaction,
  updateEmployeeTransaction,
  deleteEmployeeTransaction,
  // Auto daily wage functions
  runDailyWages,
  resolvePendingWageDays,
  markEmployeeAbsent,
  markShopHoliday,
  removeWageSkip,
  // System functions
  backupDatabase,
  // Safety/Backup functions
  updateLatestBackup: async () =>
    await dbSafety.updateLatestBackup(ensureDb(), dbPath, backupDir),
  createDailySnapshot: async () =>
    await dbSafety.createDailySnapshot(ensureDb(), dbPath, backupDir),
  cleanupOldDailyBackups: () => dbSafety.cleanupOldDailyBackups(backupDir, 30),
  get db() {
    return db;
  }, // Getter for the database connection
};
