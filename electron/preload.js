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
    addItem: (nameTamil, nameEnglish, price, imagePath) =>
        ipcRenderer.invoke('db:addItem', nameTamil, nameEnglish, price, imagePath),

    // Update an existing food item
    updateItem: (id, nameTamil, nameEnglish, price, imagePath) =>
        ipcRenderer.invoke('db:updateItem', id, nameTamil, nameEnglish, price, imagePath),

    // Toggle item active status (enable/disable)
    toggleItemStatus: (id, isActive) =>
        ipcRenderer.invoke('db:toggleItemStatus', id, isActive),

    // Delete a food item
    deleteItem: (id) =>
        ipcRenderer.invoke('db:deleteItem', id),

    // ========== BILLS ==========

    // Save a bill to database
    saveBill: (items, totalAmount) =>
        ipcRenderer.invoke('db:saveBill', items, totalAmount),

    // Get bill history
    getBillHistory: (limit) =>
        ipcRenderer.invoke('db:getBillHistory', limit),

    // Get items for a specific bill
    getBillItems: (billId) =>
        ipcRenderer.invoke('db:getBillItems', billId),

    // ========== PRINTING ==========

    // Print a bill
    printBill: (billData) =>
        ipcRenderer.invoke('print:bill', billData),

    // ========== FILE OPERATIONS ==========

    // Save uploaded image
    saveImage: (imageData, fileName) =>
        ipcRenderer.invoke('file:saveImage', imageData, fileName),

    // Get image path
    getImagePath: (fileName) =>
        ipcRenderer.invoke('file:getImagePath', fileName),
});
