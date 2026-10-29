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
    addItem: (nameTamil, nameEnglish, price, imagePath, category, nameHindi) =>
        ipcRenderer.invoke('db:addItem', nameTamil, nameEnglish, price, imagePath, category, nameHindi),

    // Update an existing food item
    updateItem: (id, nameTamil, nameEnglish, price, imagePath, category, nameHindi) =>
        ipcRenderer.invoke('db:updateItem', id, nameTamil, nameEnglish, price, imagePath, category, nameHindi),

    // Toggle item active status (enable/disable)
    toggleItemStatus: (id, isActive) =>
        ipcRenderer.invoke('db:toggleItemStatus', id, isActive),

    // Delete a food item
    deleteItem: (id) =>
        ipcRenderer.invoke('db:deleteItem', id),

    // ========== APP INFO ==========

    // Installed version, e.g. "1.0.3"
    getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

    // Staff Maintenance PIN lock (always on; first visit creates the PIN)
    hasStaffPin: () => ipcRenderer.invoke('staffLock:hasPin'),
    verifyStaffPin: (pin) => ipcRenderer.invoke('staffLock:verify', pin),
    // currentPin is needed to change an existing PIN
    setStaffPin: (pin, currentPin) => ipcRenderer.invoke('staffLock:setPin', pin, currentPin),
    // Forgotten PIN: needs the reset password given to the owner
    resetStaffPin: (resetPassword) => ipcRenderer.invoke('staffLock:reset', resetPassword),

    // ========== SETTINGS ==========

    // Get an app setting (e.g. 'printLanguage')
    getSetting: (key, defaultValue) =>
        ipcRenderer.invoke('db:getSetting', key, defaultValue),

    // Save an app setting
    setSetting: (key, value) =>
        ipcRenderer.invoke('db:setSetting', key, value),

    // ========== BILLS ==========

    // Save a bill to database
    saveBill: (items, totalAmount, customerId, supplierId, customDate) =>
        ipcRenderer.invoke('db:saveBill', items, totalAmount, customerId, supplierId, customDate),

    // Update an existing bill
    updateBill: (billId, items, totalAmount, supplierId, customDate) =>
        ipcRenderer.invoke('db:updateBill', billId, items, totalAmount, supplierId, customDate),

    // Delete a bill
    deleteBill: (billId) =>
        ipcRenderer.invoke('db:deleteBill', billId),

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

    // Update expense
    updateExpense: (expenseId, description, amount, date) =>
        ipcRenderer.invoke('db:updateExpense', expenseId, description, amount, date),

    // Delete expense
    deleteExpense: (expenseId) =>
        ipcRenderer.invoke('db:deleteExpense', expenseId),

    // Get today's expenses
    getTodayExpenses: () =>
        ipcRenderer.invoke('db:getTodayExpenses'),

    // Get today's stats (cash sales, credit sales, expenses)
    getTodayStats: () =>
        ipcRenderer.invoke('db:getTodayStats'),

    // Get expenses by date range
    getExpensesByDateRange: (startDate, endDate) =>
        ipcRenderer.invoke('db:getExpensesByDateRange', startDate, endDate),

    // Get expenses by specific date
    getExpensesByDate: (date) =>
        ipcRenderer.invoke('db:getExpensesByDate', date),

    // ========== RECORDS ==========

    // Get daily records (sales, expenses, profit)
    getDailyRecords: (startDate, endDate, supplierId) =>
        ipcRenderer.invoke('db:getDailyRecords', startDate, endDate, supplierId),

    // Get bills by specific date
    getBillsByDate: (date) =>
        ipcRenderer.invoke('db:getBillsByDate', date),

    // ========== CREDIT SYSTEM ==========

    // Add a new credit customer
    addCreditCustomer: (name, phone) =>
        ipcRenderer.invoke('db:addCreditCustomer', name, phone),

    // Get all credit customers
    // includeDeleted: also list deleted customers (Credits page "Show deleted customers")
    getAllCreditCustomers: (includeDeleted = false) =>
        ipcRenderer.invoke('db:getAllCreditCustomers', includeDeleted),

    // Get credit customer details
    getCreditCustomerDetails: (customerId) =>
        ipcRenderer.invoke('db:getCreditCustomerDetails', customerId),

    // Add a credit payment
    addCreditPayment: (customerId, amount, date) =>
        ipcRenderer.invoke('db:addCreditPayment', customerId, amount, date),

    // Correct or remove a credit payment
    updateCreditPayment: (paymentId, amount, date) =>
        ipcRenderer.invoke('db:updateCreditPayment', paymentId, amount, date),
    deleteCreditPayment: (paymentId) =>
        ipcRenderer.invoke('db:deleteCreditPayment', paymentId),

    // Delete credit customer
    deleteCreditCustomer: (id) =>
        ipcRenderer.invoke('db:deleteCreditCustomer', id),

    // Undo a customer delete
    restoreCreditCustomer: (id) =>
        ipcRenderer.invoke('db:restoreCreditCustomer', id),

    // Get bills by date range for summary
    getBillsByDateRange: (customerId, startDate, endDate) =>
        ipcRenderer.invoke('db:getBillsByDateRange', customerId, startDate, endDate),

    // Print credit summary bill
    printCreditSummary: (data) =>
        ipcRenderer.invoke('print:creditSummary', data),

    // Save a credit customer's statement for a date range (format: 'pdf' | 'xlsx')
    exportCreditStatement: (customerId, startDate, endDate, format) =>
        ipcRenderer.invoke('export:creditStatement', customerId, startDate, endDate, format),

    // Get the exact HTML of the credit summary slip (for preview before printing)
    previewCreditSummary: (data) =>
        ipcRenderer.invoke('print:creditSummaryPreview', data),

    // ========== VENDOR SYSTEM ==========
    getAllVendors: () => ipcRenderer.invoke('db:getAllVendors'),
    addVendor: (name, phone) => ipcRenderer.invoke('db:addVendor', name, phone),
    addVendorTransaction: (vendorId, amount, type, description, date) =>
        ipcRenderer.invoke('db:addVendorTransaction', vendorId, amount, type, description, date),
    getVendorDetails: (vendorId) => ipcRenderer.invoke('db:getVendorDetails', vendorId),
    deleteVendor: (id) => ipcRenderer.invoke('db:deleteVendor', id),
    updateVendorTransaction: (id, amount, description, date) =>
        ipcRenderer.invoke('db:updateVendorTransaction', id, amount, description, date),
    deleteVendorTransaction: (transactionId) => ipcRenderer.invoke('db:deleteVendorTransaction', transactionId),

    // ========== CATEGORIES ==========

    // Get all categories
    getAllCategories: () =>
        ipcRenderer.invoke('db:getAllCategories'),

    // Add a new category
    addCategory: (name) =>
        ipcRenderer.invoke('db:addCategory', name),

    // Update category
    updateCategory: (id, name) =>
        ipcRenderer.invoke('db:updateCategory', id, name),

    // Delete category
    deleteCategory: (id) =>
        ipcRenderer.invoke('db:deleteCategory', id),

    // ========== SUPPLIERS ==========

    // Get all active suppliers
    getAllSuppliers: () =>
        ipcRenderer.invoke('db:getAllSuppliers'),

    // Get all suppliers (including inactive)
    getAllSuppliersAdmin: () =>
        ipcRenderer.invoke('db:getAllSuppliersAdmin'),

    // Staff for the Records staff-wise filter (includes discharged / deleted)
    getSuppliersForReports: () =>
        ipcRenderer.invoke('db:getSuppliersForReports'),

    // Add a new supplier (staff)
    addSupplier: (name, dailyWage) =>
        ipcRenderer.invoke('db:addSupplier', name, dailyWage),

    // Update supplier (staff)
    updateSupplier: (id, name, dailyWage, isActive) =>
        ipcRenderer.invoke('db:updateSupplier', id, name, dailyWage, isActive),

    // Delete supplier
    deleteSupplier: (id) =>
        ipcRenderer.invoke('db:deleteSupplier', id),

    // Get supplier-wise sales
    getSupplierWiseSales: (startDate, endDate, supplierId) =>
        ipcRenderer.invoke('db:getSupplierWiseSales', startDate, endDate, supplierId),

    // ========== STAFF MAINTENANCE ==========
    getStaffList: (includeInactive) => ipcRenderer.invoke('db:getStaffList', includeInactive),
    getStaffDetails: (staffId) => ipcRenderer.invoke('db:getStaffDetails', staffId),
    addEmployee: (name, dailyWage, autoWage, wageStartDate, staffType) =>
        ipcRenderer.invoke('db:addEmployee', name, dailyWage, autoWage, wageStartDate, staffType),
    updateEmployee: (id, name, dailyWage, isActive, autoWage, wageStartDate, staffType) =>
        ipcRenderer.invoke('db:updateEmployee', id, name, dailyWage, isActive, autoWage, wageStartDate, staffType),

    // Auto daily wages
    getPendingWageDays: () => ipcRenderer.invoke('wages:getPendingDays'),
    resolvePendingWageDays: (datesToCredit) => ipcRenderer.invoke('wages:resolvePendingDays', datesToCredit),
    markEmployeeAbsent: (employeeId, date) => ipcRenderer.invoke('wages:markAbsent', employeeId, date),
    markShopHoliday: (date) => ipcRenderer.invoke('wages:markHoliday', date),
    removeWageSkip: (employeeId, date) => ipcRenderer.invoke('wages:removeSkip', employeeId, date),
    deleteEmployee: (id) => ipcRenderer.invoke('db:deleteEmployee', id),
    addStaffTransaction: (staffId, amount, type, description, date) =>
        ipcRenderer.invoke('db:addStaffTransaction', staffId, amount, type, description, date),
    updateStaffTransaction: (id, amount, description, date) =>
        ipcRenderer.invoke('db:updateStaffTransaction', id, amount, description, date),
    deleteStaffTransaction: (transactionId) => ipcRenderer.invoke('db:deleteStaffTransaction', transactionId),

    // ========== SYSTEM ==========
    backupDatabase: () =>
        ipcRenderer.invoke('system:backupDatabase'),
});
