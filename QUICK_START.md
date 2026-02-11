# 🚀 QUICK START GUIDE

## How to Run the App

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Start the app
npm run electron
```

---

## 📱 App Flow

```
HOME PAGE
   ├── New Bill → BILLING PAGE → Print bills
   ├── Records → RECORDS PAGE → View sales/expenses/profit
   ├── Expenses → EXPENSES PAGE → Add daily expenses
   └── Admin → ADMIN PAGE → Manage food items
```

---

## 💰 Daily Usage

### Morning - Start Taking Orders
1. Open app → Click "New Bill"
2. Add items to cart
3. Print bill
4. Repeat for each customer

### During Day - Track Expenses
1. Open app → Click "Expenses"
2. Enter what you bought (e.g., "Gas")
3. Enter amount (e.g., "500")
4. Click "Add Expense"

### Evening - Check Profit
1. Open app → Click "Records"
2. Click "Today" filter
3. See:
   - Total Sales (from bills)
   - Total Expenses (from expenses you added)
   - Profit (Sales - Expenses)

---

## 📊 Understanding the Records Page

### Summary Cards (Top)
- **Green Card** = Total Sales
- **Orange Card** = Total Expenses  
- **Blue Card** = Total Profit

### Table (Below)
- Each row = One day
- Click any row to see details

### Filters
- **Today** = Only today
- **This Week** = Last 7 days
- **This Month** = Current month
- **Custom Range** = Choose your own dates

---

## 🔑 Key Points

1. **Bills are saved automatically** when you print
2. **Expenses must be added manually** using Expenses page
3. **Profit is calculated automatically** (Sales - Expenses)
4. **All data is stored offline** in SQLite database
5. **No internet needed** - everything works offline

---

## 📁 Database Location

**Development:**
```
d:\ProjectsD\KMUnavagam\database\hotel.db
```

**Production (after building):**
```
C:\Users\[YourName]\AppData\Roaming\km-unavagam\database\hotel.db
```

---

## 🎯 Common Tasks

### Add a new food item
Home → Admin → Fill form → Add Item

### Change food item price
Home → Admin → Click "Edit" on item → Update price → Update Item

### Disable a food item (don't delete)
Home → Admin → Click "Disable" on item

### View yesterday's sales
Home → Records → This Week → Click on yesterday's row

### See all bills from a specific day
Home → Records → Select date range → Click on the day

---

## 🐛 Quick Fixes

### App won't start
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
npm run electron
```

### Database errors
- Close app completely
- Restart app
- Database will reinitialize

### Changes not showing
- Close app
- Restart app
- Changes should appear

---

## 📞 Support

If you need help:
1. Check `NEW_FEATURES_GUIDE.md` for detailed explanations
2. Check browser console for errors (F12)
3. Restart the app

---

**Last Updated: February 11, 2026**
