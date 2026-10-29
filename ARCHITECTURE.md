# KM Unavagam — Application Architecture

## Overview

**KM Unavagam** is a fully offline **hotel billing and management desktop application** built for Tamil Nadu-style small restaurants. It runs on **Electron** (Node.js backend + Chromium frontend) with a **React** UI and **SQLite** database (via better-sqlite3).

---

## Technology Stack

| Layer    | Technology                     | Usage                                 |
| -------- | ------------------------------ | ------------------------------------- |
| Runtime  | Electron 34.x                  | Desktop wrapper, native printing, IPC |
| Frontend | React 18 (Vite build)          | UI components and pages               |
| Database | SQLite (better-sqlite3)        | Local persistent storage              |
| Styling  | Vanilla CSS (modular)          | Per-page stylesheets                  |
| Backup   | SQLite native `.backup()`      | WAL + rolling backups                 |
| Printing | Electron `webContents.print()` | Silent 80mm thermal printing          |

---

## File Structure

```
KMUnavagam/
├── electron/
│   ├── main.js           # Electron main process, window creation, IPC handlers
│   ├── database.js       # All SQLite operations (CRUD, transactions, queries)
│   ├── preload.js        # Secure IPC bridge (contextBridge) to React
│   ├── dbSafety.js       # WAL, backup, crash recovery, integrity check
│   └── logger.js         # Structured logger (to file + console)
│
├── src/
│   ├── App.jsx           # Root component: route/page state management
│   ├── pages/
│   │   ├── HomePage.jsx         # Dashboard with today stats + navigation
│   │   ├── BillingPage.jsx      # Main billing: food items grid + cart
│   │   ├── PrintPreviewPage.jsx # Bill/KOT preview + silent print trigger
│   │   ├── RecordsPage.jsx      # Daily records: sales, expenses, profit
│   │   ├── ExpensesPage.jsx     # Daily expenses + vendor credit management
│   │   ├── CreditsPage.jsx      # Credit customers list
│   │   ├── CreditDetailsPage.jsx# Per-customer bill/payment history
│   │   ├── StaffPage.jsx        # Staff maintenance + transaction history
│   │   └── AdminPage.jsx        # Item/category/supplier management
│   ├── components/
│   │   ├── Cart.jsx             # Billing cart sidebar
│   │   ├── FoodCard.jsx         # Food item tap card with quantity control
│   │   ├── PageHeader.jsx       # Back navigation header
│   │   ├── Toast.jsx            # Success/error notifications
│   │   ├── ConfirmDialog.jsx    # Confirmation modal
│   │   ├── SupplierModal.jsx    # Staff selection modal before billing
│   │   ├── PaymentSuccessModal.jsx # Payment confirmation popup
│   │   ├── SearchBar.jsx        # Item search filter
│   │   └── Footer.jsx           # App footer with contact info
│   └── utils/
│       └── DateUtils.js         # getTodayLocaleDate(), formatToDisplayDate()
│
├── database/
│   └── hotel.db          # SQLite database file (dev; prod: AppData)
├── backups/
│   ├── latest.db         # Rolling latest backup (updated after every bill)
│   └── YYYY-MM-DD.db     # Daily snapshots (retained 30 days)
└── release/
    └── Zerivo Setup 1.0.0.exe  # Production installer
```

---

## Database Schema

### `items` — Food Menu

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name_tamil TEXT NOT NULL
name_english TEXT NOT NULL
price REAL NOT NULL
category TEXT DEFAULT 'Other'
image_path TEXT
is_active INTEGER DEFAULT 1
```

> **Soft-delete behavior**: Items that appear in bills are soft-deleted (`is_active=0`). Unused items are hard-deleted. When re-adding an item with the same name, the old record is reactivated.

### `bills` — Bill Records

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
created_at TEXT NOT NULL    -- YYYY-MM-DDTHH:MM:SS (local timestamp)
total_amount REAL NOT NULL
supplier_id INTEGER         -- FK to suppliers
```

### `bill_items` — Line Items per Bill

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
bill_id INTEGER NOT NULL    -- FK to bills
item_id INTEGER NOT NULL    -- FK to items (preserved even for soft-deleted items)
quantity INTEGER NOT NULL
rate REAL NOT NULL          -- Price at time of billing (frozen snapshot)
```

### `expenses` — Daily Expenses

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
expense_date TEXT NOT NULL  -- YYYY-MM-DD
description TEXT NOT NULL
amount REAL NOT NULL
```

### `credit_customers` — Credit Customers

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL
phone TEXT
is_deleted INTEGER DEFAULT 0  -- Soft-delete to preserve bill history
```

### `credit_bills` — Bill to Credit Customer Link

```sql
bill_id INTEGER PRIMARY KEY   -- 1:1 with bills
customer_id INTEGER NOT NULL
```

### `credit_payments` — Payments by Credit Customers

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
customer_id INTEGER NOT NULL
date TEXT NOT NULL
amount REAL NOT NULL
```

### `categories` — Item Categories

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL UNIQUE
created_at TEXT
```

### `suppliers` — Staff/Waiters

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL UNIQUE
is_active INTEGER DEFAULT 1
is_deleted INTEGER DEFAULT 0
daily_wage REAL DEFAULT 0
created_at TEXT
```

### `vendors` — External Vendors (for credit purchases)

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL UNIQUE
phone TEXT
is_active INTEGER DEFAULT 1
is_deleted INTEGER DEFAULT 0
created_at TEXT
```

### `vendor_transactions` — Vendor Credit/Payment Transactions

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
vendor_id INTEGER NOT NULL
amount REAL NOT NULL
type TEXT                   -- 'credit' or 'payment'
description TEXT
transaction_date TEXT
expense_id INTEGER           -- FK back to expenses (linked transactions)
```

### `staff_transactions` — Staff Salary/Advance Transactions

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
supplier_id INTEGER NOT NULL
amount REAL NOT NULL
type TEXT                   -- 'advance' or 'salary'
description TEXT
transaction_date TEXT
expense_id INTEGER           -- FK back to expenses
```

---

## Data Flow

### Billing Flow

```
User taps food items → Cart (state) → handlePrintBill()
    → SupplierModal (select waiter)
        → BillingPage navigates to print-preview with billData
            → PrintPreviewPage shows preview
                → User clicks Print/Save
                    → window.electronAPI.saveBill() / updateBill()
                        → IPC → main.js handler → database.js saveBill()
                            → SQLite transaction: bills + bill_items + credit_bills
                                → backup triggered asynchronously
                    → window.electronAPI.printSilent()
                        → IPC → main.js → creates hidden BrowserWindow
                            → generates HTML → webContents.print() to default printer
```

### Credit Billing Flow

```
CreditsPage → click customer → navigate to credit-details
    → CreditDetailsPage → "New Bill" button
        → navigates to billing with creditCustomer context
            → normal billing flow + creditCustomerId is passed to saveBill
                → saved in credit_bills table for balance tracking
```

---

## IPC Architecture

**React to Electron communication** uses a secure `contextBridge` pattern:

1. `preload.js` exposes `window.electronAPI.*` methods using `contextBridge.exposeInMainWorld()`
2. Each method calls `ipcRenderer.invoke(channel, ...args)`
3. `main.js` registers `ipcMain.handle(channel, handler)` for each channel
4. `database.js` functions are called from handler — all errors are re-thrown so React sees them

**All IPC error propagation is complete** — every handler uses `throw error` so the React `catch` block receives the full error message.

---

## Safety & Durability

| Concern                              | Solution                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| DB corruption on crash               | WAL mode + `synchronous=FULL` + integrity check on startup                           |
| Money float drift                    | `validateAndRound()` on all monetary DB writes (rounds to 2dp, rejects NaN/negative) |
| Partial writes                       | All multi-step writes are wrapped in `db.transaction()` (atomic)                     |
| Crash recovery                       | `restoreLatestBackupIfCorrupted()` on app start — restores from latest.db            |
| Bill history for deleted items       | Items soft-deleted if in bills; bill_items JOIN works forever                        |
| Credit history for deleted customers | Customers soft-deleted only; bill records intact                                     |
| Backup safety                        | Rolling backup updated after every successful bill save                              |
| Daily snapshots                      | Created once per day, retained 30 days, integrity-verified after write               |

---

## Printing System

- **Standard printing**: `print:bill` IPC — opens visible BrowserWindow with HTML
- **Silent printing**: `print:silent` IPC (used in production)
  - Creates hidden 320x1000px BrowserWindow
  - Generates HTML (Bill or KOT) with `generateBillHTML()` / `generateKOTHTML()`
  - Waits for `document.fonts.ready` + 2x `requestAnimationFrame` for rendering
  - Finds system default printer via `getPrintersAsync()`
  - Prints with `silent: true`, no margins, 80mm width (80000 microns)
  - 15-second global timeout prevents hanging
  - Window destroyed after print job submitted + 800ms delay for spooler

---

## Financial Calculations

### Home Page Stats (today)

```sql
cash_sales   = SUM(total_amount) WHERE no credit_bills link
credit_sales = SUM(total_amount) WHERE credit_bills link EXISTS
total_expenses = SUM(amount) FROM expenses WHERE expense_date = today
```

### Records Page (date range)

```
profit = total_sales - total_expenses  (per day)
```

### Credit Balance

```
balance = total_credit (sum of all customer bills) - total_paid (sum of payments)
```

---

## Production Deployment Notes

- **Database path (production)**: `%APPDATA%/Zerivo/database/hotel.db`
- **Backups path (production)**: `%APPDATA%/Zerivo/backups/`
- **Installer**: `release/Zerivo Setup 1.0.0.exe`
- App name: **Zerivo** (from `package.json` productName)
- No internet connection required — fully offline
- Default printer is used automatically — no configuration needed
