// creditStatementExport.js - Credit customer statement export (PDF / Excel)
// Separate from the thermal print templates in main.js: this is an A4 report for the client's own records.

const { BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ExcelJS = require('exceljs');

const SHOP_NAME = 'KM Unavagam';
const SHOP_ADDRESS = 'Bodipalaiyam Main Road, Malumichampatti, Coimbatore, TAMIL NADU, 641050';
const SHOP_PHONE = '8680031372';

// 'YYYY-MM-DD' -> 'DD/MM/YYYY'
function toDisplayDate(isoDate) {
  return isoDate.slice(0, 10).split('-').reverse().join('/');
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function itemLabel(item) {
  return item.name_tamil && item.name_tamil !== item.name_english
    ? `${item.name_english} (${item.name_tamil})`
    : item.name_english;
}

/**
 * Bills (debit) and payments (credit) in date order with a running balance
 */
function buildLedger(statement) {
  const entries = [
    ...statement.bills.map((b) => ({
      date: b.bill_date,
      sortKey: b.created_at,
      particulars: `Bill #${String(b.id).padStart(4, '0')}`,
      debit: b.total_amount,
      credit: 0,
    })),
    ...statement.payments.map((p) => ({
      date: p.date,
      // Payments sort after bills of the same day
      sortKey: `${p.date}~${String(p.id).padStart(8, '0')}`,
      particulars: 'Payment received',
      debit: 0,
      credit: p.amount,
    })),
  ].sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

  let balance = statement.openingBalance;
  for (const entry of entries) {
    balance += entry.debit - entry.credit;
    entry.balance = balance;
  }
  return entries;
}

/**
 * Default file name, e.g. Credit_Statement_Kumar_01-10-2026_to_29-10-2026
 */
function defaultFileName(statement) {
  const safeName = statement.customer.name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Customer';
  const range = `${toDisplayDate(statement.startDate)}_to_${toDisplayDate(statement.endDate)}`.replace(/\//g, '-');
  return `Credit_Statement_${safeName}_${range}`;
}

/**
 * A4 statement HTML (used for the PDF export only)
 */
function generateStatementHTML(statement) {
  const { customer, bills, dailyTotals } = statement;
  const ledger = buildLedger(statement);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 4px; }
    h1 { font-size: 20px; }
    h2 { font-size: 13px; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 2px solid #111; }
    .shop { text-align: center; margin-bottom: 12px; }
    .shop div { font-size: 10px; color: #444; }
    .title { text-align: center; font-size: 15px; font-weight: 700; letter-spacing: 1px; margin-bottom: 10px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .meta div { line-height: 1.5; }
    .summary { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .summary td { border: 1px solid #999; padding: 6px 8px; width: 25%; }
    .summary .label { font-size: 10px; color: #555; }
    .summary .value { font-size: 14px; font-weight: 700; }
    table.grid { width: 100%; border-collapse: collapse; }
    table.grid th { background: #eee; text-align: left; padding: 5px 6px; border: 1px solid #999; font-size: 10px; }
    table.grid td { padding: 4px 6px; border: 1px solid #ccc; vertical-align: top; }
    table.grid tr { page-break-inside: avoid; }
    .num { text-align: right; white-space: nowrap; }
    .total-row td { font-weight: 700; background: #f5f5f5; }
    .bill-items { color: #333; }
    .footer { margin-top: 18px; text-align: center; font-size: 9px; color: #777; }
  </style>
</head>
<body>
  <div class="shop">
    <h1>${SHOP_NAME}</h1>
    <div>${SHOP_ADDRESS}</div>
    <div>Ph: ${SHOP_PHONE}</div>
  </div>

  <div class="title">CREDIT STATEMENT</div>

  <div class="meta">
    <div>
      <b>Customer:</b> ${escapeHtml(customer.name)}<br>
      ${customer.phone ? `<b>Phone:</b> ${escapeHtml(customer.phone)}` : ''}
    </div>
    <div style="text-align:right">
      <b>Period:</b> ${toDisplayDate(statement.startDate)} to ${toDisplayDate(statement.endDate)}<br>
      <b>Generated:</b> ${new Date().toLocaleString('en-IN')}
    </div>
  </div>

  <table class="summary">
    <tr>
      <td><div class="label">Opening Balance</div><div class="value">₹${money(statement.openingBalance)}</div></td>
      <td><div class="label">Bills in Period (${bills.length})</div><div class="value">₹${money(statement.totalBilled)}</div></td>
      <td><div class="label">Payments in Period (${statement.payments.length})</div><div class="value">₹${money(statement.totalPaid)}</div></td>
      <td><div class="label">Closing Balance</div><div class="value">₹${money(statement.closingBalance)}</div></td>
    </tr>
  </table>

  <h2>Account Ledger</h2>
  <table class="grid">
    <thead>
      <tr><th>Date</th><th>Particulars</th><th class="num">Bill Amount (₹)</th><th class="num">Payment (₹)</th><th class="num">Balance (₹)</th></tr>
    </thead>
    <tbody>
      <tr><td>${toDisplayDate(statement.startDate)}</td><td>Opening Balance</td><td></td><td></td><td class="num">${money(statement.openingBalance)}</td></tr>
      ${ledger.map((e) => `
      <tr>
        <td>${toDisplayDate(e.date)}</td>
        <td>${e.particulars}</td>
        <td class="num">${e.debit ? money(e.debit) : ''}</td>
        <td class="num">${e.credit ? money(e.credit) : ''}</td>
        <td class="num">${money(e.balance)}</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="2">Closing Balance</td>
        <td class="num">${money(statement.totalBilled)}</td>
        <td class="num">${money(statement.totalPaid)}</td>
        <td class="num">${money(statement.closingBalance)}</td>
      </tr>
    </tbody>
  </table>

  <h2>Day-wise Bill Totals</h2>
  <table class="grid">
    <thead><tr><th>Date</th><th class="num">Amount (₹)</th></tr></thead>
    <tbody>
      ${dailyTotals.map((d) => `<tr><td>${toDisplayDate(d.bill_date)}</td><td class="num">${money(d.daily_total)}</td></tr>`).join('')}
      <tr class="total-row"><td>Total</td><td class="num">${money(statement.totalBilled)}</td></tr>
    </tbody>
  </table>

  <h2>Bill Details</h2>
  <table class="grid">
    <thead><tr><th>Date</th><th>Bill No</th><th>Items</th><th class="num">Amount (₹)</th></tr></thead>
    <tbody>
      ${bills.length === 0 ? '<tr><td colspan="4">No bills in this period</td></tr>' : bills.map((b) => `
      <tr>
        <td>${toDisplayDate(b.bill_date)}</td>
        <td>#${String(b.id).padStart(4, '0')}</td>
        <td class="bill-items">${b.items.map((i) => `${escapeHtml(itemLabel(i))} × ${i.quantity} @ ${money(i.rate)}`).join('<br>')}</td>
        <td class="num">${money(b.total_amount)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="footer">Software by LancingHub</div>
</body>
</html>`;
}

/**
 * Render the statement HTML in a hidden window and save it as an A4 PDF
 */
async function writeStatementPDF(statement, filePath) {
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
  const tempHtml = path.join(os.tmpdir(), `credit_statement_${Date.now()}.html`);
  try {
    fs.writeFileSync(tempHtml, generateStatementHTML(statement), 'utf8');
    await win.loadFile(tempHtml);
    const pdf = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { marginType: 'default' },
    });
    fs.writeFileSync(filePath, pdf);
  } finally {
    win.destroy();
    try { fs.unlinkSync(tempHtml); } catch (e) { /* ignore */ }
  }
}

/**
 * Widen each column to fit its longest text (never narrower than the width already set).
 * skipRows: rows whose text may spill into empty neighbours (e.g. the title row).
 */
function autoFitColumns(worksheet, skipRows = []) {
  worksheet.columns.forEach((column, idx) => {
    let longest = 0;
    worksheet.eachRow((row, rowNumber) => {
      if (skipRows.includes(rowNumber)) return;
      const value = row.getCell(idx + 1).value;
      const text = typeof value === 'number' ? value.toFixed(2) : String(value ?? '');
      longest = Math.max(longest, text.length);
    });
    column.width = Math.min(Math.max(column.width || 10, longest + 2), 60);
  });
}

/**
 * Save the statement as an .xlsx workbook: Statement (ledger), Bill Details, Daily Totals
 */
async function writeStatementExcel(statement, filePath) {
  const { customer, bills, dailyTotals } = statement;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = SHOP_NAME;
  workbook.created = new Date();

  const moneyFormat = '#,##0.00';
  const headerStyle = (row) => {
    row.font = { bold: true };
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
      cell.border = { bottom: { style: 'thin' } };
    });
  };

  // Sheet 1: Statement (ledger with running balance)
  const sheet = workbook.addWorksheet('Statement');
  // Column A holds both dates and the summary labels ("Payments in Period (12)"), so it needs room for the labels
  sheet.columns = [{ width: 26 }, { width: 26 }, { width: 18 }, { width: 16 }, { width: 16 }];
  sheet.addRow([`${SHOP_NAME} - Credit Statement`]).font = { bold: true, size: 14 };
  sheet.addRow(['Customer', customer.name]);
  if (customer.phone) sheet.addRow(['Phone', customer.phone]);
  sheet.addRow(['Period', `${toDisplayDate(statement.startDate)} to ${toDisplayDate(statement.endDate)}`]);
  sheet.addRow([]);
  const summaryRows = [
    ['Opening Balance', statement.openingBalance],
    [`Bills in Period (${bills.length})`, statement.totalBilled],
    [`Payments in Period (${statement.payments.length})`, statement.totalPaid],
    ['Closing Balance', statement.closingBalance],
  ];
  for (const [label, value] of summaryRows) {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).numFmt = moneyFormat;
  }
  sheet.addRow([]);
  headerStyle(sheet.addRow(['Date', 'Particulars', 'Bill Amount (₹)', 'Payment (₹)', 'Balance (₹)']));
  sheet.addRow([toDisplayDate(statement.startDate), 'Opening Balance', null, null, statement.openingBalance]);
  for (const e of buildLedger(statement)) {
    sheet.addRow([toDisplayDate(e.date), e.particulars, e.debit || null, e.credit || null, e.balance]);
  }
  const closing = sheet.addRow(['', 'Closing Balance', statement.totalBilled, statement.totalPaid, statement.closingBalance]);
  closing.font = { bold: true };
  sheet.getColumn(3).numFmt = moneyFormat;
  sheet.getColumn(4).numFmt = moneyFormat;
  sheet.getColumn(5).numFmt = moneyFormat;

  // Sheet 2: Bill Details (one row per item)
  const detail = workbook.addWorksheet('Bill Details');
  detail.columns = [
    { header: 'Date', width: 14 },
    { header: 'Bill No', width: 10 },
    { header: 'Item', width: 24 },
    { header: 'Item (Tamil)', width: 20 },
    { header: 'Qty', width: 8 },
    { header: 'Rate (₹)', width: 12, style: { numFmt: moneyFormat } },
    { header: 'Amount (₹)', width: 14, style: { numFmt: moneyFormat } },
    { header: 'Bill Total (₹)', width: 14, style: { numFmt: moneyFormat } },
  ];
  headerStyle(detail.getRow(1));
  for (const b of bills) {
    b.items.forEach((item, idx) => {
      detail.addRow([
        toDisplayDate(b.bill_date),
        `#${String(b.id).padStart(4, '0')}`,
        item.name_english,
        item.name_tamil || '',
        item.quantity,
        item.rate,
        item.rate * item.quantity,
        idx === 0 ? b.total_amount : null,
      ]);
    });
  }

  // Sheet 3: Daily Totals (same figures as the printed summary slip)
  const daily = workbook.addWorksheet('Daily Totals');
  daily.columns = [
    { header: 'Date', width: 14 },
    { header: 'Amount (₹)', width: 16, style: { numFmt: moneyFormat } },
  ];
  headerStyle(daily.getRow(1));
  for (const d of dailyTotals) {
    daily.addRow([toDisplayDate(d.bill_date), d.daily_total]);
  }
  daily.addRow(['Total', statement.totalBilled]).font = { bold: true };

  autoFitColumns(sheet, [1]);
  autoFitColumns(detail);
  autoFitColumns(daily);

  await workbook.xlsx.writeFile(filePath);
}

module.exports = {
  defaultFileName,
  generateStatementHTML,
  writeStatementPDF,
  writeStatementExcel,
};
