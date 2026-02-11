// main.js - Main Electron Process
// This is the entry point for the Electron application

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Import database functions
const db = require('./database');

// Store reference to the main window
let mainWindow;

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
    title: 'KM Unavagam',
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
app.whenReady().then(() => {
  console.log('🚀 Starting Hotel Billing Application...');

  // Initialize the database
  db.initializeDatabase();

  // Set up IPC handlers (communication between React and Electron)
  setupIPCHandlers();

  // Create the window
  createWindow();

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
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
 * Set up IPC handlers for communication between React and Electron
 * These handle requests from the React frontend
 */
function setupIPCHandlers() {
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
  ipcMain.handle('db:addItem', async (event, nameTamil, nameEnglish, price, imagePath) => {
    try {
      return db.addItem(nameTamil, nameEnglish, price, imagePath);
    } catch (error) {
      console.error('Error adding item:', error);
      throw error;
    }
  });

  // Update item
  ipcMain.handle('db:updateItem', async (event, id, nameTamil, nameEnglish, price, imagePath) => {
    try {
      db.updateItem(id, nameTamil, nameEnglish, price, imagePath);
      return { success: true };
    } catch (error) {
      console.error('Error updating item:', error);
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
  ipcMain.handle('db:saveBill', async (event, items, totalAmount, customerId) => {
    try {
      return db.saveBill(items, totalAmount, customerId);
    } catch (error) {
      console.error('Error saving bill:', error);
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
  ipcMain.handle('db:getDailyRecords', async (event, startDate, endDate) => {
    try {
      return db.getDailyRecords(startDate, endDate);
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
  ipcMain.handle('db:getAllCreditCustomers', async (event) => {
    try {
      return db.getAllCreditCustomers();
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
      const silentWin = new BrowserWindow({
        show: false, // Hidden window
        webPreferences: { nodeIntegration: true, contextIsolation: false }
      });

      const html = type === 'KOT' ? generateKOTHTML(billData) : generateBillHTML(billData);
      silentWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      silentWin.webContents.on('did-finish-load', () => {
        silentWin.webContents.print({
          silent: true,
          printBackground: true,
          deviceName: '' // Uses system default printer
        }, (success, errorType) => {
          if (!success) {
            console.error('Print failed:', errorType);
            reject(new Error(errorType));
          } else {
            console.log('Print successful');
            resolve(true);
          }
          silentWin.close();
        });
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
}

/**
 * Generate HTML for thermal receipt printing
 */
function generateBillHTML(billData) {
  const { billNumber, items, total, hotelName, address, fssai, license, phone, email, dateTime } = billData;

  // Calculate total quantity
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: Arial, sans-serif;
          width: 80mm;
          padding: 8px;
          font-size: 11px;
          line-height: 1.3;
        }
        
        .center {
          text-align: center;
        }
        
        .bold {
          font-weight: bold;
        }
        
        .header {
          margin-bottom: 8px;
          text-align: center;
        }
        
        .hotel-name {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 4px;
        }
        
        .header-info {
          font-size: 9px;
          line-height: 1.4;
          margin-bottom: 2px;
        }
        
        .divider {
          border-top: 1px solid #000;
          margin: 6px 0;
        }
        
        .bill-info {
          margin-bottom: 6px;
          font-size: 10px;
        }
        
        .bill-info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        
        .table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
        }
        
        .table th {
          border-bottom: 1px solid #000;
          padding: 4px 2px;
          text-align: left;
          font-size: 10px;
          font-weight: bold;
        }
        
        .table td {
          padding: 3px 2px;
          font-size: 10px;
        }
        
        .table th.qty,
        .table td.qty,
        .table th.rate,
        .table td.rate,
        .table th.total,
        .table td.total {
          text-align: right;
          width: 50px;
        }
        
        .summary {
          margin-top: 8px;
          font-size: 10px;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3px;
        }
        
        .total-section {
          border-top: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 6px 0;
          margin: 8px 0;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          font-weight: bold;
        }
        
        .payment-info {
          margin: 8px 0;
          font-size: 10px;
        }
        
        .payment-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        
        .footer {
          margin-top: 10px;
          text-align: center;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="hotel-name">${hotelName || 'KM Unavagam'}</div>
        <div class="header-info">${address || 'Bodipalaiyam Main Road, Malumichampatti, Coimbatore, TAMIL NADU, 641050'}</div>
        <div class="header-info">FSSAI Number: ${fssai || '12425003003008'}</div>
        ${license ? `<div class="header-info">LICENSE Number: ${license}</div>` : ''}
        ${phone ? `<div class="header-info">Phone Number: ${phone}</div>` : ''}
        ${email ? `<div class="header-info">@ ${email}</div>` : ''}
      </div>
      
      <div class="divider"></div>
      
      <div class="bill-info">
        <div class="bill-info-row">
          <span>Bill No: ${billNumber}</span>
        </div>
        <div class="bill-info-row">
          <span>Created: ${dateTime}</span>
        </div>
        <div class="bill-info-row">
          <span>Bill To: ${billData.customerName || 'Cash Sale'}</span>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <table class="table">
        <thead>
          <tr>
            <th>Item Name</th>
            <th class="qty">Qty</th>
            <th class="rate">Rate</th>
            <th class="total">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.name_tamil || item.name_english}</td>
              <td class="qty">${item.quantity}</td>
              <td class="rate">${item.price.toFixed(0)}</td>
              <td class="total">${(item.price * item.quantity).toFixed(0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="summary">
        <div class="summary-row">
          <span>Total Items: ${items.length}</span>
        </div>
        <div class="summary-row">
          <span>Total Quantity: ${totalQuantity}</span>
        </div>
        <div class="summary-row">
          <span>Sub Total</span>
          <span>${total.toFixed(0)}</span>
        </div>
      </div>
      
      <div class="total-section">
        <div class="total-row">
          <span>Total</span>
          <span>${total.toFixed(0)}</span>
        </div>
      </div>
      
      <div class="payment-info">
        <div class="payment-row">
          <span>Mode of Payment</span>
          <span>${billData.customerName ? 'CREDIT' : 'CASH'}</span>
        </div>
        <div class="payment-row">
          <span>Amount Paid</span>
          <span>${billData.customerName ? '0' : total.toFixed(0)}</span>
        </div>
        <div class="payment-row">
          <span>Pending Bal</span>
          <span>${billData.customerName ? total.toFixed(0) : '0'}</span>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <div class="footer">
        <div class="bold">Thank You! Visit Again!</div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML for KOT (Staff Only)
 */
function generateKOTHTML(billData) {
  const { items, dateTime } = billData;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Courier New', Courier, monospace;
          width: 80mm;
          padding: 10px;
          margin: 0;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .kot-title { font-size: 24px; border-bottom: 2px solid black; margin-bottom: 10px; }
        .kot-date { font-size: 12px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { text-align: left; border-bottom: 1px solid black; font-size: 14px; }
        td { padding: 8px 0; font-size: 18px; font-weight: bold; }
        .qty { text-align: right; }
        .footer { margin-top: 20px; border-top: 1px dashed black; padding-top: 10px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="center bold kot-title">KOT - PARCEL</div>
      <div class="center kot-date">Date: ${dateTime}</div>
      
      <table>
        <thead>
          <tr>
            <th>ITEM NAME</th>
            <th class="qty">QTY</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.name_tamil || item.name_english}</td>
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

console.log('✅ Electron main process loaded');

