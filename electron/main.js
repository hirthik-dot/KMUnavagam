// main.js - Main Electron Process
// This is the entry point for the Electron application

const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const creditStatementExport = require('./creditStatementExport');

// Force dd/mm/yyyy date format by setting locale
app.commandLine.appendSwitch('lang', 'en-GB');
app.commandLine.appendSwitch('accept-languages', 'en-GB,en,en-IN');

const logger = require('./logger');
const dbSafety = require('./dbSafety');

// DETERMINISTIC DATABASE PATHS (Required for pre-load recovery)
const dbPath = process.env.NODE_ENV === 'development'
  ? path.join(__dirname, '..', 'database', 'hotel.db')
  : path.join(app.getPath('userData'), 'database', 'hotel.db');

const backupDir = process.env.NODE_ENV === 'development'
  ? path.join(__dirname, '..', 'backups')
  : path.join(app.getPath('userData'), 'backups');

// 🛡️ CRITICAL RECOVERY PHASE: Runs BEFORE database module is required
// This prevents EBUSY errors because SQLite hasn't opened the file yet.
try {
  dbSafety.restoreLatestBackupIfCorrupted(dbPath, backupDir);
} catch (err) {
  logger.log(`🔥 FATAL: Pre-startup recovery failed: ${err.message}`, 'ERROR');
}

// Now safe to import database module
const db = require('./database');

// GLOBAL CRASH LOGGING
process.on('uncaughtException', (error) => {
  logger.log('🔥 CRITICAL: Uncaught Exception', 'ERROR');
  logger.log(error.stack || error, 'ERROR');
});

process.on('unhandledRejection', (reason) => {
  logger.log('🔥 CRITICAL: Unhandled Rejection', 'ERROR');
  logger.log(reason instanceof Error ? reason.stack : reason, 'ERROR');
});

// Store reference to the main window
let mainWindow;

// Cached default printer name — resolved once at startup to avoid per-print getPrintersAsync() delays
let cachedPrinterName = '';

// Determine if we're in development or production mode
const isDev = process.env.NODE_ENV === 'development';

/**
 * Create the main application window
 * This is what the user sees
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      // Enable the preload script for security
      preload: path.join(__dirname, 'preload.js'),
      // Disable Node.js in the renderer for security
      nodeIntegration: false,
      // Enable context isolation for security
      contextIsolation: true,
    },
    // Window styling
    backgroundColor: '#ffffff',
    title: 'Zerivo',
    // Remove the menu bar (File, Edit, View, etc.)
    autoHideMenuBar: true,
  });

  // Load the React app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools for debugging
    // mainWindow.webContents.openDevTools();
    //  mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Initialize the app when Electron is ready
 */
app.whenReady().then(async () => {
  logger.log('🚀 Starting Hotel Billing Application...', 'INFO');

  // Aggressively force British/Indian English for dd/mm/yyyy date format
  console.log('🌍 Setting application locale to en-GB');
  if (typeof app.setLocale === 'function') {
    app.setLocale('en-GB');
  } else {
    console.log('⚠️ app.setLocale is not available, relying on command line switches');
  }

  // Initialize the database
  await db.initializeDatabase();

  // Auto daily wages: credit today now, and again whenever the date changes while the app stays open
  let lastWageRunDate = null;
  const runDailyWagesIfNewDay = () => {
    const today = new Date().toDateString();
    if (today === lastWageRunDate) return;
    try {
      const { credited } = db.runDailyWages();
      lastWageRunDate = today;
      if (credited > 0) logger.log(`💰 Auto daily wages credited for ${credited} employee(s)`, 'INFO');
    } catch (error) {
      logger.log(`❌ Auto daily wages failed: ${error.message}`, 'ERROR');
    }
  };
  runDailyWagesIfNewDay();
  setInterval(runDailyWagesIfNewDay, 60 * 1000);

  // Set up IPC handlers (communication between React and Electron)
  setupIPCHandlers();

  // Create the window
  createWindow();

  // Cache the default printer name once the main window is ready
  mainWindow.webContents.once('did-finish-load', async () => {
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      const defaultPrinter = printers.find(p => p.isDefault) || (printers.length > 0 ? printers[0] : null);
      cachedPrinterName = defaultPrinter ? defaultPrinter.name : '';
      console.log(`🖨️ Cached default printer: ${cachedPrinterName || 'System Default'}`);
    } catch (err) {
      console.warn('⚠️ Could not cache printer name:', err.message);
    }
  });

  // Register a custom protocol for local media files
  // This allows the renderer to access images from the user data folder securely
  protocol.handle('media', (request) => {
    try {
      const url = new URL(request.url);
      // Get the filename from the host (media://filename.jpg) or pathname (media:///filename.jpg)
      let fileName = url.host || path.basename(url.pathname);

      // DECODE URL components (handle spaces like %20)
      fileName = decodeURIComponent(fileName);

      // Clean up the filename
      fileName = fileName.replace(/^\/+|\/+$/g, '');

      const imagesDir = isDev
        ? path.join(__dirname, '..', 'public', 'food-images')
        : path.join(app.getPath('userData'), 'food-images');

      const filePath = path.join(imagesDir, fileName);

      console.log(`[MEDIA] Request: ${request.url} -> File: ${filePath}`);

      if (!fs.existsSync(filePath)) {
        console.warn(`[MEDIA] File not found: ${filePath}`);
        return new Response('Not Found', { status: 404 });
      }

      // Convert to file URL properly for Windows (forward slashes and encoded spaces)
      // Standard pathToFileURL(path).href handles all encoding automatically
      const fileUrl = pathToFileURL(filePath).href;

      return net.fetch(fileUrl);
    } catch (error) {
      console.error(`[MEDIA] Protocol error: ${error.message}`);
      return new Response('Error', { status: 500 });
    }
  });

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // FEATURE 2A: ROLLING RECENT BACKUP (3-hour interval)
  setInterval(async () => {
    try {
      logger.log('[BACKUP] Triggering scheduled backup...', 'INFO');
      await db.updateLatestBackup();
    } catch (error) {
      logger.log(`[BACKUP] Scheduled backup failed: ${error.message}`, 'ERROR');
    }
  }, 1 * 60 * 60 * 1000); // 1 hour
});

/**
 * Quit the app when all windows are closed (except on macOS)
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * FEATURE 2: GRACEFUL SHUTDOWN BACKUPS
 * Runs before the app closes.
 *
 * CRITICAL FIX: Electron does NOT await async before-quit callbacks.
 * We use e.preventDefault() + IIFE + app.exit(0) in finally block
 * to guarantee backups complete before the process terminates.
 */
let shuttingDown = false;
app.on('before-quit', (e) => {
  if (shuttingDown) return; // Guard against re-entrant calls

  e.preventDefault();
  shuttingDown = true;

  logger.log('🚪 Shutting down: Performing safety backups...', 'INFO');

  (async () => {
    try {
      await Promise.all([
        db.updateLatestBackup(),
        db.createDailySnapshot()
      ]);
      db.cleanupOldDailyBackups();
      logger.log('✅ Shutdown backups complete. Goodbye!', 'INFO');
    } catch (error) {
      logger.log(`❌ Shutdown backup failed: ${error.message}`, 'ERROR');
    } finally {
      app.exit(0); // Always exit, even if backup fails
    }
  })();
});

/**
 * Set up IPC handlers for communication between React and Electron
 * These handle requests from the React frontend
 */
let handlersRegistered = false;
function setupIPCHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;
  // ========== DATABASE OPERATIONS ==========

  // Get all active items
  ipcMain.handle('db:getAllItems', async () => {
    try {
      return db.getAllItems();
    } catch (error) {
      console.error('Error getting items:', error);
      throw error;
    }
  });

  // Get all items (including inactive)
  ipcMain.handle('db:getAllItemsAdmin', async () => {
    try {
      return db.getAllItemsAdmin();
    } catch (error) {
      console.error('Error getting admin items:', error);
      throw error;
    }
  });

  // Add new item
  ipcMain.handle('db:addItem', async (event, nameTamil, nameEnglish, price, imagePath, category, nameHindi) => {
    try {
      return db.addItem(nameTamil, nameEnglish, price, imagePath, category, nameHindi);
    } catch (error) {
      console.error('Error adding item:', error);
      throw error;
    }
  });

  // Update item
  ipcMain.handle('db:updateItem', async (event, id, nameTamil, nameEnglish, price, imagePath, category, nameHindi) => {
    try {
      db.updateItem(id, nameTamil, nameEnglish, price, imagePath, category, nameHindi);
      return { success: true };
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  });

  // Get an app setting (e.g. default bill print language)
  ipcMain.handle('db:getSetting', async (event, key, defaultValue) => {
    try {
      return db.getSetting(key, defaultValue);
    } catch (error) {
      console.error('Error getting setting:', error);
      throw error;
    }
  });

  // Save an app setting
  ipcMain.handle('db:setSetting', async (event, key, value) => {
    try {
      db.setSetting(key, value);
      return { success: true };
    } catch (error) {
      console.error('Error saving setting:', error);
      throw error;
    }
  });

  // Toggle item status
  ipcMain.handle('db:toggleItemStatus', async (event, id, isActive) => {
    try {
      db.toggleItemStatus(id, isActive);
      return { success: true };
    } catch (error) {
      console.error('Error toggling item status:', error);
      throw error;
    }
  });

  // Delete item
  ipcMain.handle('db:deleteItem', async (event, id) => {
    try {
      db.deleteItem(id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  });

  // Save bill
  ipcMain.handle('db:saveBill', async (event, items, totalAmount, customerId, supplierId, customDate) => {
    try {
      return db.saveBill(items, totalAmount, customerId, supplierId, customDate);
    } catch (error) {
      console.error('Error saving bill:', error);
      throw error;
    }
  });

  // Get next bill ID (for preview)
  ipcMain.handle('db:getNextBillId', async () => {
    try {
      return db.getNextBillId();
    } catch (error) {
      console.error('Error getting next bill ID:', error);
      return 1;
    }
  });

  // Update existing bill
  ipcMain.handle('db:updateBill', async (event, billId, items, totalAmount, supplierId, customDate) => {
    try {
      return db.updateBill(billId, items, totalAmount, supplierId, customDate);
    } catch (error) {
      console.error('Error updating bill:', error);
      throw error;
    }
  });

  // Delete bill
  ipcMain.handle('db:deleteBill', async (event, billId) => {
    try {
      return db.deleteBill(billId);
    } catch (error) {
      console.error('Error deleting bill:', error);
      throw error;
    }
  });

  // Get bill history
  ipcMain.handle('db:getBillHistory', async (event, limit = 50) => {
    try {
      return db.getBillHistory(limit);
    } catch (error) {
      console.error('Error getting bill history:', error);
      throw error;
    }
  });

  // Get bill items
  ipcMain.handle('db:getBillItems', async (event, billId) => {
    try {
      return db.getBillItems(billId);
    } catch (error) {
      console.error('Error getting bill items:', error);
      throw error;
    }
  });

  // ========== EXPENSES OPERATIONS ==========

  // Add expense
  ipcMain.handle('db:addExpense', async (event, description, amount, expenseDate) => {
    try {
      return db.addExpense(description, amount, expenseDate);
    } catch (error) {
      console.error('Error adding expense:', error);
      throw error;
    }
  });

  // Update expense
  ipcMain.handle('db:updateExpense', async (event, expenseId, description, amount, expenseDate) => {
    try {
      return db.updateExpense(expenseId, description, amount, expenseDate);
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  });

  // Delete expense
  ipcMain.handle('db:deleteExpense', async (event, expenseId) => {
    try {
      return db.deleteExpense(expenseId);
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  });

  // Get today's expenses
  ipcMain.handle('db:getTodayExpenses', async () => {
    try {
      return db.getTodayExpenses();
    } catch (error) {
      console.error('Error getting today expenses:', error);
      throw error;
    }
  });

  // Get today's stats (cash sales, credit sales, expenses)
  ipcMain.handle('db:getTodayStats', async () => {
    try {
      return db.getTodayStats();
    } catch (error) {
      console.error('Error getting today stats:', error);
      throw error;
    }
  });

  // Get expenses by date range
  ipcMain.handle('db:getExpensesByDateRange', async (event, startDate, endDate) => {
    try {
      return db.getExpensesByDateRange(startDate, endDate);
    } catch (error) {
      console.error('Error getting expenses:', error);
      throw error;
    }
  });

  // Get expenses by specific date
  ipcMain.handle('db:getExpensesByDate', async (event, date) => {
    try {
      return db.getExpensesByDate(date);
    } catch (error) {
      console.error('Error getting expenses by date:', error);
      throw error;
    }
  });

  // ========== RECORDS OPERATIONS ==========

  // Get daily records (sales, expenses, profit)
  ipcMain.handle('db:getDailyRecords', async (event, startDate, endDate, supplierId) => {
    try {
      return db.getDailyRecords(startDate, endDate, supplierId);
    } catch (error) {
      console.error('Error getting daily records:', error);
      throw error;
    }
  });

  // Get bills by specific date
  ipcMain.handle('db:getBillsByDate', async (event, date) => {
    try {
      return db.getBillsByDate(date);
    } catch (error) {
      console.error('Error getting bills by date:', error);
      throw error;
    }
  });

  // ========== CREDIT OPERATIONS ==========

  // Add credit customer
  ipcMain.handle('db:addCreditCustomer', async (event, name, phone) => {
    try {
      return db.addCreditCustomer(name, phone);
    } catch (error) {
      console.error('Error adding credit customer:', error);
      throw error;
    }
  });

  // Get all credit customers
  ipcMain.handle('db:getAllCreditCustomers', async (event, includeDeleted) => {
    try {
      return db.getAllCreditCustomers(Boolean(includeDeleted));
    } catch (error) {
      console.error('Error getting credit customers:', error);
      throw error;
    }
  });

  // Get credit customer details
  ipcMain.handle('db:getCreditCustomerDetails', async (event, customerId) => {
    try {
      return db.getCreditCustomerDetails(customerId);
    } catch (error) {
      console.error('Error getting credit customer details:', error);
      throw error;
    }
  });

  // Add credit payment
  ipcMain.handle('db:addCreditPayment', async (event, customerId, amount, date) => {
    try {
      return db.addCreditPayment(customerId, amount, date);
    } catch (error) {
      console.error('Error adding credit payment:', error);
      throw error;
    }
  });

  ipcMain.handle('db:updateCreditPayment', async (event, paymentId, amount, date) => {
    try {
      return db.updateCreditPayment(paymentId, amount, date);
    } catch (error) {
      console.error('Error updating credit payment:', error);
      throw error;
    }
  });

  ipcMain.handle('db:deleteCreditPayment', async (event, paymentId) => {
    try {
      return db.deleteCreditPayment(paymentId);
    } catch (error) {
      console.error('Error deleting credit payment:', error);
      throw error;
    }
  });

  // Delete credit customer
  ipcMain.handle('db:restoreCreditCustomer', async (event, id) => {
    try {
      return db.restoreCreditCustomer(id);
    } catch (error) {
      console.error('Error restoring credit customer:', error);
      throw error;
    }
  });

  ipcMain.handle('db:deleteCreditCustomer', async (event, id) => {
    try {
      return db.deleteCreditCustomer(id);
    } catch (error) {
      console.error('Error deleting credit customer:', error);
      throw error;
    }
  });

  ipcMain.handle('db:getBillsByDateRange', async (event, customerId, startDate, endDate) => {
    try {
      return db.getBillsByDateRange(customerId, startDate, endDate);
    } catch (error) {
      console.error('Error getting bills by date range:', error);
      throw error;
    }
  });

  // ========== VENDOR OPERATIONS ==========

  ipcMain.handle('db:getAllVendors', async () => {
    try {
      return db.getAllVendors();
    } catch (error) {
      console.error('Error getting vendors:', error);
      throw error;
    }
  });

  ipcMain.handle('db:addVendor', async (event, name, phone) => {
    try {
      return db.addVendor(name, phone);
    } catch (error) {
      console.error('Error adding vendor:', error);
      throw error;
    }
  });

  ipcMain.handle('db:addVendorTransaction', async (event, vendorId, amount, type, description, date) => {
    try {
      return db.addVendorTransaction(vendorId, amount, type, description, date);
    } catch (error) {
      console.error('Error adding vendor transaction:', error);
      throw error;
    }
  });

  ipcMain.handle('db:getVendorDetails', async (event, vendorId) => {
    try {
      return db.getVendorDetails(vendorId);
    } catch (error) {
      console.error('Error getting vendor details:', error);
      throw error;
    }
  });

  ipcMain.handle('db:deleteVendor', async (event, id) => {
    try {
      return db.deleteVendor(id);
    } catch (error) {
      console.error('Error deleting vendor:', error);
      throw error;
    }
  });

  ipcMain.handle('db:updateVendorTransaction', async (event, id, amount, description, date) => {
    try {
      return db.updateVendorTransaction(id, amount, description, date);
    } catch (error) {
      console.error('Error updating vendor transaction:', error);
      throw error;
    }
  });

  ipcMain.handle('db:deleteVendorTransaction', async (event, transactionId) => {
    try {
      return db.deleteVendorTransaction(transactionId);
    } catch (error) {
      console.error('Error deleting vendor transaction:', error);
      throw error;
    }
  });




  // ========== CATEGORY OPERATIONS ==========

  // Get all categories
  ipcMain.handle('db:getAllCategories', async () => {
    try {
      return db.getAllCategories();
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  });

  // Add a new category
  ipcMain.handle('db:addCategory', async (event, name) => {
    try {
      return db.addCategory(name);
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  });

  // Update category
  ipcMain.handle('db:updateCategory', async (event, id, name) => {
    try {
      return db.updateCategory(id, name);
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  });

  // Delete category
  ipcMain.handle('db:deleteCategory', async (event, id) => {
    try {
      return db.deleteCategory(id);
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  });

  // ========== SUPPLIER OPERATIONS ==========

  // Get all active suppliers
  ipcMain.handle('db:getAllSuppliers', async () => {
    try {
      return db.getAllSuppliers();
    } catch (error) {
      console.error('Error getting suppliers:', error);
      throw error;
    }
  });

  // Get all suppliers (admin)
  ipcMain.handle('db:getAllSuppliersAdmin', async () => {
    try {
      return db.getAllSuppliersAdmin();
    } catch (error) {
      console.error('Error getting admin suppliers:', error);
      throw error;
    }
  });

  // Add a new supplier (staff)
  ipcMain.handle('db:addSupplier', async (event, name, dailyWage) => {
    try {
      return db.addSupplier(name, dailyWage);
    } catch (error) {
      console.error('Error adding supplier:', error);
      throw error;
    }
  });

  // Update supplier (staff)
  ipcMain.handle('db:updateSupplier', async (event, id, name, dailyWage, isActive) => {
    try {
      return db.updateSupplier(id, name, dailyWage, isActive);
    } catch (error) {
      console.error('Error updating supplier:', error);
      throw error;
    }
  });

  // ========== STAFF MAINTENANCE (Stand-alone Employee Logic) ==========

  ipcMain.handle('db:getStaffList', async (event, showInactive) => {
    try {
      return db.getEmployeeList(Boolean(showInactive));
    } catch (error) {
      console.error('Error getting staff list:', error);
      throw error;
    }
  });

  ipcMain.handle('db:getStaffDetails', async (event, staffId) => {
    try {
      return db.getEmployeeDetails(staffId);
    } catch (error) {
      console.error('Error getting staff details:', error);
      throw error;
    }
  });

  ipcMain.handle('db:addEmployee', async (event, name, dailyWage) => {
    try {
      return db.addEmployee(name, dailyWage);
    } catch (error) {
      console.error('Error adding employee:', error);
      throw error;
    }
  });

  ipcMain.handle('db:updateEmployee', async (event, id, name, dailyWage, isActive) => {
    try {
      return db.updateEmployee(id, name, dailyWage, isActive);
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  });

  // ========== AUTO DAILY WAGES ==========

  // Credits today's wages (idempotent) and returns missed days that need the user's decision
  ipcMain.handle('wages:getPendingDays', async () => {
    try {
      return db.runDailyWages().pendingDays;
    } catch (error) {
      console.error('Error checking pending wage days:', error);
      throw error;
    }
  });

  ipcMain.handle('wages:resolvePendingDays', async (event, datesToCredit) => {
    try {
      return db.resolvePendingWageDays(datesToCredit);
    } catch (error) {
      console.error('Error resolving pending wage days:', error);
      throw error;
    }
  });

  ipcMain.handle('wages:markAbsent', async (event, employeeId, date) => {
    try {
      return db.markEmployeeAbsent(employeeId, date);
    } catch (error) {
      console.error('Error marking absent:', error);
      throw error;
    }
  });

  ipcMain.handle('wages:markHoliday', async (event, date) => {
    try {
      return db.markShopHoliday(date);
    } catch (error) {
      console.error('Error marking holiday:', error);
      throw error;
    }
  });

  ipcMain.handle('wages:removeSkip', async (event, employeeId, date) => {
    try {
      return db.removeWageSkip(employeeId, date);
    } catch (error) {
      console.error('Error removing absent/holiday:', error);
      throw error;
    }
  });

  ipcMain.handle('db:deleteEmployee', async (event, id) => {
    try {
      return db.deleteEmployee(id);
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  });

  ipcMain.handle('db:addStaffTransaction', async (event, staffId, amount, type, description, date) => {
    try {
      return db.addEmployeeTransaction(staffId, amount, type, description, date);
    } catch (error) {
      console.error('Error adding staff transaction:', error);
      throw error;
    }
  });

  ipcMain.handle('db:updateStaffTransaction', async (event, id, amount, description, date) => {
    try {
      return db.updateEmployeeTransaction(id, amount, description, date);
    } catch (error) {
      console.error('Error updating staff transaction:', error);
      throw error;
    }
  });

  ipcMain.handle('db:deleteStaffTransaction', async (event, transactionId) => {
    try {
      return db.deleteEmployeeTransaction(transactionId);
    } catch (error) {
      console.error('Error deleting staff transaction:', error);
      throw error;
    }
  });

  // Delete supplier
  ipcMain.handle('db:deleteSupplier', async (event, id) => {
    try {
      db.deleteSupplier(id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting supplier:', error);
      throw error;
    }
  });

  // Get supplier-wise sales
  ipcMain.handle('db:getSupplierWiseSales', async (event, startDate, endDate, supplierId) => {
    try {
      return db.getSupplierWiseSales(startDate, endDate, supplierId);
    } catch (error) {
      console.error('Error getting supplier sales:', error);
      throw error;
    }
  });

  // ========== PRINTING ==========

  // ========== PRINTING ==========

  // Legacy/Internal print:bill (Still opens a window if called)
  ipcMain.handle('print:bill', async (event, billData) => {
    const printWindow = new BrowserWindow({
      width: 400,
      height: 700,
      show: true,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    const html = generateBillHTML(billData);
    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });

  // SILENT PRINTING (Used by React Preview Page)
  ipcMain.handle('print:silent', async (event, billData, type) => {
    console.log(`🖨️ Silent Printing Type: ${type}`);

    return new Promise((resolve, reject) => {
      let settled = false;
      // Create a hidden window with enough size to render content
      const silentWin = new BrowserWindow({
        show: false,
        width: 320, // Enough width for 80mm thermal printer
        height: 1000, // Long enough for most bills
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      // FIX M1: Global timeout to prevent hanging if page never finishes loading
      const printTimeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.error('❌ Print timeout: window did not finish loading within 15 seconds');
          if (silentWin && !silentWin.isDestroyed()) silentWin.destroy();
          reject(new Error('Print timed out after 15 seconds'));
        }
      }, 15000);

      const html = type === 'KOT' ? generateKOTHTML(billData) : generateBillHTML(billData);

      // Load content
      silentWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      silentWin.webContents.on('did-finish-load', async () => {
        if (settled) return; // Already timed out
        try {
          // Minimal wait for layout — thermal bill HTML is simple, 100ms is sufficient
          await new Promise(res => setTimeout(res, 100));

          if (settled) return; // Check again after wait

          // Use cached printer to avoid slow getPrintersAsync() on every print
          console.log(`🖨️ Target Printer: ${cachedPrinterName || 'System Default'}`);

          const printOptions = {
            silent: true,
            printBackground: true,
            deviceName: cachedPrinterName,
            color: false,
            margins: {
              marginType: 'none'
            },
            landscape: false,
            scaleFactor: 100,
            // Explicit page size for 80mm thermal printer (in microns)
            pageSize: {
              width: 80000,  // 80mm in microns
              height: 297000 // A4 height, printer will auto-cut to actual length
            }
          };

          silentWin.webContents.print(printOptions, (success, errorType) => {
            clearTimeout(printTimeout);
            settled = true;

            // Wait 800ms for the spooler to receive the job before destroying the window
            setTimeout(() => {
              if (silentWin && !silentWin.isDestroyed()) {
                silentWin.destroy();
              }

              // FORCED RE-ACTIVATION OF MAIN WINDOW
              if (mainWindow) {
                mainWindow.setEnabled(true);
                mainWindow.setIgnoreMouseEvents(false);
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();

                setTimeout(() => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.focus();
                    mainWindow.webContents.send('print-finished');
                  }
                }, 200);
              }

              if (!success) {
                console.error(`❌ Print failed: ${errorType}`);
                reject(new Error(errorType || 'Unknown printing error'));
              } else {
                console.log('✅ Print job sent successfully');
                resolve(true);
              }
            }, 800);
          });
        } catch (err) {
          clearTimeout(printTimeout);
          settled = true;
          console.error('❌ Error during print preparation:', err);
          if (silentWin && !silentWin.isDestroyed()) silentWin.destroy();
          reject(err);
        }
      });

      silentWin.on('unresponsive', () => {
        if (!settled) {
          settled = true;
          clearTimeout(printTimeout);
          if (!silentWin.isDestroyed()) silentWin.destroy();
          reject(new Error('Print window became unresponsive'));
        }
      });
    });
  });

  // PREVIEW CREDIT SUMMARY - returns the exact HTML that print:creditSummary sends to the printer
  ipcMain.handle('print:creditSummaryPreview', async (event, data) => {
    return generateCreditSummaryHTML(data);
  });

  // PRINT CREDIT SUMMARY SILENTLY
  ipcMain.handle('print:creditSummary', async (event, data) => {
    console.log(`🖨️ Printing Credit Summary for: ${data.customerName}`);

    return new Promise((resolve, reject) => {
      let settled = false;
      const silentWin = new BrowserWindow({
        show: false,
        width: 320,
        height: 1000,
        webPreferences: { nodeIntegration: true, contextIsolation: false }
      });

      const printTimeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.error('❌ Summary Print timeout: window did not finish loading within 15 seconds');
          if (silentWin && !silentWin.isDestroyed()) silentWin.destroy();
          reject(new Error('Print timed out after 15 seconds'));
        }
      }, 15000);

      const html = generateCreditSummaryHTML(data);
      silentWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      silentWin.webContents.on('did-finish-load', async () => {
        if (settled) return;
        try {
          // Minimal wait for layout — 100ms is sufficient for simple thermal HTML
          await new Promise(res => setTimeout(res, 100));
          if (settled) return;

          // Use cached printer to avoid slow getPrintersAsync() on every print
          console.log(`🖨️ Target Printer (Summary): ${cachedPrinterName || 'System Default'}`);

          const printOptions = {
            silent: true,
            printBackground: true,
            deviceName: cachedPrinterName,
            color: false,
            margins: { marginType: 'none' },
            landscape: false,
            scaleFactor: 100,
            pageSize: { width: 80000, height: 297000 }
          };

          silentWin.webContents.print(printOptions, (success, errorType) => {
            clearTimeout(printTimeout);
            settled = true;
            
            setTimeout(() => {
              if (silentWin && !silentWin.isDestroyed()) silentWin.destroy();
              
              // Forced re-activation of main window (important if modal/overlay was used)
              if (mainWindow) {
                mainWindow.setEnabled(true);
                mainWindow.setIgnoreMouseEvents(false);
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
                
                setTimeout(() => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.focus();
                    mainWindow.webContents.send('print-finished');
                  }
                }, 200);
              }

              if (success) {
                console.log('✅ Summary print job sent successfully');
                resolve({ success: true });
              } else {
                console.error(`❌ Summary print failed: ${errorType}`);
                reject(new Error(errorType || 'Printing failed'));
              }
            }, 800);
          });
        } catch (error) {
          clearTimeout(printTimeout);
          settled = true;
          console.error('❌ Error during summary print preparation:', error);
          if (silentWin && !silentWin.isDestroyed()) silentWin.destroy();
          reject(error);
        }
      });
    });
  });
  // ========== FILE OPERATIONS ==========

  ipcMain.handle('file:saveImage', async (event, imageData, fileName) => {
    try {
      // Get the images directory
      const imagesDir = isDev
        ? path.join(__dirname, '..', 'public', 'food-images')
        : path.join(app.getPath('userData'), 'food-images');

      // Create directory if it doesn't exist
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      // Save the image
      const imagePath = path.join(imagesDir, fileName);

      // Remove data URL prefix if present
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      fs.writeFileSync(imagePath, buffer);

      return fileName; // Return just the filename
    } catch (error) {
      console.error('Error saving image:', error);
      throw error;
    }
  });

  ipcMain.handle('file:getImagePath', async (event, fileName) => {
    try {
      if (!fileName) return null;

      const imagesDir = isDev
        ? path.join(__dirname, '..', 'public', 'food-images')
        : path.join(app.getPath('userData'), 'food-images');

      const imagePath = path.join(imagesDir, fileName);

      // Check if file exists
      if (fs.existsSync(imagePath)) {
        // Return as file:// URL for the renderer
        return `file://${imagePath}`;
      }

      return null;
    } catch (error) {
      console.error('Error getting image path:', error);
      return null;
    }
  });

  // ========== SYSTEM OPERATIONS ==========

  ipcMain.handle('system:backupDatabase', async () => {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: 'Backup Database',
        defaultPath: `hotel_backup_${new Date().toISOString().split('T')[0]}.db`,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
      });

      if (filePath) {
        await db.backupDatabase(filePath);
        return { success: true, path: filePath };
      }
      return { success: false };
    } catch (error) {
      console.error('Backup IPC Error:', error);
      throw error;
    }
  });

  // Export a credit customer's statement for a date range as PDF or Excel (format: 'pdf' | 'xlsx')
  ipcMain.handle('export:creditStatement', async (event, customerId, startDate, endDate, format) => {
    try {
      const statement = db.getCreditStatement(customerId, startDate, endDate);
      const isPdf = format === 'pdf';

      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: isPdf ? 'Save Statement as PDF' : 'Save Statement as Excel',
        defaultPath: path.join(
          app.getPath('documents'),
          `${creditStatementExport.defaultFileName(statement)}.${isPdf ? 'pdf' : 'xlsx'}`
        ),
        filters: isPdf
          ? [{ name: 'PDF Document', extensions: ['pdf'] }]
          : [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      });

      if (!filePath) return { success: false };

      if (isPdf) {
        await creditStatementExport.writeStatementPDF(statement, filePath);
      } else {
        await creditStatementExport.writeStatementExcel(statement, filePath);
      }
      return { success: true, path: filePath };
    } catch (error) {
      console.error('Export statement error:', error);
      throw error;
    }
  });
}

/**
 * Printed amount: whole rupees as "40" (same as before), otherwise exactly 2 decimals "12.50".
 * Keep in sync with formatMoney in src/utils/money.js
 */
function formatMoney(value) {
  const amount = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/**
 * Pick the item name to print for the chosen language ('ta' | 'en' | 'hi').
 * Falls back to English when the item has no name in that language.
 * Default ('ta') keeps the original behaviour: Tamil, else English.
 */
function getItemPrintName(item, language) {
  if (language === 'en') return item.name_english;
  if (language === 'hi') return item.name_hindi || item.name_english;
  return item.name_tamil || item.name_english;
}

/**
 * Generate HTML for thermal receipt printing
 */
function generateBillHTML(billData) {
  const { billNumber, items, total, hotelName, address, fssai, license, phone, email, dateTime, supplierName, printLanguage } = billData;

  // Calculate total quantity
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        /* ========== RESET ========== */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        /* ========== BODY - 58MM THERMAL PRINTER ========== */
        body {
          width: 257px;
          max-width: 257px;
          margin: 0;
          padding: 2px;
          
          /* Arial is DARKER on thermal printers */
          font-family: Arial, sans-serif;
          font-size: 13px; /* Increased base size */
          line-height: 1.2;
          font-weight: 400; /* Default weight normal */
          
          color: #000;
          background: #fff;
          
          /* Prevent text overflow */
          overflow-wrap: break-word;
          word-wrap: break-word;
          word-break: break-word;
        }
        
        @media print {
          @page {
            margin: 0;
            padding: 0;
          }
          
          body {
            margin: 0;
            padding: 2px;
            width: 257px;
            max-width: 257px;
            -webkit-print-color-adjust: exact; /* Force dark colors */
            print-color-adjust: exact;
            color-adjust: exact;
          }
          
          /* Prevent page breaks inside elements */
          .header, .bill-info, .table, .summary, .total-section, .payment-info, .footer {
            page-break-inside: avoid;
          }
          
          /* Force maximum darkness on print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
        
        /* ========== UTILITY CLASSES ========== */
        .center {
          text-align: center;
        }
        
        .bold {
          font-weight: 700;
        }
        
        .divider {
          border-top: 2px dashed #000;
          margin: 5px 0; /* Slightly increased margin */
        }
        
        /* ========== HEADER ========== */
        .header {
          margin-bottom: 3px;
          text-align: center;
        }
        
        .hotel-name {
          font-size: 26px;
          font-weight: 800; /* Bolder as requested */
          margin-bottom: 2px;
        }
        
        .header-info {
          font-size: 13px;
          line-height: 1.2;
          margin-bottom: 1px;
          font-weight: 400; /* Normal weight for header details */
        }
        
        /* ========== BILL INFO ========== */
        .bill-info {
          margin-bottom: 5px;
          font-size: 13px; /* Increased from 10px */
        }
        
        .bill-info-line {
          margin-bottom: 3px;
        }
        
        /* ========== TABLE - MAXIMUM WIDTH ========== */
        .table {
          width: 100%;
          max-width: 253px;
          border-collapse: collapse;
          margin: 5px 0;
          table-layout: fixed; /* CRITICAL: Prevents column overflow */
        }
        
        .table th {
          border-bottom: 2px solid #000;
          padding: 5px 2px;
          font-size: 13px;
          font-weight: 700; /* Bold headers */
        }
        
        .table td {
          padding: 6px 2px;
          font-size: 13px;
          font-weight: 400; /* Normal item names */
          vertical-align: top;
        }
        
        .table th.item,
        .table td.item {
          width: 133px;
          text-align: left;
          overflow-wrap: break-word;
          word-wrap: break-word;
        }
        
        .table th.qty,
        .table td.qty {
          width: 40px;
          text-align: center;
        }
        
        .table th.rate,
        .table td.rate {
          width: 40px;
          text-align: right;
        }
        
        .table th.total,
        .table td.total {
          width: 40px;
          text-align: right;
        }
        
        /* Total: 133 + 40 + 40 + 40 = 253px */
        
        .summary {
          margin-top: 5px;
          font-size: 13px;
        }
        
        .summary-line {
          margin-bottom: 3px;
        }
        
        .summary-line-flex {
          display: block;
          margin-bottom: 3px;
        }
        
        .summary-line-flex::after {
          content: "";
          display: table;
          clear: both;
        }
        
        .summary-line-flex .left {
          float: left;
        }
        
        .summary-line-flex .right {
          float: right;
        }
        
        /* ========== TOTAL SECTION - BIGGEST & CENTERED ========== */
        .total-section {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 10px 0;
          margin: 8px 0;
          text-align: center;
        }
        
        .total-row {
          /* No global bold to allow specific control */
        }
        
        .total-label {
          font-size: 16px; 
          font-weight: 400; /* Normal text as requested */
          margin-right: 15px; /* Added space between text and amount */
          vertical-align: middle;
        }
        
        .total-amount {
          font-size: 32px; 
          font-weight: 800; /* Amount stays bold */
          vertical-align: middle;
        }
        
        .payment-info {
          margin: 5px 0;
          font-size: 13px;
        }
        
        .payment-line {
          margin-bottom: 3px;
        }
        
        .payment-line::after {
          content: "";
          display: table;
          clear: both;
        }
        
        .payment-line .left {
          float: left;
        }
        
        .payment-line .right {
          float: right;
        }
        
        .footer {
          margin-top: 8px;
          text-align: center;
          font-size: 11px;
        }
      </style>
    </head>
    <body>
      <!-- HEADER -->
      <div class="header">
        <div class="hotel-name">${hotelName || 'KM Unavagam'}</div>
        <div class="header-info">${address || 'Bodipalaiyam Main Road, Malumichampatti, Coimbatore, TAMIL NADU, 641050'}</div>
        <div class="header-info">FSSAI: ${fssai || '12425003003008'}</div>
        <div class="header-info">GPay: 9629838800 / 7530031372  Ph:8680031372 </div>
        ${license ? `<div class="header-info">LIC: ${license}</div>` : ''}
        ${phone ? `<div class="header-info">Ph: ${phone}</div>` : ''}
        ${email ? `<div class="header-info">${email}</div>` : ''}
      </div>
      
      <div class="divider"></div>
      
      <!-- BILL INFO -->
      <div class="bill-info">
        <div class="bill-info-line"><span class="bold">Bill No:</span> ${billNumber}</div>
        <div class="bill-info-line"><span class="bold">Date:</span> ${dateTime}</div>
        <div class="bill-info-line"><span class="bold">Bill To:</span> ${billData.customerName || 'Cash Sale'}</div>
        ${supplierName ? `<div class="bill-info-line"><span class="bold">To:</span> ${supplierName}</div>` : ''}
      </div>
      
      <div class="divider"></div>
      
      <!-- ITEMS TABLE -->
      <table class="table">
        <thead>
          <tr>
            <th class="item">Item</th>
            <th class="qty">Qty</th>
            <th class="rate">Rate</th>
            <th class="total">Amt</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td class="item">${getItemPrintName(item, printLanguage)}</td>
              <td class="qty">${item.quantity}</td>
              <td class="rate">${formatMoney(item.price)}</td>
              <td class="total">${formatMoney(item.price * item.quantity)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="divider"></div>
      
      <!-- SUMMARY -->
      <div class="summary">
        <div class="summary-line">Items: ${items.length} | Qty: ${totalQuantity}</div>
        <div class="summary-line-flex">
          <span class="left">Sub Total</span>
          <span class="right">${formatMoney(total)}</span>
        </div>
      </div>
      
      <!-- TOTAL - CENTERED & BIGGEST -->
      <div class="total-section">
        <div class="total-row">
          <span class="total-label">TOTAL</span>
          <span class="total-amount bold">${formatMoney(total)}</span>
        </div>
      </div>
      
      <!-- FOOTER -->
      <div class="footer">
        <div class="bold">Thank You! Visit Again!</div>
        <div style="font-size: 9px; margin-top: 3px;">Software by LancingHub</div>
        <div style="font-size: 9px;">Contact: +91 9952652246 / +91 9514001712</div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML for KOT (Staff Only)
 */
function generateKOTHTML(billData) {
  const { billNumber, items, dateTime, supplierName, printLanguage } = billData;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        /* ========== RESET ========== */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        /* ========== BODY - 58MM THERMAL PRINTER ========== */
        body {
          width: 230px;
          max-width: 230px;
          margin: 0;
          padding: 2px;
          
          /* Arial is DARKER than Courier */
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.2;
          font-weight: 700;
          
          color: #000;
          background: #fff;
          
          overflow-wrap: break-word;
          word-wrap: break-word;
          word-break: break-word;
        }
        
        @media print {
          @page {
            margin: 0;
            padding: 0;
          }
          
          body {
            margin: 0;
            padding: 2px;
            width: 257px;
            max-width: 257px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
          
          /* Force maximum darkness */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
        
        .center {
          text-align: center;
        }
        
        .bold {
          font-weight: 700;
        }
        
        .kot-title {
          font-size: 20px;
          font-weight: 700;
          border-bottom: 2px solid #000;
          margin-bottom: 5px;
          padding-bottom: 4px;
        }
        
        .kot-date {
          font-size: 11px;
          margin-bottom: 5px;
          font-weight: 700;
        }
        
        .divider {
          border-top: 2px dashed #000;
          margin: 5px 0;
        }
        
        /* ========== TABLE - MAXIMUM WIDTH ========== */
        table {
          width: 100%;
          max-width: 253px;
          border-collapse: collapse;
          margin-top: 5px;
          table-layout: fixed;
        }
        
        th {
          text-align: left;
          border-bottom: 2px solid #000;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 2px;
        }
        
        td {
          padding: 7px 2px;
          font-size: 14px;
          font-weight: 700;
          vertical-align: top;
        }
        
        th.item,
        td.item {
          width: 171px;
          text-align: left;
          overflow-wrap: break-word;
          word-wrap: break-word;
        }
        
        th.qty,
        td.qty {
          width: 82px;
          text-align: center;
          font-weight: 700;
        }
        
        .footer {
          margin-top: 10px;
          border-top: 2px solid #000;
          padding-top: 5px;
          font-size: 12px;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="center bold kot-title">KOT - PARCEL</div>
      <div class="kot-date">Bill No: ${billNumber}</div>
      <div class="kot-date">Date: ${dateTime}</div>
      ${supplierName ? `<div class="kot-date">To: ${supplierName}</div>` : ''}
      
      <div class="divider"></div>
      
      <table>
        <thead>
          <tr>
            <th class="item">ITEM NAME</th>
            <th class="qty">QTY</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td class="item">${getItemPrintName(item, printLanguage)}</td>
              <td class="qty">${item.quantity}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="center bold footer">--- KITCHEN COPY ---</div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML for Credit Summary (Statement)
 */
function generateCreditSummaryHTML(data) {
  const { customerName, bills, startDate, endDate, total, hotelName, address, phone } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: 230px;
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.2;
          padding: 2px;
          color: #000;
        }
        .header { text-align: center; margin-bottom: 8px; }
        .hotel-name { font-size: 16px; font-weight: 800; margin-bottom: 2px; }
        .header-info { font-size: 10px; margin-bottom: 1px; }
        .divider { border-top: 1px dashed #000; margin: 5px 0; }
        .title { text-align: center; font-weight: 800; font-size: 14px; margin-bottom: 5px; text-decoration: underline; }
        .info-line { font-size: 11px; margin-bottom: 2px; }
        .bold { font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
        th { text-align: left; border-bottom: 1px solid #000; font-size: 11px; padding: 3px 0; }
        td { padding: 4px 0; font-size: 12px; }
        .text-right { text-align: right; }
        .total-section { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 8px 0; margin: 10px 0; text-align: center; }
        .total-label { font-size: 14px; }
        .total-amount { font-size: 24px; font-weight: 800; }
        .footer { text-align: center; font-size: 10px; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="hotel-name">${hotelName || 'KM Unavagam'}</div>
        <div class="header-info">${address || 'Bodipalaiyam Main Road, Malumichampatti'}</div>
        <div class="header-info">Ph: ${phone || '8680031372'}</div>
      </div>
      
      <div class="divider"></div>
      
      <div class="title">CREDIT SUMMARY</div>
      
      <div class="info-line"><span class="bold">Customer:</span> ${customerName}</div>
      <div class="info-line"><span class="bold">Period:</span> ${startDate} to ${endDate}</div>
      
      <div class="divider"></div>
      
      <table>
        <thead>
          <tr>
            <th>DATE</th>
            <th class="text-right">AMOUNT (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${bills.map(b => `
            <tr>
              <td>${b.bill_date.split('-').reverse().join('/')}</td>
              <td class="text-right">${formatMoney(b.daily_total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="total-section">
        <span class="total-label">TOTAL: </span>
        <span class="total-amount">₹${formatMoney(total)}</span>
      </div>
      
      <div class="footer">
        <div class="bold">Thank You! Visit Again!</div>
        <div style="margin-top: 3px;">Software by LancingHub</div>
      </div>
    </body>
    </html>
  `;
}

console.log('✅ Electron main process loaded');

