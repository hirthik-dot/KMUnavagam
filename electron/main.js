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
  ipcMain.handle('db:addItem', async (event, nameTamil, nameEnglish, price, category, imagePath) => {
    try {
      return db.addItem(nameTamil, nameEnglish, price, category, imagePath);
    } catch (error) {
      console.error('Error adding item:', error);
      throw error;
    }
  });

  // Update item
  ipcMain.handle('db:updateItem', async (event, id, nameTamil, nameEnglish, price, category, imagePath) => {
    try {
      db.updateItem(id, nameTamil, nameEnglish, price, category, imagePath);
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
        show: false,
        focusable: true, // Needs to be focusable to handle print events correctly in some versions
        skipTaskbar: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      const html = type === 'KOT' ? generateKOTHTML(billData) : generateBillHTML(billData);
      silentWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      silentWin.webContents.on('did-finish-load', () => {
        // Small delay to ensure content is ready
        setTimeout(() => {
          silentWin.webContents.print({
            silent: true,
            printBackground: true,
            deviceName: ''
          }, (success, errorType) => {
            // Cleanup the print window
            if (silentWin && !silentWin.isDestroyed()) {
              silentWin.destroy();
            }

            // FORCED RE-ACTIVATION OF MAIN WINDOW
            if (mainWindow) {
              // This sequence is the "nuclear option" for restoring focus on Windows
              mainWindow.setEnabled(true);
              mainWindow.setIgnoreMouseEvents(false);

              if (mainWindow.isMinimized()) mainWindow.restore();

              mainWindow.show(); // Activates the window
              mainWindow.focus(); // Focuses the window

              // Force focus into the web view
              setTimeout(() => {
                if (mainWindow) {
                  mainWindow.webContents.focus();
                  // Notify the renderer that printing is done and UI should be live
                  mainWindow.webContents.send('print-finished');
                }
              }, 150);
            }

            if (!success) {
              console.error('Print failed:', errorType);
              reject(new Error(errorType));
            } else {
              console.log('Print successful');
              resolve(true);
            }
          });
        }, 500);
      });

      silentWin.on('unresponsive', () => {
        if (!silentWin.isDestroyed()) silentWin.destroy();
        reject(new Error('Print window became unresponsive'));
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
          font-size: 11px;
          line-height: 1.2;
          font-weight: 600;
          
          color: #000;
          background: #fff;
          
          /* Prevent text overflow */
          overflow-wrap: break-word;
          word-wrap: break-word;
          word-break: break-word;
        }
        
        /* ========== @MEDIA PRINT - CRITICAL ========== */
        @media print {
          @page {
            /* Remove all browser default margins */
            margin: 0;
            padding: 0;
            size: 58mm auto;
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
          margin: 3px 0;
        }
        
        /* ========== HEADER ========== */
        .header {
          margin-bottom: 3px;
          text-align: center;
        }
        
        .hotel-name {
          font-size: 26px;
          font-weight: 700;
          margin-bottom: 2px;
        }
        
        .header-info {
          font-size: 13px;
          line-height: 1.2;
          margin-bottom: 1px;
          font-weight: 700;
        }
        
        /* ========== BILL INFO ========== */
        .bill-info {
          margin-bottom: 3px;
          font-size: 10px;
          font-weight: 600;
        }
        
        .bill-info-line {
          margin-bottom: 2px;
        }
        
        /* ========== TABLE - MAXIMUM WIDTH ========== */
        .table {
          width: 100%;
          max-width: 253px;
          border-collapse: collapse;
          margin: 3px 0;
          table-layout: fixed; /* CRITICAL: Prevents column overflow */
        }
        
        .table th {
          border-bottom: 2px solid #000;
          padding: 3px 2px;
          font-size: 10px;
          font-weight: 700;
        }
        
        .table td {
          padding: 4px 2px;
          font-size: 10px;
          font-weight: 600;
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
          font-weight: 700;
        }
        
        .table th.rate,
        .table td.rate {
          width: 40px;
          text-align: right;
          font-weight: 700;
        }
        
        .table th.total,
        .table td.total {
          width: 40px;
          text-align: right;
          font-weight: 700;
        }
        
        /* Total: 133 + 40 + 40 + 40 = 253px */
        
        .summary {
          margin-top: 3px;
          font-size: 10px;
          font-weight: 600;
        }
        
        .summary-line {
          margin-bottom: 2px;
          font-weight: 700;
        }
        
        .summary-line-flex {
          display: block;
          margin-bottom: 2px;
        }
        
        .summary-line-flex::after {
          content: "";
          display: table;
          clear: both;
        }
        
        .summary-line-flex .left {
          float: left;
          font-weight: 700;
        }
        
        .summary-line-flex .right {
          float: right;
          font-weight: 700;
        }
        
        .total-section {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 4px 0;
          margin: 3px 0;
        }
        
        .total-row {
          font-size: 14px;
          font-weight: 700;
        }
        
        .total-row::after {
          content: "";
          display: table;
          clear: both;
        }
        
        .total-row .left {
          float: left;
        }
        
        .total-row .right {
          float: right;
        }
        
        .payment-info {
          margin: 3px 0;
          font-size: 10px;
          font-weight: 600;
        }
        
        .payment-line {
          margin-bottom: 2px;
        }
        
        .payment-line::after {
          content: "";
          display: table;
          clear: both;
        }
        
        .payment-line .left {
          float: left;
          font-weight: 700;
        }
        
        .payment-line .right {
          float: right;
          font-weight: 700;
        }
        
        .footer {
          margin-top: 5px;
          text-align: center;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <!-- HEADER -->
      <div class="header">
        <div class="hotel-name">${hotelName || 'KM Unavagam'}</div>
        <div class="header-info">${address || 'Bodipalaiyam Main Road, Malumichampatti, Coimbatore, TAMIL NADU, 641050'}</div>
        <div class="header-info">FSSAI: ${fssai || '12425003003008'}</div>
        <div class="header-info">GPay: 7867853371 / Ph: +91 6381591518</div>
        ${license ? `<div class="header-info">LIC: ${license}</div>` : ''}
        ${phone ? `<div class="header-info">Ph: ${phone}</div>` : ''}
        ${email ? `<div class="header-info">${email}</div>` : ''}
      </div>
      
      <div class="divider"></div>
      
      <!-- BILL INFO -->
      <div class="bill-info">
        <div class="bill-info-line">Bill No: ${billNumber}</div>
        <div class="bill-info-line">Date: ${dateTime}</div>
        <div class="bill-info-line">To: ${billData.customerName || 'Cash Sale'}</div>
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
              <td class="item">${item.name_tamil || item.name_english}</td>
              <td class="qty">${item.quantity}</td>
              <td class="rate">${item.price.toFixed(0)}</td>
              <td class="total">${(item.price * item.quantity).toFixed(0)}</td>
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
          <span class="right">${total.toFixed(0)}</span>
        </div>
      </div>
      
      <!-- TOTAL -->
      <div class="total-section">
        <div class="total-row">
          <span class="left">TOTAL</span>
          <span class="right">₹${total.toFixed(0)}</span>
        </div>
      </div>
      
      <!-- PAYMENT INFO -->
      <div class="payment-info">
        <div class="payment-line">
          <span class="left">Payment</span>
          <span class="right">${billData.customerName ? 'CREDIT' : 'CASH'}</span>
        </div>
        <div class="payment-line">
          <span class="left">Paid</span>
          <span class="right">${billData.customerName ? '0' : total.toFixed(0)}</span>
        </div>
        <div class="payment-line">
          <span class="left">Balance</span>
          <span class="right">${billData.customerName ? total.toFixed(0) : '0'}</span>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <!-- FOOTER -->
      <div class="footer">
        <div class="bold">Thank You! Visit Again!</div>
        <div style="font-size: 8px; margin-top: 3px;">Software by LancingHub</div>
        <div style="font-size: 8px;">Contact: +91 9952652246 / +91 9514001712</div>
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
        
        /* ========== @MEDIA PRINT ========== */
        @media print {
          @page {
            margin: 0;
            padding: 0;
            size: 58mm auto;
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
      <div class="center kot-date">Date: ${dateTime}</div>
      
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
              <td class="item">${item.name_tamil || item.name_english}</td>
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

