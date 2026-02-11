import { useState, useEffect } from 'react';
import './PrintPreviewPage.css';

/**
 * PRINT PREVIEW PAGE
 * Shows side-by-side preview of Customer Bill and KOT
 * Handles silent printing via Electron
 */
function PrintPreviewPage({ onNavigate, billData }) {
    const [isPrinting, setIsPrinting] = useState(false);

    if (!billData) {
        return (
            <div className="preview-error">
                <h2>No Bill Data Found</h2>
                <button onClick={() => onNavigate('billing')}>Back to Billing</button>
            </div>
        );
    }

    const { items, total, dateTime, customerName, billNumber } = billData;

    /**
     * Handle Print Bill Only
     */
    const handlePrintBill = async () => {
        setIsPrinting(true);
        try {
            // 1. Save to database (only official bill)
            const id = await window.electronAPI.saveBill(
                items,
                total,
                billData.creditCustomerId || null
            );

            // 2. Update bill number with real ID from DB
            const finalBillData = {
                ...billData,
                billNumber: id.toString().padStart(4, '0')
            };

            // 3. Print silently
            await window.electronAPI.printSilent(finalBillData, 'BILL');

            // 4. Navigate back
            alert('Bill Printed Successfully!');
            onNavigate(billData.creditCustomerId ? 'credits' : 'billing');
        } catch (error) {
            console.error('Print Error:', error);
            alert('Printing Failed: ' + error.message);
        } finally {
            setIsPrinting(false);
        }
    };

    /**
     * Handle Print KOT + Bill
     */
    const handlePrintKOTAndBill = async () => {
        setIsPrinting(true);
        try {
            // 1. Save to database (only official bill)
            const id = await window.electronAPI.saveBill(
                items,
                total,
                billData.creditCustomerId || null
            );

            // 2. Update bill number
            const finalBillData = {
                ...billData,
                billNumber: id.toString().padStart(4, '0')
            };

            // 3. Print KOT silently (KOT is not saved in DB)
            await window.electronAPI.printSilent(finalBillData, 'KOT');

            // 4. Print Bill silently
            await window.electronAPI.printSilent(finalBillData, 'BILL');

            alert('KOT & Bill Printed Successfully!');
            onNavigate(billData.creditCustomerId ? 'credits' : 'billing');
        } catch (error) {
            console.error('Print Error:', error);
            alert('Printing Failed: ' + error.message);
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <div className="preview-page">
            <div className="preview-header">
                <h1>🖨️ Print Preview</h1>
                <div className="header-actions">
                    <button className="cancel-btn" onClick={() => onNavigate('billing')} disabled={isPrinting}>
                        CANCEL
                    </button>
                </div>
            </div>

            <div className="previews-container">
                {/* Customer Bill Preview */}
                <div className="preview-box">
                    <h3 className="preview-label">CUSTOMER BILL PREVIEW</h3>
                    <div className="bill-paper customer-bill">
                        <div className="bill-center bold logo-text">KM UNAVAGAM</div>
                        <div className="bill-center x-small">Bodipalaiyam Main Road, Malumichampatti</div>
                        <div className="bill-divider"></div>
                        <div className="bill-info-row">
                            <span>Date: {dateTime}</span>
                            <span>No: {billNumber || 'PEND'}</span>
                        </div>
                        <div className="bill-info-row">
                            <span>To: {customerName || 'Cash Sale'}</span>
                        </div>
                        <table className="bill-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th className="right">Qty</th>
                                    <th className="right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>{item.name_tamil || item.name_english}</td>
                                        <td className="right">{item.quantity}</td>
                                        <td className="right">{(item.price * item.quantity).toFixed(0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="bill-divider"></div>
                        <div className="bill-total-row">
                            <span>TOTAL</span>
                            <span>₹{total.toFixed(0)}</span>
                        </div>
                        <div className="bill-center footer-text mt-10">Thank You! Visit Again!</div>
                    </div>
                </div>

                {/* KOT Preview */}
                <div className="preview-box">
                    <h3 className="preview-label">KOT PREVIEW (STAFF ONLY)</h3>
                    <div className="bill-paper kot-bill">
                        <div className="bill-center bold KOT-text">KOT - PARCEL</div>
                        <div className="bill-center">Date: {dateTime}</div>
                        <div className="bill-divider"></div>
                        <table className="bill-table">
                            <thead>
                                <tr>
                                    <th>ITEM NAME</th>
                                    <th className="right">QTY</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="bold">{item.name_tamil || item.name_english}</td>
                                        <td className="right bold">{item.quantity}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="bill-divider"></div>
                        <div className="bill-center bold footer-text">KITCHEN COPY</div>
                    </div>
                </div>
            </div>

            <div className="preview-footer-actions">
                <button
                    className="action-btn bill-only"
                    onClick={handlePrintBill}
                    disabled={isPrinting}
                >
                    {isPrinting ? 'Printing...' : 'PRINT BILL ONLY'}
                </button>
                <button
                    className="action-btn kot-bill-combo"
                    onClick={handlePrintKOTAndBill}
                    disabled={isPrinting}
                >
                    {isPrinting ? 'Printing...' : 'PRINT KOT + BILL'}
                </button>
            </div>
        </div>
    );
}

export default PrintPreviewPage;
