// verify-build-app.js - run by verify-build.js inside Electron.
// Loads the PACKAGED app code from app.asar on a temporary data folder and exercises the main flows.
// usage: electron verify-build-app.js <path to app.asar> <temporary userData folder>
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const [asarPath, userData] = process.argv.slice(-2);
const report = (ok, msg) => console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);

// Safety: the data folder must be the temporary one before any app code runs
app.setPath('userData', userData);
if (path.resolve(app.getPath('userData')) !== path.resolve(userData) || /AppData[\\/]Roaming/i.test(app.getPath('userData'))) {
  report(false, `refusing to run: data folder is not the temporary one (${app.getPath('userData')})`);
  process.exit(1);
}

app.on('window-all-closed', () => {});
// Only the app's main window: the PDF export opens its own hidden window, which must be left alone
let mainWindowSeen = false;
app.on('browser-window-created', (_, win) => {
  if (mainWindowSeen) return;
  mainWindowSeen = true;
  win.webContents.once('did-finish-load', async () => {
    const js = (code) => win.webContents.executeJavaScript(code);
    try {
      let home = false;
      for (let i = 0; i < 40 && !home; i++) {
        home = await js(`!!document.querySelector('.home-btn-staff, .pending-wages-overlay')`);
        if (!home) await new Promise((r) => setTimeout(r, 250));
      }
      report(home, 'home screen loads');

      const electronDir = path.join(asarPath, 'electron');
      const db = require(path.join(electronDir, 'database.js'));
      const item = db.getAllItems()[0];
      report(Boolean(item), 'menu items load');

      const today = new Date().toISOString().slice(0, 10);
      const cashBill = db.saveBill([{ id: item.id, quantity: 2, price: item.price }], item.price * 2, null, null, today);
      report(Boolean(cashBill), `cash bill saved (#${cashBill})`);

      const customerId = db.addCreditCustomer('Verify Customer', '');
      db.saveBill([{ id: item.id, quantity: 1, price: item.price }], item.price, customerId, null, today);
      db.addCreditPayment(customerId, item.price, today);
      const customer = db.getCreditCustomerDetails(customerId);
      report(customer && customer.balance === 0, 'credit bill + payment recorded (balance 0)');

      const exporter = require(path.join(electronDir, 'creditStatementExport.js'));
      const statement = db.getCreditStatement(customerId, '2000-01-01', '2099-12-31');
      const xlsx = path.join(userData, 'verify.xlsx');
      const pdf = path.join(userData, 'verify.pdf');
      await exporter.writeStatementExcel(statement, xlsx);
      report(fs.existsSync(xlsx) && fs.statSync(xlsx).size > 1000, 'Excel statement exported');
      await exporter.writeStatementPDF(statement, pdf);
      report(fs.existsSync(pdf) && fs.statSync(pdf).size > 1000, 'PDF statement exported');
    } catch (error) {
      report(false, `error: ${error.stack || error.message}`);
    }
    app.exit(0);
  });
});

// Start the packaged main process code (creates the window and opens the database)
require(path.join(asarPath, 'electron', 'main.js'));
