// preload.js - Bridge between Electron and React
// This file exposes safe functions that React can call to interact with the database

const { contextBridge, ipcRenderer } = require('electron');

// Expose database functions to React
// React can call these using: window.electronAPI.functionName()
contextBridge.exposeInMainWorld('electronAPI', {
    // ========== FOOD ITEMS ==========

    // Get all active food items (for billing page)
    getAllItems: () => ipcRenderer.invoke('db:getAllItems'),

    // Get all items including inactive (for admin page)
    getAllItemsAdmin: () => ipcRenderer.invoke('db:getAllItemsAdmin'),

    // Add a new food item
    addItem: (nameTamil, nameEnglish, price, category, imagePath) =>
        ipcRenderer.invoke('db:addItem', nameTamil, nameEnglish, price, category, imagePath),

    // Update an existing food item
    updateItem: (id, nameTamil, nameEnglish, price, category, imagePath) =>
        ipcRenderer.invoke('db:updateItem', id, nameTamil, nameEnglish, price, category, imagePath),

    // Toggle item active status (enable/disable)
    toggleItemStatus: (id, isActive) =>
        ipcRenderer.invoke('db:toggleItemStatus', id, isActive),

    // Delete a food item
    deleteItem: (id) =>
        ipcRenderer.invoke('db:deleteItem', id),

    // ========== BILLS ==========

    // Save a bill to database
    saveBill: (items, totalAmount, customerId) =>
        ipcRenderer.invoke('db:saveBill', items, totalAmount, customerId),

    // Get bill history
    getBillHistory: (limit) =>
        ipcRenderer.invoke('db:getBillHistory', limit),

    // Get items for a specific bill
    getBillItems: (billId) =>
        ipcRenderer.invoke('db:getBillItems', billId),

    // Print a bill
    printBill: (billData) =>
        ipcRenderer.invoke('print:bill', billData),

    // Silent print (Bill or KOT)
    printSilent: (billData, type) =>
        ipcRenderer.invoke('print:silent', billData, type),

    // ========== FILE OPERATIONS ==========

    // Save uploaded image
    saveImage: (imageData, fileName) =>
        ipcRenderer.invoke('file:saveImage', imageData, fileName),

    // Get image path
    getImagePath: (fileName) =>
        ipcRenderer.invoke('file:getImagePath', fileName),

    // ========== EXPENSES ==========

    // Add a new expense
    addExpense: (description, amount, expenseDate) =>
        ipcRenderer.invoke('db:addExpense', description, amount, expenseDate),

    // Get expenses by date range
    getExpensesByDateRange: (startDate, endDate) =>
        ipcRenderer.invoke('db:getExpensesByDateRange', startDate, endDate),

    // Get expenses by specific date
    getExpensesByDate: (date) =>
        ipcRenderer.invoke('db:getExpensesByDate', date),

    // ========== RECORDS ==========

    // Get daily records (sales, expenses, profit)
    getDailyRecords: (startDate, endDate) =>
        ipcRenderer.invoke('db:getDailyRecords', startDate, endDate),

    // Get bills by specific date
    getBillsByDate: (date) =>
        ipcRenderer.invoke('db:getBillsByDate', date),

    // ========== CREDIT SYSTEM ==========

    // Add a new credit customer
    addCreditCustomer: (name, phone) =>
        ipcRenderer.invoke('db:addCreditCustomer', name, phone),

    // Get all credit customers
    getAllCreditCustomers: () =>
        ipcRenderer.invoke('db:getAllCreditCustomers'),

    // Get credit customer details
    getCreditCustomerDetails: (customerId) =>
        ipcRenderer.invoke('db:getCreditCustomerDetails', customerId),

    // Add a credit payment
    addCreditPayment: (customerId, amount, date) =>
        ipcRenderer.invoke('db:addCreditPayment', customerId, amount, date),
});
