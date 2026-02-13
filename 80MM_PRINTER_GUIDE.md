# 🖨️ OPTIONAL: 80mm THERMAL PRINTER CONFIGURATION

## 📐 80mm vs 58mm Comparison

| Specification | 58mm Printer | 80mm Printer |
|---------------|--------------|--------------|
| **Physical Width** | 58mm | 80mm |
| **Pixel Width (96 DPI)** | ~220px | ~302px |
| **Printable Area** | ~48mm | ~70mm |
| **Safe Content Width** | 210px | 292px |
| **Use Case** | Compact receipts | Detailed receipts |

---

## 🔧 HOW TO ADD 80mm SUPPORT

### Option 1: Replace Current (58mm → 80mm)

If you want to **switch entirely** to 80mm, modify `electron/main.js`:

```javascript
function generateBillHTML(billData) {
  // ... existing code ...
  
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
        
        /* ========== BODY - 80MM THERMAL PRINTER ========== */
        body {
          /* 80mm = ~302px at 96 DPI */
          width: 302px;
          max-width: 302px;
          margin: 0 auto;
          padding: 5px;
          
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          line-height: 1.4;
          
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
            size: 80mm auto;  /* ← Changed from 58mm */
          }
          
          body {
            margin: 0;
            padding: 5px;
            width: 302px;  /* ← Changed from 220px */
            max-width: 302px;
          }
          
          .header, .bill-info, .table, .summary, .total-section, .payment-info, .footer {
            page-break-inside: avoid;
          }
        }
        
        /* ... rest of styles ... */
        
        /* ========== TABLE - FIXED LAYOUT ========== */
        .table {
          width: 100%;
          max-width: 292px;  /* ← Changed from 210px */
          border-collapse: collapse;
          margin: 5px 0;
          table-layout: fixed;
        }
        
        /* Column widths - ADJUSTED for 80mm */
        .table th.item,
        .table td.item {
          width: 150px;  /* ← Changed from 100px */
          text-align: left;
          overflow-wrap: break-word;
          word-wrap: break-word;
        }
        
        .table th.qty,
        .table td.qty {
          width: 40px;  /* ← Changed from 30px */
          text-align: center;
        }
        
        .table th.rate,
        .table td.rate {
          width: 50px;  /* ← Changed from 40px */
          text-align: right;
        }
        
        .table th.total,
        .table td.total {
          width: 52px;  /* ← Changed from 40px */
          text-align: right;
        }
        
        /* Total: 150 + 40 + 50 + 52 = 292px ✅ */
      </style>
    </head>
    <body>
      <!-- Same HTML structure -->
    </body>
    </html>
  `;
}
```

---

### Option 2: Dual Support (Both 58mm and 80mm)

If you want to **support both** printer sizes, create separate functions:

#### Step 1: Add Configuration

In `electron/main.js`, add at the top:

```javascript
// Printer configuration
const PRINTER_CONFIG = {
  type: '58mm', // Change to '80mm' for 80mm printer
  widths: {
    '58mm': {
      body: 220,
      content: 210,
      columns: { item: 100, qty: 30, rate: 40, total: 40 }
    },
    '80mm': {
      body: 302,
      content: 292,
      columns: { item: 150, qty: 40, rate: 50, total: 52 }
    }
  }
};
```

#### Step 2: Create Dynamic Function

```javascript
function generateBillHTML(billData) {
  const config = PRINTER_CONFIG.widths[PRINTER_CONFIG.type];
  const { billNumber, items, total, hotelName, address, fssai, license, phone, email, dateTime } = billData;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          width: ${config.body}px;
          max-width: ${config.body}px;
          margin: 0 auto;
          padding: 5px;
          
          font-family: 'Courier New', Courier, monospace;
          font-size: ${PRINTER_CONFIG.type === '58mm' ? '10px' : '11px'};
          line-height: 1.4;
          
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
            size: ${PRINTER_CONFIG.type} auto;
          }
          
          body {
            margin: 0;
            padding: 5px;
            width: ${config.body}px;
            max-width: ${config.body}px;
          }
        }
        
        /* ... other styles ... */
        
        .table {
          width: 100%;
          max-width: ${config.content}px;
          border-collapse: collapse;
          margin: 5px 0;
          table-layout: fixed;
        }
        
        .table th.item,
        .table td.item {
          width: ${config.columns.item}px;
          text-align: left;
          overflow-wrap: break-word;
          word-wrap: break-word;
        }
        
        .table th.qty,
        .table td.qty {
          width: ${config.columns.qty}px;
          text-align: center;
        }
        
        .table th.rate,
        .table td.rate {
          width: ${config.columns.rate}px;
          text-align: right;
        }
        
        .table th.total,
        .table td.total {
          width: ${config.columns.total}px;
          text-align: right;
        }
      </style>
    </head>
    <body>
      <!-- Same HTML structure -->
    </body>
    </html>
  `;
}
```

#### Step 3: Switch Printer Type

To switch between 58mm and 80mm, just change:

```javascript
const PRINTER_CONFIG = {
  type: '80mm', // ← Change this line
  // ...
};
```

---

### Option 3: User-Selectable Printer Size

Add a settings page where users can choose printer size:

#### Step 1: Add IPC Handler

In `electron/main.js`:

```javascript
// Store printer preference
let printerSize = '58mm'; // Default

ipcMain.handle('settings:setPrinterSize', async (event, size) => {
  if (size === '58mm' || size === '80mm') {
    printerSize = size;
    return { success: true };
  }
  return { success: false, error: 'Invalid printer size' };
});

ipcMain.handle('settings:getPrinterSize', async () => {
  return printerSize;
});
```

#### Step 2: Update generateBillHTML

```javascript
function generateBillHTML(billData) {
  const config = PRINTER_CONFIG.widths[printerSize]; // Use stored preference
  // ... rest of code
}
```

#### Step 3: Add Settings UI

In your React app, add a settings page:

```jsx
function SettingsPage() {
  const [printerSize, setPrinterSize] = useState('58mm');

  useEffect(() => {
    window.electronAPI.getPrinterSize().then(setPrinterSize);
  }, []);

  const handleSizeChange = async (size) => {
    const result = await window.electronAPI.setPrinterSize(size);
    if (result.success) {
      setPrinterSize(size);
      alert('Printer size updated!');
    }
  };

  return (
    <div>
      <h2>Printer Settings</h2>
      <label>
        <input
          type="radio"
          value="58mm"
          checked={printerSize === '58mm'}
          onChange={(e) => handleSizeChange(e.target.value)}
        />
        58mm Thermal Printer
      </label>
      <label>
        <input
          type="radio"
          value="80mm"
          checked={printerSize === '80mm'}
          onChange={(e) => handleSizeChange(e.target.value)}
        />
        80mm Thermal Printer
      </label>
    </div>
  );
}
```

---

## 📏 COLUMN WIDTH CALCULATIONS

### 58mm Printer
```
Total width: 220px
Padding: 5px × 2 = 10px
Content: 210px

Columns:
- Item: 100px (47.6%)
- Qty:   30px (14.3%)
- Rate:  40px (19.0%)
- Total: 40px (19.0%)
─────────────────────
Total:  210px (100%)
```

### 80mm Printer
```
Total width: 302px
Padding: 5px × 2 = 10px
Content: 292px

Columns:
- Item: 150px (51.4%)
- Qty:   40px (13.7%)
- Rate:  50px (17.1%)
- Total: 52px (17.8%)
─────────────────────
Total:  292px (100%)
```

---

## 🎨 VISUAL COMPARISON

### 58mm Receipt
```
┌──────────────────────┐
│   KM UNAVAGAM       │
│ ─────────────────── │
│ Item   Qty Rate Amt │
│ இட்லி   2   20  40 │
│ Dosa    1   30  30 │
│ ─────────────────── │
│ TOTAL          ₹70 │
└──────────────────────┘
     Compact, fits
     small printers
```

### 80mm Receipt
```
┌────────────────────────────────┐
│       KM UNAVAGAM             │
│ ───────────────────────────── │
│ Item Name      Qty  Rate  Amt │
│ சாம்பார் இட்லி   2    20   40│
│ Masala Dosa     1    30   30│
│ ───────────────────────────── │
│ TOTAL                     ₹70│
└────────────────────────────────┘
       More space for details
```

---

## ✅ WHEN TO USE EACH SIZE

### Use 58mm When:
- ✅ Space is limited
- ✅ Cost-effective printing
- ✅ Simple receipts
- ✅ Mobile/portable printers
- ✅ Quick service restaurants

### Use 80mm When:
- ✅ More detailed receipts
- ✅ Long item names
- ✅ Multiple columns needed
- ✅ Logos/graphics
- ✅ Full-service restaurants

---

## 🧪 TESTING BOTH SIZES

### Test 58mm
```javascript
const PRINTER_CONFIG = {
  type: '58mm',
  // ...
};
```

1. Print test bill
2. Verify no overflow
3. Check alignment

### Test 80mm
```javascript
const PRINTER_CONFIG = {
  type: '80mm',
  // ...
};
```

1. Print test bill
2. Verify proper spacing
3. Check alignment

---

## 📝 QUICK SWITCH GUIDE

To switch from 58mm to 80mm:

1. **Find** `width: 220px` → **Replace** with `width: 302px`
2. **Find** `max-width: 220px` → **Replace** with `max-width: 302px`
3. **Find** `size: 58mm auto` → **Replace** with `size: 80mm auto`
4. **Find** `max-width: 210px` → **Replace** with `max-width: 292px`
5. **Update column widths:**
   - `item: 100px` → `item: 150px`
   - `qty: 30px` → `qty: 40px`
   - `rate: 40px` → `rate: 50px`
   - `total: 40px` → `total: 52px`

---

## 🚀 RECOMMENDED APPROACH

For most users: **Stick with 58mm** (current implementation)

If you need 80mm:
1. **Option 1** (Simple): Replace all widths manually
2. **Option 2** (Flexible): Use configuration object
3. **Option 3** (Best UX): Add user settings

---

**Current Implementation:** 58mm ✅
**80mm Support:** Optional (follow guide above)
**Date:** 2026-02-13
