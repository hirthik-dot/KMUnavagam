# 🏨 Hotel Billing Application

**Offline Windows Desktop Application for Hotel Billing**

A simple, touch-friendly billing system designed for elderly users, built with Electron, React, and SQLite.

---

## ✨ Features

- ✅ **100% Offline** - No internet or server required
- ✅ **Simple UI** - Large buttons, clear text, easy to use
- ✅ **Bilingual** - Tamil and English support
- ✅ **Touch-Friendly** - Designed for elderly users
- ✅ **Thermal Printing** - Print bills directly
- ✅ **Local Database** - SQLite for data storage
- ✅ **Admin Panel** - Manage food items easily

---

## 🚀 Quick Start

### First Time Setup

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org
   - Install the LTS version

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Rebuild SQLite for Electron**
   ```bash
   npx electron-rebuild
   ```

### Run the Application

```bash
npm run dev
```

The application window will open automatically!

---

## 📖 Documentation

- **Current Status** - Complete project overview and recent updates (see [SUMMARY.md](./SUMMARY.md))
- **Features Guide** - Detailed guide on new modules (see [NEW_FEATURES_GUIDE.md](./NEW_FEATURES_GUIDE.md))
- **Thermal Print Fix** - Documentation for printer troubleshooting (see [THERMAL_RECEIPT_FIX.md](./THERMAL_RECEIPT_FIX.md))

---

## 📁 Project Structure

```
hotel-billing-app/
├── electron/           # Electron backend
│   ├── main.js        # Main process
│   ├── database.js    # SQLite operations
│   └── preload.js     # IPC bridge
├── src/               # React frontend
│   ├── pages/         # Billing & Admin pages
│   ├── components/    # Reusable components
│   ├── App.jsx        # Main app
│   └── main.jsx       # Entry point
├── database/          # SQLite database
│   └── hotel.db       # Auto-created
└── public/            # Static files
    └── food-images/   # Food item images
```

---

## 🎯 Usage

### Billing Page

1. Search for food items
2. Click items to add to cart
3. Adjust quantities with +/− buttons
4. Click "PRINT BILL" to print

### Admin Page

1. Click "Admin" button at top
2. Fill form to add new items
3. Edit/Enable/Disable/Delete existing items

---

## 🗄️ Database

**Location:** `database/hotel.db`

**Tables:**

- `items` - Food items (Tamil name, English name, price)
- `bills` - Bill records (date, total)
- `bill_items` - Bill details (items, quantities)

**Backup:** Copy `hotel.db` file to safe location regularly

---

## 🔨 Build Windows .exe

```bash
npm run build:win
```

Output: `release/Hotel Billing System Setup 1.0.0.exe`

---

## 🛠️ Scripts

| Command             | Description             |
| ------------------- | ----------------------- |
| `npm run dev`       | Run in development mode |
| `npm run build`     | Build React app         |
| `npm run build:win` | Build Windows installer |

---

## 🎨 Color Theme

- **Primary:** Green (#10B981)
- **Background:** White (#FFFFFF)
- **Text:** Dark Gray (#1F2937)

---

## 📦 Technologies

- **Electron** - Desktop application framework
- **React** - UI library
- **Vite** - Build tool
- **SQLite** - Local database
- **better-sqlite3** - SQLite for Node.js

---

## 🐛 Troubleshooting

### "npm is not recognized"

- Install Node.js and restart terminal

### "Cannot find module 'better-sqlite3'"

- Run: `npx electron-rebuild`

### Database not found

- Delete `database` folder and restart app

---

## 📝 License

Private project for hotel use.

---

## 🎉 Ready to Use!

The application is complete and ready to use. Follow the Quick Start guide above to get started!
