# 🧪 THERMAL RECEIPT TESTING GUIDE

## QUICK TEST CHECKLIST

### ✅ Before Printing (Chrome DevTools)

1. **Open Print Preview Window**
   - Create a bill in the app
   - Click "Print Bill" button

2. **Enable Print Mode in DevTools**
   - Press `F12`
   - Click `⋮` (three dots) → More tools → Rendering
   - Check "Emulate CSS media type" → Select "print"

3. **Verify Alignment**
   - Receipt width should be ~220px
   - No horizontal scrollbar
   - All text visible
   - Columns aligned properly

### ✅ Print Preview Test

1. **Open Print Dialog**
   - Press `Ctrl + P` in preview window

2. **Configure Settings**
   - Destination: "Save as PDF" (for testing)
   - Paper size: Custom → 58mm width
   - Margins: None
   - Scale: 100%

3. **Check PDF Output**
   - Text within paper bounds
   - Tamil text wraps correctly
   - Columns aligned

### ✅ Real Printer Test

1. **Print Test Bill**
   - Use actual thermal printer
   - Print a bill with Tamil items

2. **Verify Output**
   - No text overflow
   - Columns aligned
   - Tamil text readable
   - No cut-off text

---

## 🔍 WHAT TO LOOK FOR

### ✅ GOOD (Fixed)
```
┌──────────────────────┐
│ KM UNAVAGAM         │
│ Bill No: 0001       │
│ ──────────────────  │
│ Item    Qty  Rate   │
│ இட்லி    2    20   │
│ Dosa     1    30   │
│ ──────────────────  │
│ TOTAL        ₹50    │
└──────────────────────┘
```

### ❌ BAD (Before Fix)
```
┌──────────────────────┐
│ KM UNAVAGAM         │
│ Bill No: 0001       │
│ ──────────────────  │
│ Item Name    Qty  Ra│te  Total
│ இட்லி         2    20│     40
│ Dosa          1    30│     30
│ ──────────────────  │
│ Total              ₹│50
└──────────────────────┘
     ↑ Text overflows here!
```

---

## 📐 MEASUREMENTS

### 58mm Printer
- Body width: 220px
- Content width: 210px (with 5px padding)
- Table columns:
  - Item: 100px
  - Qty: 30px
  - Rate: 40px
  - Amt: 40px
  - **Total: 210px** ✅

### 80mm Printer (Optional)
- Body width: 302px
- Content width: 292px
- Adjust column widths proportionally

---

## 🐛 TROUBLESHOOTING

### Problem: Text still overflows
**Solution:** Check printer settings
- Ensure paper size is set to 58mm
- Check printer driver settings
- Verify no scaling is applied

### Problem: Tamil text breaks incorrectly
**Solution:** Font issue
- Ensure monospace font is used
- Check if printer supports Unicode
- May need to adjust word-break settings

### Problem: Columns misaligned
**Solution:** Table layout
- Verify `table-layout: fixed` is applied
- Check column widths add up to 210px
- Ensure no extra padding/margins

### Problem: Preview looks good but print is wrong
**Solution:** Browser margins
- Check @media print rules are applied
- Verify @page margin: 0
- Test with different browser

---

## 🎯 TESTING SCENARIOS

### Test Case 1: Short Item Names
```
Items:
- Idli (2x)
- Dosa (1x)
```
**Expected:** All columns aligned, no overflow

### Test Case 2: Long Tamil Names
```
Items:
- சாம்பார் இட்லி (2x)
- மசாலா தோசை (1x)
```
**Expected:** Tamil text wraps within item column

### Test Case 3: Mixed Tamil + English
```
Items:
- Idli (2x)
- சாம்பார் வடை (1x)
- Masala Dosa (1x)
```
**Expected:** Both languages render correctly

### Test Case 4: Many Items
```
Items: 10+ different items
```
**Expected:** All items fit, no overflow, columns aligned

---

## 📋 FINAL CHECKLIST

Before deploying to production:

- [ ] Tested in Chrome DevTools (print mode)
- [ ] Tested print preview (Ctrl + P)
- [ ] Tested on real 58mm thermal printer
- [ ] Verified Tamil text alignment
- [ ] Verified English text alignment
- [ ] Verified column alignment
- [ ] Tested with long item names
- [ ] Tested with many items (10+)
- [ ] No horizontal overflow
- [ ] No text cut-off
- [ ] Receipt stays within 58mm width

---

## 🚀 DEPLOYMENT

Once all tests pass:

1. Commit changes to git
2. Test on production environment
3. Print test bills with real data
4. Monitor for any issues
5. Keep backup of old version

---

## 📞 SUPPORT

If issues persist:
1. Check `THERMAL_RECEIPT_FIX.md` for detailed explanation
2. Verify printer driver settings
3. Test with different thermal printer
4. Check Windows print settings

---

**Last Updated:** 2026-02-13
**Version:** 1.0 (58mm optimized)
