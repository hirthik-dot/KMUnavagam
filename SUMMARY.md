# 🏨 KM Unavagam - Project Summary & Status

This document provides a complete overview of the **KM Unavagam Hotel Billing System**, covering its features, architecture, and current status as of February 2026.

---

## 🚀 Recent Updates (February 2026)

We have recently completed several major stability and feature updates:

### 1. 🛡️ Support Staff Reliability

- **Soft Deletion Implemented**: Deleting a service staff member (Supplier) no longer causes database errors or data loss.
- **Data Preservation**: Historical sales records now correctly display the staff member's name even if they have been removed from the active management list.
- **Visual Indicators**: Removed staff members are marked with a `(Removed)` badge in the Records and Bill History sections for clarity.

### 2. 📐 Layout & UI Improvements

- **Sticky Footer**: Implemented a modern "Sticky Footer" across all pages. The footer now stays pinned at the bottom of the screen regardless of content height.
- **Section Reordering**: The Admin page has been reorganized to prioritize staff management, placing it above the item list for easier access.
- **Consistency**: Unified terminology has been applied; the label "Attended" has been replaced with "Supplier" across all bill prints, KOTs, and records.

### 3. 📊 Advanced Reporting

- **Supplier Sales Filter**: Added a new filter in the Records page to view sales specifically by service staff members.
- **Net Profit Tracking**: Enhanced the Records page to calculate and display net profit by subtracting expenses from total sales (Cash + Credit).

---

## ✨ Core Features

| Feature               | Description                                                                 |
| :-------------------- | :-------------------------------------------------------------------------- |
| **100% Offline**      | Runs entirely on your local Windows PC. No internet required.               |
| **Bilingual Support** | Full support for Tamil and English names for food items.                    |
| **Credit Management** | Dedicated system to track credit customers, pending balances, and payments. |
| **Expense Tracking**  | Log daily expenses (Gas, Provisions, etc.) to get an accurate profit view.  |
| **Records & Reports** | View daily, weekly, or monthly summaries of sales and expenses.             |
| **Thermal Printing**  | High-performance thermal receipt printing for Bills and KOTs.               |

---

## 📁 System Architecture

### Frontend (React + Vite)

- **State Management**: React-based state for navigation, cart handling, and real-time updates.
- **Styling**: Vanilla CSS with a focus on high-contrast, large-button design for ease of use.

### Backend (Electron)

- **Main Process**: Handles window management and system-level operations like printing.
- **IPC Bridge**: Secure communication between the UI and the database via `preload.js`.

### Database (SQLite)

- **Storage**: `database/hotel.db` stores all items, bills, expenses, and customer data.
- **Integrity**: Uses foreign key constraints and transactional updates for data safety.

---

## 🛠️ Developer Guide

### Prerequisites

- **Node.js** (LTS version)
- **Git** (optional)

### Development Workflow

1. **Install dependencies**: `npm install`
2. **Rebuild SQLite**: `npx electron-rebuild` (Required for Windows/Electron compatibility)
3. **Start app**: `npm run dev`

### Production Build

To create a Windows installer (`.exe`):

```bash
npm run build:win
```

The installer will be generated in the `release/` folder.

---

## 🗄️ Database Schema Overview

The system uses 9 core tables:

1. `items`: Food menu items and pricing.
2. `categories`: Grouping for menu items.
3. `suppliers`: Service staff/waiter profiles (supports soft-delete).
4. `bills`: Primary transaction records.
5. `bill_items`: Details of items within each bill.
6. `expenses`: Tracking of out-going costs.
7. `credit_customers`: Profiles for credit billing.
8. `credit_bills`: Links specific bills to credit customers.
9. `credit_payments`: Ledger of payments made by credit customers.

---

## 📝 Maintenance Tips

- **Backup**: Regularly copy the `database/hotel.db` file to a USB drive for safety.
- **Images**: Item images are stored in `public/food-images/`.
- **Printer**: Ensure your thermal printer is set as the "Default Printer" in Windows for seamless 80MM printing.

**Created by: AI Assistant**
**Last Updated: February 14, 2026**