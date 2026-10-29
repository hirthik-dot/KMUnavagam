# KM Unavagam — Offline Hotel Billing & Management System

> **Production app name:** Zerivo | **Platform:** Windows Desktop (Electron)  
> **Domain:** Small restaurant / mess management for Tamil Nadu context

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [System Architecture](#2-system-architecture)
3. [Workflow](#3-workflow)
4. [Tech Stack](#4-tech-stack)
5. [Core Concepts Used](#5-core-concepts-used)
6. [Folder Structure](#6-folder-structure)
7. [Database Schema](#7-database-schema)
8. [IPC Architecture](#8-ipc-architecture)
9. [Deployment Process](#9-deployment-process)
10. [Scalability & Improvements](#10-scalability--improvements)
11. [Debugging & Challenges](#11-debugging--challenges)

---

## 1. Problem Statement

Small restaurants and mess-style eateries in Tamil Nadu operate in environments with:

- **No reliable internet connectivity** — cloud-based SaaS POS systems fail entirely during outages.
- **Thermal receipt printers** (80mm) connected via USB — requiring OS-level print driver access unavailable in browsers.
- **Mixed-language menus** — items have both Tamil and English names; staff uses both.
- **Credit-based sales** — many customers run open tabs settled weekly or monthly; tracking this manually in notebooks leads to errors and disputes.
- **No dedicated IT staff** — the system must be zero-configuration after install and must recover automatically from crashes.
- **Multi-role usage** — owner needs financial summaries (daily profit/loss), staff needs fast item selection, and both interact on the same machine.

**This application replaces manual paper-based billing and notebook ledgers** with a fully offline desktop application that handles billing, credit tracking, vendor management, staff salary tracking, daily expense logging, and silent thermal receipt printing — all without requiring any internet connection, web server, or cloud database.

---

## 2. System Architecture

### 2.1 High-Level Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Electron Shell (Node.js)                  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              main.js (Main Process)                  │    │
│  │  - Window management                                 │    │
│  │  - IPC handler registration (ipcMain.handle)         │    │
│  │  - Silent print BrowserWindow lifecycle              │    │
│  │  - App startup: DB integrity check + WAL init        │    │
│  └────────────────────┬─────────────────────────────────┘    │
│                       │ IPC (invoke/handle)                   │
│  ┌────────────────────▼─────────────────────────────────┐    │
│  │              preload.js (Context Bridge)              │    │
│  │  - Exposes window.electronAPI.* to renderer          │    │
│  │  - All calls go through ipcRenderer.invoke()         │    │
│  │  - Node.js APIs are NOT directly accessible in UI    │    │
│  └────────────────────┬─────────────────────────────────┘    │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────┐    │
│  │           Chromium Renderer (React + Vite)            │    │
│  │  - React 19 SPA with custom client-side router        │    │
│  │  - No React Router — state-machine navigation         │    │
│  │  - Fully sandboxed: no direct FS or DB access         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              database.js (SQLite Layer)               │    │
│  │  - better-sqlite3: synchronous, blocking API          │    │
│  │  - All writes in db.transaction() blocks              │    │
│  │  - validateAndRound() on every monetary value         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              dbSafety.js (Durability Layer)           │    │
│  │  - WAL mode + FULL synchronous on startup            │    │
│  │  - Integrity check (PRAGMA integrity_check)           │    │
│  │  - Restore from backup if corruption detected         │    │
│  │  - Rolling backup: latest.db + daily YYYY-MM-DD.db    │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Component Interaction

| Component       | Role                                                                           | Communicates With                                            |
| --------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `main.js`       | Electron main process; registers all IPC handlers; manages BrowserWindows      | `database.js`, `dbSafety.js`, `preload.js`, OS print spooler |
| `preload.js`    | Context bridge; the only surface where Renderer meets Node.js                  | `main.js` (via ipcRenderer.invoke)                           |
| `database.js`   | Pure SQLite data layer; no business logic outside data integrity               | Called by `main.js` handlers only                            |
| `dbSafety.js`   | Runs on startup and after each bill save; handles WAL, backups, crash recovery | `database.js`, filesystem                                    |
| `App.jsx`       | Root React component; owns page state and navigation state machine             | All page components via props                                |
| Page components | Full-page views; own local UI state; communicate upward via `onNavigate` prop  | `window.electronAPI.*` for data; `onNavigate` for routing    |

### 2.3 Data Flow — Billing

```
User taps food item (FoodCard)
        │
        ▼ addToCart() — React state update (functional updater, immutable)
   cart state (BillingPage)
        │
        ▼ handlePrintBill()
   SupplierModal (select waiter — optional)
        │
        ▼ confirmPrintWithSupplier(supplier)
   Builds billData object (items, total, dateTime, supplierId, creditCustomerId)
        │
        ▼ onNavigate('print-preview', billData)
   PrintPreviewPage renders bill HTML preview
        │
        ├── User clicks "Save & Print"
        │       │
        │       ▼ window.electronAPI.saveBill()
        │    ipcRenderer.invoke('db:saveBill', ...)
        │       │
        │       ▼ [main process] ipcMain.handle('db:saveBill')
        │    database.js: saveBill() — db.transaction():
        │       INSERT INTO bills (total_amount, supplier_id, created_at)
        │       INSERT INTO bill_items (bill_id, item_id, quantity, rate) ×N
        │       INSERT INTO credit_bills (bill_id, customer_id) — if credit
        │       [returns bill_id]
        │       │
        │       ▼ dbSafety.js: triggerBackup() — async, non-blocking
        │    Updates latest.db; creates daily snapshot if not yet created today
        │
        └── window.electronAPI.printSilent(billData, 'bill')
             ipcRenderer.invoke('print:silent', ...)
                │
                ▼ [main process] creates hidden BrowserWindow (320×1000px)
             generateBillHTML(billData) — inline HTML string
             Waits: document.fonts.ready + 2× requestAnimationFrame
             getPrintersAsync() → picks default printer
             webContents.print({ silent: true, deviceName: defaultPrinter,
                                  pageSize: { width: 80000, height: auto } })
             Promise.race([printPromise, 15s timeout])
             Wait 800ms for spooler
             win.destroy()
```

### 2.4 Frontend–Backend Communication

**All frontend-to-backend calls use Electron IPC exclusively.** There is no HTTP server, no REST API, and no WebSocket. The pattern is:

```
React:       await window.electronAPI.saveBill(items, total, customerId, supplierId, date)
preload.js:  ipcRenderer.invoke('db:saveBill', items, total, customerId, supplierId, date)
main.js:     ipcMain.handle('db:saveBill', async (event, items, total, ...) => {
                 return database.saveBill(items, total, ...);
             })
database.js: saveBill() — synchronous better-sqlite3 transaction
```

Errors thrown in `database.js` propagate through `main.js` handlers (via `throw`) and are caught in React's `try/catch` around the `await window.electronAPI.*()` call.

### 2.5 State Management Flow

There is no global state library (no Redux, no Zustand). State is managed via:

1. **`App.jsx`** owns two pieces of global state: `currentPage` (string) and `navData` (object). This acts as a minimal client-side router and state transfer mechanism between pages.
2. **Page components** own their own local state using `useState` — e.g., `BillingPage` owns `cart`, `foodItems`, `filteredItems`, `searchQuery`, `selectedCategory`, `loading`, etc.
3. **Props-down pattern**: `App.jsx` passes `onNavigate(page, data)` to every page. Pages call this to change the active page and pass data to the destination.
4. **No prop-drilling beyond two levels** — components only receive what they directly use.
5. **Derived state via `useEffect`**: The category/search filter in `BillingPage` is a derived view over `foodItems` — recomputed on every change to `searchQuery`, `selectedCategory`, or `foodItems`.

---

## 3. Workflow

### 3.1 User Workflow

```
Launch app
  └── HomePage (dashboard: today stats, 6 navigation tiles)
        ├── Billing → BillingPage (item grid + cart sidebar)
        │     └── Print → SupplierModal → PrintPreviewPage → Silent Print
        ├── Records → RecordsPage (date-range daily P&L)
        ├── Expenses → ExpensesPage (tabs: daily expenses, vendors)
        ├── Credits → CreditsPage (customer list + outstanding balances)
        │     └── Tap customer → CreditDetailsPage (bill history + payments)
        │           └── "New Bill" → BillingPage (credit-mode) → save with credit_bills link
        ├── Staff → StaffPage (employee list, advance/salary transactions)
        └── Admin → AdminPage (item CRUD, category management, supplier management)
```

### 3.2 Request Lifecycle (IPC call)

```
1. React component calls: await window.electronAPI.someMethod(args)
2. preload.js:            ipcRenderer.invoke(channel, args) — serializes via Structured Clone
3. Main process:          ipcMain.handle(channel) fires — runs in Node.js context
4. database.js:           Executes synchronous better-sqlite3 operation
5. Return value:          Structured Clone back through IPC to renderer
6. React:                 Awaited promise resolves/rejects; try/catch handles error
```

Structured Clone is used by Electron IPC for serialization — plain objects, arrays, and primitives are supported. Functions and class instances cannot be passed across IPC.

### 3.3 Data Processing Flow

- **Items**: loaded once on mount, filtered in-memory (no DB round-trip per search/category change).
- **Cart**: pure in-memory state; only persisted to DB when the user explicitly saves the bill.
- **Date handling**: App uses `getTodayLocaleDate()` (returns `YYYY-MM-DD` in local timezone using `toLocaleDateString('sv-SE')`). All DB timestamps store local time, not UTC — intentional for a locale-specific application.
- **Monetary values**: All amounts pass through `validateAndRound(value)` before any DB write — rounds to 2 decimal places, throws on `NaN`, `Infinity`, or negative values.
- **Price snapshot**: `bill_items.rate` stores the price at the time of billing. Changing an item's price later does not retroactively alter historical bills.

### 3.4 Error Handling Flow

```
DB error in database.js
        │ throw error (not swallowed)
        ▼
main.js ipcMain.handle
        │ throw error (not swallowed)
        ▼
Electron serializes error message back to renderer
        ▼
React: catch (error) block
        │
        ├── setToast({ message: error.message, type: 'error' })  ← user-visible
        └── console.error(error)                                  ← dev/log
```

All IPC handlers re-throw errors explicitly. Swallowing errors silently was explicitly avoided to ensure React always receives the failure reason.

---

## 4. Tech Stack

| Technology                 | Version              | Why Chosen                                                                                                                                                                            | Trade-offs                                                                                                                                           |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Electron**               | 34.x                 | Required for: (1) native OS print dialog bypass, (2) local filesystem access, (3) packaging as a `.exe` installer, (4) offline-first. No browser-based alternative provides all four. | Large binary size (~150MB installer). Cannot be deployed to the web.                                                                                 |
| **React**                  | 19.x                 | Component-based UI well-suited to dynamic state (cart, filters). Familiarity. Concurrent features available if needed.                                                                | Overkill for purely static pages; adds Chromium JS overhead compared to vanilla HTML.                                                                |
| **Vite**                   | 6.x                  | Fast HMR in development; clean ESM output for Electron's renderer. Replaces CRA which was deprecated.                                                                                 | Requires careful configuration to work with Electron's `file://` protocol in production builds.                                                      |
| **better-sqlite3**         | 11.x                 | Synchronous API fits Electron's main process model — no async/callback complexity, no connection pooling needed. WAL mode and transactions are first-class.                           | Synchronous I/O would block the main process — acceptable for a single-machine, single-user desktop app. Would not scale to multi-client server use. |
| **SQLite**                 | (via better-sqlite3) | Zero-config, single-file database. No separate DB process to manage. Supports WAL, transactions, and integrity checks natively.                                                       | Not suitable if multiple machines need concurrent access or if data volume exceeds ~1GB.                                                             |
| **Vanilla CSS**            | —                    | Full control over layout without framework overhead. Per-page stylesheets keep style scope explicit.                                                                                  | No utility classes; shared styles must be manually extracted. More verbose than utility-first CSS.                                                   |
| **electron-builder**       | 25.x                 | Produces a Windows NSIS installer with one command. Handles packaging of native modules (`better-sqlite3`).                                                                           | Requires native module rebuild (`electron-rebuild`) if binary ABI version mismatches.                                                                |
| **concurrently + wait-on** | —                    | Dev mode: Vite dev server and Electron process must start in sequence. `wait-on` blocks Electron from launching until Vite's HTTP port is ready.                                      | Dev-only dependency; not in production bundle.                                                                                                       |
| **FontAwesome**            | 7.x                  | Icon set for UI elements (print, edit, delete, etc.) without custom SVG management.                                                                                                   | Large CSS payload if tree-shaken improperly.                                                                                                         |

---

## 5. Core Concepts Used

### 5.1 React Concepts

| Concept                               | Usage in Project                                                                                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`useState` (functional updater)**   | `setCart(prevCart => ...)` used for all cart mutations to avoid stale closure bugs.                                                                                                                      |
| **`useEffect` with dependency array** | Item filtering re-runs when `[searchQuery, selectedCategory, foodItems]` changes — derived state from local state. App-level `useEffect(fn, [])` registers a global wheel event listener once on mount.  |
| **Props pattern**                     | `onNavigate` function is passed top-down. Pages call it to change `App.jsx`'s `currentPage` — effectively a callback-based event bus.                                                                    |
| **Conditional rendering**             | Modals (`SupplierModal`, `Toast`, `ConfirmDialog`) rendered only when their respective state flags are truthy.                                                                                           |
| **Component composition**             | `BillingPage` composes `FoodCard`, `Cart`, `SearchBar`, `SupplierModal`, `Toast`, `PageHeader` without tight coupling.                                                                                   |
| **Controlled components**             | All `<input>` elements use `value + onChange` pattern — React is the single source of truth for all form state.                                                                                          |
| **Reconciliation**                    | Each `FoodCard` in the grid uses `key={item.id}` — stable keys ensure React reuses existing DOM nodes when the item list updates rather than re-mounting.                                                |
| **Client-side routing (custom)**      | No React Router used. `App.jsx` maintains a `currentPage` string + `navData` object. `renderPage()` uses a `switch` statement. Avoids URL-based routing which is meaningless in a packaged Electron app. |

### 5.2 TypeScript / JavaScript Concepts

TypeScript is not used in this project (no `.ts`/`.tsx` files). The codebase uses modern JavaScript (ES2022+) with JSX. This was a deliberate choice to minimize tooling complexity for a single-dev project. Trade-off: no compile-time type safety; runtime errors from shape mismatches are possible (e.g., when IPC returns unexpected null values).

Notable JS patterns used:

- **Async/await** throughout all IPC calls with explicit `try/catch`.
- **Spread operator** for immutable state updates: `{ ...item, quantity: item.quantity + 1 }`.
- **Array functional methods** (`filter`, `map`, `find`, `reduce`) used exclusively — no in-place mutation.
- **Optional chaining**: `creditCustomer?.creditCustomerId` to safely access nested props that may be `null`.
- **`Promise.race`**: used in the print handler to implement a 15-second global print timeout.

### 5.3 API Handling

All data access goes through `window.electronAPI.*` — a set of async functions exposed via `contextBridge`. Each function maps to an IPC channel. Error states are handled uniformly:

```js
try {
  const items = await window.electronAPI.getAllItems();
  setFoodItems(items);
} catch (error) {
  setToast({ message: "Failed to load items.", type: "error" });
} finally {
  setLoading(false);
}
```

Loading states are managed per-component with `useState(true)` initializing to `true` and set to `false` in the `finally` block, ensuring the loading spinner disappears regardless of success or failure.

### 5.4 Database Concepts

| Concept                 | Implementation                                                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WAL mode**            | `PRAGMA journal_mode=WAL` set on startup. WAL allows concurrent reads during writes and provides crash safety by writing changes to a separate WAL file before committing to the main DB.          |
| **Synchronous mode**    | `PRAGMA synchronous=FULL` ensures every write is fsync'd to disk before returning. Slower than `NORMAL` but prevents data corruption on unexpected power loss.                                     |
| **Atomic transactions** | Every multi-table write (e.g., `INSERT bills + INSERT bill_items + INSERT credit_bills`) is wrapped in `db.transaction(fn)()`. SQLite guarantees all-or-nothing execution.                         |
| **Soft delete**         | Items and customers are never hard-deleted if they appear in existing bills. `is_active=0` / `is_deleted=1` flags preserve referential integrity and historical data.                              |
| **Price snapshot**      | `bill_items.rate` captures the item's price at the moment of billing. This is critical: changing an item price later must not retroactively alter past bill totals.                                |
| **Integrity check**     | `PRAGMA integrity_check` runs on every app startup. If the result is not `"ok"`, the DB is restored from `latest.db`.                                                                              |
| **Indexing**            | SQLite's default B-tree index on primary keys. Date-based queries use `WHERE created_at LIKE 'YYYY-MM-DD%'` (prefix scan on text). No secondary indexes added currently — see Scalability section. |
| **Rolling backup**      | `latest.db` is a full DB copy updated after every successful bill save. `YYYY-MM-DD.db` daily snapshots are retained for 30 days and integrity-checked after each write.                           |

### 5.5 IPC Architecture

See [Section 8](#8-ipc-architecture) for full IPC detail.

Key security constraint: Electron's `contextIsolation: true` is enabled, meaning the renderer process's JavaScript cannot access Node.js APIs directly. `contextBridge.exposeInMainWorld('electronAPI', {...})` is the only sanctioned surface between the two contexts. This prevents XSS in the renderer from being able to call `fs.unlink()` or similar.

### 5.6 Security Considerations

- **`contextIsolation: true`**: Renderer cannot access Node.js APIs; only explicitly exposed `electronAPI` methods are callable from React code.
- **`nodeIntegration: false`** in renderer: Standard Electron security best practice; prevents renderer-side JS from requiring Node modules.
- **Input validation in `database.js`**: `validateAndRound()` rejects `NaN`, `Infinity`, negative amounts, and non-numeric values before any DB write.
- **No network exposure**: The app has no listening port, no HTTP server, and makes no outbound requests. Attack surface is limited to local process boundaries.
- **Image file handling**: User-uploaded item images are saved to a controlled directory in `%APPDATA%`. File extensions are checked before saving. Base64 image data is passed over IPC (Structured Clone serializes `ArrayBuffer` safely).

### 5.7 Deployment Architecture

This is a **locally installed Windows desktop application**, not a web app. Deployment architecture differs from web:

- **Build**: `vite build` compiles React → `dist/` (optimized static assets). `electron-builder --win` packages `dist/`, `electron/`, `package.json`, and native binaries into an NSIS installer.
- **Runtime**: Electron bundles its own Chromium and Node.js — no external runtime dependencies needed on end-user machines.
- **Database path (production)**: `%APPDATA%\Zerivo\database\hotel.db` — placed in the user's application data folder, which persists across app updates.
- **Backups path (production)**: `%APPDATA%\Zerivo\backups\`
- **No DNS, no hosting, no CDN**: Not applicable. Distribution is via installer `.exe` shared directly.

### 5.8 Environment Variables

The app uses a single environment flag:

```
NODE_ENV=development   → Vite dev server used; Electron loads http://localhost:5173
NODE_ENV=production    → Electron loads dist/index.html via file:// protocol
```

`cross-env` is used in npm scripts to set `NODE_ENV` portably across Windows/macOS.

No secrets, API keys, or credentials exist in the app — there is no external service to authenticate against.

### 5.9 Performance Optimizations

- **In-memory filtering**: The full item list is loaded once on mount. Category and search filters are applied in-memory (`Array.filter`) — no DB query per keystroke.
- **Functional state updaters**: All cart mutations use `setState(prev => ...)` to avoid stale closure issues and batch correctly under React's concurrent scheduler.
- **Stable keys**: `key={item.id}` on food cards prevents unnecessary re-mounts during re-renders.
- **Synchronous SQLite**: `better-sqlite3`'s synchronous API avoids the overhead of async I/O callbacks for simple operations and has lower latency than the async `sqlite3` driver.
- **Bill HTML generation**: The print HTML is generated as a pure string in `main.js` — no DOM, no React. This avoids launching a full renderer process just to generate HTML.
- **Font + frame sync before print**: The hidden print window waits for `document.fonts.ready` and two `requestAnimationFrame` cycles before invoking `webContents.print()`. This prevents blank output from printing before CSS/fonts have rendered.

---

## 6. Folder Structure

```
KMUnavagam/
│
├── electron/                  # Electron main process — Node.js context
│   ├── main.js                # Entry point: window setup, IPC handler registry, print logic
│   ├── database.js            # All SQLite CRUD operations; ~74KB; grouped by domain
│   ├── preload.js             # contextBridge: exposes window.electronAPI.* to renderer
│   ├── dbSafety.js            # WAL init, integrity check, backup, crash recovery
│   ├── logger.js              # Structured logger: writes to logs/ directory + console
│   └── print_handler_preview.js  # (dev/debug) Print preview helper
│
├── src/                       # React renderer — Chromium context (no Node.js access)
│   ├── main.jsx               # ReactDOM.createRoot entry point
│   ├── App.jsx                # Root component: page state machine, global scroll fix
│   ├── App.css / index.css    # Global styles, CSS reset, shared tokens
│   │
│   ├── pages/                 # Full-page components (one per route)
│   │   ├── HomePage.jsx           # Dashboard: today stats + nav grid
│   │   ├── BillingPage.jsx        # Item grid + cart; handles credit/edit mode
│   │   ├── PrintPreviewPage.jsx   # Bill/KOT preview; triggers save + silent print
│   │   ├── RecordsPage.jsx        # Date-range sales/expense/profit breakdown
│   │   ├── ExpensesPage.jsx       # Daily expenses tab + vendor credit tab
│   │   ├── CreditsPage.jsx        # Credit customer list with outstanding balances
│   │   ├── CreditDetailsPage.jsx  # Per-customer bill history + payment recording
│   │   ├── StaffPage.jsx          # Employee management + advance/salary log
│   │   └── AdminPage.jsx          # Item/category/supplier CRUD + toggle active
│   │
│   ├── components/            # Reusable UI components
│   │   ├── Cart.jsx               # Cart sidebar: item list, quantities, total, print button
│   │   ├── FoodCard.jsx           # Tap card: add to cart, quantity controls, double-tap price edit
│   │   ├── SupplierModal.jsx      # Waiter selection modal before billing
│   │   ├── PaymentSuccessModal.jsx # Post-payment confirmation popup
│   │   ├── ConfirmDialog.jsx      # Generic modal for destructive action confirmation
│   │   ├── Toast.jsx              # Ephemeral success/error/warning notification
│   │   ├── SearchBar.jsx          # Controlled text input for item search
│   │   ├── PageHeader.jsx         # Back-navigation header with dynamic backTo target
│   │   └── Footer.jsx             # App footer with software contact info
│   │
│   └── utils/
│       └── DateUtils.js           # getTodayLocaleDate(): YYYY-MM-DD in local TZ
│                                  # formatToDisplayDate(): display-ready date string
│
├── database/
│   └── hotel.db               # SQLite DB (dev). In production: %APPDATA%/Zerivo/database/hotel.db
│
├── backups/
│   ├── latest.db              # Rolling: updated after every bill save
│   └── YYYY-MM-DD.db          # Daily snapshots; 30-day retention
│
├── logs/                      # Electron app logs (structured, timestamped)
├── release/                   # electron-builder output: Zerivo Setup 1.0.0.exe
├── dist/                      # Vite build output (consumed by electron-builder)
├── public/                    # Static assets (icon.jpeg for taskbar/installer)
│
├── package.json               # Project config; electron-builder config inline under "build"
├── vite.config.js             # Vite: React plugin, no special base path needed
├── index.html                 # Vite HTML entry point
└── start_app.bat              # Convenience launcher for end users
```

**Reasoning behind structure:**

- `electron/` and `src/` are kept strictly separate to enforce the security boundary between Node.js (main) and Chromium (renderer) contexts.
- Pages and components are co-located by type, not by feature, because the app has few pages and the feature-per-folder model would add unnecessary nesting for this scale.
- `database.js` is a single file (~74KB) rather than split by domain — this was chosen to keep cross-domain queries (e.g., bills joining suppliers joining credit_bills) in one place without import overhead.

---

## 7. Database Schema

### `items`

```sql
id           INTEGER PRIMARY KEY AUTOINCREMENT
name_tamil   TEXT NOT NULL
name_english TEXT NOT NULL
price        REAL NOT NULL
category     TEXT DEFAULT 'Other'
image_path   TEXT
is_active    INTEGER DEFAULT 1   -- 0 = soft-deleted
```

Soft-delete rule: items referenced in `bill_items` are set `is_active=0`. Unused items are hard-deleted. Re-adding an item with the same name reactivates the existing record.

### `bills`

```sql
id           INTEGER PRIMARY KEY AUTOINCREMENT
created_at   TEXT NOT NULL          -- YYYY-MM-DDTHH:MM:SS (local time)
total_amount REAL NOT NULL
supplier_id  INTEGER                -- FK → suppliers; nullable (walk-in)
```

### `bill_items`

```sql
id       INTEGER PRIMARY KEY AUTOINCREMENT
bill_id  INTEGER NOT NULL           -- FK → bills
item_id  INTEGER NOT NULL           -- FK → items (preserved for soft-deleted items)
quantity INTEGER NOT NULL
rate     REAL NOT NULL              -- Price at time of sale (immutable snapshot)
```

### `expenses`

```sql
id           INTEGER PRIMARY KEY AUTOINCREMENT
expense_date TEXT NOT NULL          -- YYYY-MM-DD
description  TEXT NOT NULL
amount       REAL NOT NULL
```

### `credit_customers`

```sql
id         INTEGER PRIMARY KEY AUTOINCREMENT
name       TEXT NOT NULL
phone      TEXT
is_deleted INTEGER DEFAULT 0        -- Soft-delete preserves bill history
```

### `credit_bills`

```sql
bill_id     INTEGER PRIMARY KEY     -- 1:1 with bills; identifies bill as a credit sale
customer_id INTEGER NOT NULL        -- FK → credit_customers
```

### `credit_payments`

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
customer_id INTEGER NOT NULL
date        TEXT NOT NULL
amount      REAL NOT NULL
```

Balance = `SUM(bills.total_amount via credit_bills)` − `SUM(credit_payments.amount)` per customer.

### `categories`

```sql
id         INTEGER PRIMARY KEY AUTOINCREMENT
name       TEXT NOT NULL UNIQUE
created_at TEXT
```

### `suppliers` (Waiters/Staff assigned to bills)

```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
name        TEXT NOT NULL UNIQUE
is_active   INTEGER DEFAULT 1
is_deleted  INTEGER DEFAULT 0
daily_wage  REAL DEFAULT 0
created_at  TEXT
```

### `vendors` (External suppliers for stock purchases)

```sql
id         INTEGER PRIMARY KEY AUTOINCREMENT
name       TEXT NOT NULL UNIQUE
phone      TEXT
is_active  INTEGER DEFAULT 1
is_deleted INTEGER DEFAULT 0
created_at TEXT
```

### `vendor_transactions`

```sql
id               INTEGER PRIMARY KEY AUTOINCREMENT
vendor_id        INTEGER NOT NULL
amount           REAL NOT NULL
type             TEXT                -- 'credit' (purchase on account) | 'payment'
description      TEXT
transaction_date TEXT
expense_id       INTEGER             -- FK → expenses (linked expense record)
```

### `staff_transactions`

```sql
id               INTEGER PRIMARY KEY AUTOINCREMENT
supplier_id      INTEGER NOT NULL
amount           REAL NOT NULL
type             TEXT                -- 'advance' | 'salary'
description      TEXT
transaction_date TEXT
expense_id       INTEGER             -- FK → expenses (linked expense record)
```

---

## 8. IPC Architecture

Electron enforces a hard process boundary between the Node.js main process and the Chromium renderer. All communication crosses this boundary via IPC.

### Channels

| Channel                       | Direction       | Purpose                                              |
| ----------------------------- | --------------- | ---------------------------------------------------- |
| `db:getAllItems`              | Renderer → Main | Fetch active menu items                              |
| `db:saveBill`                 | Renderer → Main | Atomic bill save (bills + bill_items + credit_bills) |
| `db:updateBill`               | Renderer → Main | Edit existing bill                                   |
| `db:deleteBill`               | Renderer → Main | Delete bill and its line items                       |
| `db:addExpense`               | Renderer → Main | Log a daily expense                                  |
| `db:getDailyRecords`          | Renderer → Main | Date-range P&L report                                |
| `db:addCreditCustomer`        | Renderer → Main | Create new credit account                            |
| `db:getCreditCustomerDetails` | Renderer → Main | Fetch customer's bills + payments                    |
| `db:addCreditPayment`         | Renderer → Main | Record a payment from credit customer                |
| `db:getAllVendors`            | Renderer → Main | List vendor accounts                                 |
| `db:addVendorTransaction`     | Renderer → Main | Log vendor credit or payment                         |
| `db:getStaffDetails`          | Renderer → Main | Staff salary/advance history                         |
| `db:addStaffTransaction`      | Renderer → Main | Record advance or salary payment                     |
| `print:silent`                | Renderer → Main | Trigger silent thermal print (bill or KOT)           |
| `print:creditSummary`         | Renderer → Main | Print credit customer summary                        |
| `file:saveImage`              | Renderer → Main | Save uploaded item image to disk                     |
| `system:backupDatabase`       | Renderer → Main | Manual backup trigger                                |

### Security Model

```
Renderer (React)
    │  window.electronAPI.saveBill(...)    ← only this surface is accessible
    │
    ▼ contextBridge (preload.js)
    │  ipcRenderer.invoke('db:saveBill', ...)
    │
    ▼ Main Process (main.js)
    │  ipcMain.handle('db:saveBill', handler)
    │
    ▼ database.js → better-sqlite3 → hotel.db
```

- `contextIsolation: true`: Renderer JS runs in an isolated context; it cannot access `require`, `process`, or any Node globals.
- `nodeIntegration: false`: Even if the renderer is compromised, it cannot spawn child processes or read arbitrary files.
- `sandbox: false` (required for `better-sqlite3`): Native module `better-sqlite3` needs Node.js access in the main process, not the renderer.

---

## 9. Deployment Process

### Development

```bash
npm install                         # Installs all dependencies + native module binaries
npm run dev                         # Runs: vite (port 5173) + electron (waits for vite)
```

`wait-on` ensures Electron starts only after Vite's dev server is ready on port 5173. In dev, Electron loads `http://localhost:5173` so Vite HMR works normally.

### Production Build

```bash
npm run build:win
# Equivalent to:
# 1. vite build         → compiles React to dist/
# 2. electron-builder --win → packages into release/Zerivo Setup 1.0.0.exe
```

**electron-builder configuration** (in `package.json` under `"build"`):

```json
{
  "appId": "com.hotel.billing",
  "productName": "Zerivo",
  "directories": { "output": "release" },
  "files": ["dist/**/*", "electron/**/*", "package.json"],
  "win": { "target": "nsis", "icon": "public/icon.jpeg" },
  "nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true }
}
```

- **NSIS target**: Produces a standard Windows installer with a wizard UI. `oneClick: false` shows the install directory selection screen.
- **Bundled files**: Only `dist/`, `electron/`, and `package.json` are bundled — `node_modules` is excluded from the package; only production `dependencies` (React, better-sqlite3, FontAwesome) are re-installed inside the packaged app.

### Native Module Handling

`better-sqlite3` contains a C++ addon (`.node` binary). electron-builder automatically runs `electron-rebuild` during packaging to compile the addon against Electron's Node.js ABI version. This is why the `build.files` must include the rebuilt binary.

### Post-Install Behavior

On first launch:

1. `main.js` derives DB path: `%APPDATA%\Zerivo\database\hotel.db`
2. If DB does not exist → `database.js` creates tables via `CREATE TABLE IF NOT EXISTS`
3. `dbSafety.js` sets `PRAGMA journal_mode=WAL` and `PRAGMA synchronous=FULL`
4. `PRAGMA integrity_check` runs; if result ≠ `"ok"`, restores from `latest.db`
5. App window is created and renderer is loaded

---

## 10. Scalability & Improvements

### Current Limitations

| Area                            | Current State                                          | Production Concern                                   |
| ------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| **Single user**                 | One machine, one SQLite file                           | Cannot support multiple POS terminals simultaneously |
| **No secondary indexes**        | Date queries use `LIKE 'YYYY-MM-DD%'` on `TEXT` column | Will degrade as bill count grows beyond ~100K rows   |
| **No authentication**           | Anyone who opens the app has full access               | No role separation between owner and cashier         |
| **No audit log**                | Deleted bills leave no trace                           | Potential for undetected fraud                       |
| **Manual distribution**         | Installer shared manually                              | No auto-update mechanism                             |
| **No data export**              | Records only viewable in-app                           | Cannot export to CSV/Excel for accountant            |
| **No backup to cloud**          | Backups are local only                                 | Machine failure = data loss                          |
| **English-only error messages** | Errors shown in English                                | Staff who only read Tamil cannot diagnose issues     |

### What Would Change in a Production-Hardened Version

1. **Secondary index on `bills.created_at`**: `CREATE INDEX idx_bills_date ON bills(created_at)` would change date-range queries from full-table scans to B-tree seeks.
2. **Auto-update**: Integrate `electron-updater` with a hosted release server (e.g., GitHub Releases or a private S3 bucket).
3. **Role-based access**: A PIN-protected admin mode vs. cashier mode, implemented as an app-level state with a session timeout.
4. **Audit table**: Append-only `audit_log(action, entity, entity_id, old_value, new_value, timestamp)` for every destructive operation.
5. **CSV export**: Use Node's `fs` to write CSV from query results for the Records and Credits pages.
6. **Cloud backup via S3**: After every daily snapshot, upload to S3 with a configurable bucket/credentials — keeps last 30 remote copies.
7. **Multi-terminal support**: Migrate from SQLite to PostgreSQL or MySQL with a local server process; replace IPC with HTTP/REST using Express.

---

## 11. Debugging & Challenges

### Challenge 1: Silent Print Producing Blank Receipts

**Problem**: `webContents.print({ silent: true })` returned success but the physical receipt was blank or partially printed.

**Root cause**: The hidden BrowserWindow was destroyed before the OS print spooler had finished streaming the job to the printer driver. The `print()` callback fires when the print job is _submitted_ to the spooler, not when it is _physically printed_.

**Solution**: Added an 800ms delay after `Promise.race([printPromise, timeout])` resolves before calling `win.destroy()`. Also added `document.fonts.ready` + two `requestAnimationFrame` waits before calling `print()` to ensure the HTML is fully rendered before the print snapshot is taken.

### Challenge 2: Default Printer Detection

**Problem**: The original implementation hardcoded the printer name (`RETSOL RTP82`). When deployed on a different machine or after a printer rename, printing silently failed.

**Solution**: Replaced hardcoded name with `webContents.getPrintersAsync()` → find the entry with `isDefault: true` → pass `deviceName` to `webContents.print()`. Fallback: if no default printer is detected, log an error and surface it to the user via the print result.

### Challenge 3: Electron IPC and `better-sqlite3` ABI Mismatch

**Problem**: `better-sqlite3` is a native Node.js addon compiled against a specific Node.js ABI version. Electron uses its own Node.js runtime with a different ABI. On fresh installs, `require('better-sqlite3')` threw `NODE_MODULE_VERSION` mismatch errors.

**Solution**: Added `electron-rebuild` to the postinstall script and configured `electron-builder` to run it during packaging. This compiles `better-sqlite3` against Electron's actual Node.js ABI.

### Challenge 4: Date/Time Consistency in Locale Context

**Problem**: JavaScript's `new Date()` and `.toISOString()` produce UTC timestamps. Bills created in India at 11 PM would be stored with the _next day's_ UTC date, causing daily report queries to miss them.

**Solution**: All date values are generated using `toLocaleDateString('sv-SE')` (which produces `YYYY-MM-DD` format in local time) and `toLocaleString('en-IN')` for display. DB queries filter by `created_at LIKE 'YYYY-MM-DD%'` using the local date, not UTC.

### Challenge 5: Soft-Delete Maintaining Bill History

**Problem**: When an admin deletes a food item, existing bills that reference it via `bill_items.item_id` would show broken/empty item names.

**Solution**: Items referenced in at least one `bill_items` row are soft-deleted (`is_active=0`) instead of hard-deleted. `bill_items` JOINs `items` without an `is_active` filter, so historical bill display continues to resolve correctly. Hard delete is only performed if the item has zero bill history.

### Challenge 6: Float Precision in Financial Totals

**Problem**: JavaScript floating-point arithmetic causes values like `10.1 + 10.2 = 20.299999999999997`. Displaying this on a bill is unacceptable.

**Solution**: Implemented `validateAndRound(value)` in `database.js`:

```js
function validateAndRound(value) {
  if (
    typeof value !== "number" ||
    isNaN(value) ||
    !isFinite(value) ||
    value < 0
  ) {
    throw new Error(`Invalid monetary value: ${value}`);
  }
  return Math.round(value * 100) / 100;
}
```

This is applied to every monetary value before any `INSERT` or `UPDATE`. On the frontend, `toFixed(2)` is used for display only.

---

## Running the Application

### Prerequisites

- Node.js 18+
- Windows 10/11 (required for Electron + NSIS installer)
- A thermal printer set as the Windows default printer (for silent printing)

### Development

```bash
cd KMUnavagam
npm install
npm run dev
```

This starts the Vite dev server on `http://localhost:5173` and launches Electron pointing to it.

### Production Build

```bash
npm run build:win
# Output: release/Zerivo Setup 1.0.0.exe
```

Run the installer on the target machine. No additional configuration required.

### Database Location (Post-Install)

```
%APPDATA%\Zerivo\database\hotel.db
%APPDATA%\Zerivo\backups\latest.db
%APPDATA%\Zerivo\backups\YYYY-MM-DD.db
```

---

_This README was written to provide engineering-level documentation suitable for technical review and code interviews. All architectural decisions are documented with their rationale and trade-offs._
