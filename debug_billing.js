const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'hotel.db');

try {
    const db = new Database(dbPath);

    console.log('--- CUSTOMERS ---');
    const customers = db.prepare("SELECT * FROM credit_customers").all();
    console.table(customers);

    console.log('\n--- BILLS (last 10) ---');
    const bills = db.prepare("SELECT * FROM bills ORDER BY id DESC LIMIT 10").all();
    console.table(bills);

    console.log('\n--- CREDIT BILLS ---');
    const creditBills = db.prepare("SELECT * FROM credit_bills").all();
    console.table(creditBills);

    console.log('\n--- DAILY RECORDS (Today) ---');
    const today = new Date().toISOString().split('T')[0];
    const daily = db.prepare(`
    SELECT 
      DATE(b.created_at) as date,
      COUNT(b.id) as count,
      SUM(CASE WHEN cb.customer_id IS NOT NULL THEN b.total_amount ELSE 0 END) as credit_sum,
      SUM(CASE WHEN cb.customer_id IS NULL THEN b.total_amount ELSE 0 END) as cash_sum
    FROM bills b
    LEFT JOIN credit_bills cb ON b.id = cb.bill_id
    WHERE DATE(b.created_at) = ?
    GROUP BY DATE(b.created_at)
  `).all(today);
    console.table(daily);

} catch (err) {
    console.error('Error:', err.message);
}
