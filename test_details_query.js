const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'hotel.db');

try {
    const db = new Database(dbPath);

    console.log('--- CREDIT CUSTOMERS ---');
    const customers = db.prepare("SELECT id, name FROM credit_customers").all();
    console.table(customers);

    console.log('\n--- CREDIT BILLS ---');
    const creditBills = db.prepare("SELECT * FROM credit_bills").all();
    console.table(creditBills);

    console.log('\n--- TESTING QUERY FOR CUSTOMER 1 ---');
    const customerId = 1; // Assuming 1 exists
    const bills = db.prepare(`
    SELECT b.id, b.total_amount 
    FROM bills b 
    JOIN credit_bills cb ON b.id = cb.bill_id 
    WHERE cb.customer_id = ?
  `).all(customerId);
    console.log(`Bills for customer ${customerId}:`, bills.length);
    console.table(bills);

} catch (err) {
    console.error('Error:', err.message);
}
