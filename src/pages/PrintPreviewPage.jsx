import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Toast from '../components/Toast';
import {
    PRINT_LANGUAGES,
    PRINT_LANGUAGE_SETTING_KEY,
    DEFAULT_PRINT_LANGUAGE,
    getItemPrintName,
} from '../utils/itemLanguage';
import './PrintPreviewPage.css';

/**
 * PRINT PREVIEW PAGE
 * Shows side-by-side preview of Customer Bill and KOT
 * Handles silent printing via Electron
 */
function PrintPreviewPage({ onNavigate, billData }) {
    const [isPrinting, setIsPrinting] = useState(false);
    const [toast, setToast] = useState(null);
    const [previewBillNumber, setPreviewBillNumber] = useState(billData?.billNumber);

    useEffect(() => {
        const fetchNextId = async () => {
            if (billData?.billNumber === 'PENDING') {
                try {
                    const nextId = await window.electronAPI.getNextBillId();
                    setPreviewBillNumber(nextId.toString().padStart(4, '0'));
                } catch (err) {
                    console.error('Error fetching next bill ID:', err);
                }
            } else {
                setPreviewBillNumber(billData?.billNumber);
            }
        };
        fetchNextId();
    }, [billData]);

    if (!billData) {
        return (
            <div className="preview-error">
                <h2>No Bill Data Found</h2>
                <button onClick={() => onNavigate('billing')}>Back to Billing</button>
            </div>
        );
    }

    const { items, total, dateTime, customerName, supplierName } = billData;

    /**
     * Handle Print Bill Only
     */
    const handlePrintBill = async () => {
        setIsPrinting(true);
        try {
            let finalBillId;

            // Check if editing existing bill or creating new one
            if (billData.editMode && billData.originalBillId) {
                // UPDATE existing bill
                await window.electronAPI.updateBill(
                    billData.originalBillId,
                    items,
                    total,
                    billData.supplierId || null,
                    billData.billDate || null
                );
                finalBillId = billData.originalBillId;
            } else {
                // CREATE new bill
                finalBillId = await window.electronAPI.saveBill(
                    items,
                    total,
                    billData.creditCustomerId || null,
                    billData.supplierId || null,
                    billData.billDate || null
                );
            }

            // Update bill number with real ID
            const finalBillData = {
                ...billData,
                billNumber: finalBillId.toString().padStart(4, '0')
            };

            // Print silently
            await window.electronAPI.printSilent(finalBillData, 'BILL');

            // Navigate back
            const successMsg = billData.editMode ? 'Bill Updated & Reprinted!' : 'Bill Printed Successfully!';
            setToast({ message: successMsg, type: 'success' });
            setTimeout(() => {
                if (billData.editMode) {
                    onNavigate('records');
                } else if (billData.creditCustomerId) {
                    // Return to credit details for that specific customer
                    onNavigate('credit-details', billData.creditCustomerId);
                } else {
                    onNavigate('billing');
                }
            }, 1000);
        } catch (error) {
            console.error('Print Error:', error);
            setToast({ message: 'Printing Failed: ' + error.message, type: 'error' });
        } finally {
            setIsPrinting(false);
        }
    };

    /**
     * Handle Print KOT Only
     */
    const handlePrintKOTOnly = async () => {
        setIsPrinting(true);
        try {
            let finalBillId;

            // Check if editing existing bill or creating new one
            if (billData.editMode && billData.originalBillId) {
                // UPDATE existing bill
                await window.electronAPI.updateBill(
                    billData.originalBillId,
                    items,
                    total,
                    billData.supplierId || null,
                    billData.billDate || null
                );
                finalBillId = billData.originalBillId;
            } else {
                // CREATE new bill
                finalBillId = await window.electronAPI.saveBill(
                    items,
                    total,
                    billData.creditCustomerId || null,
                    billData.supplierId || null,
                    billData.billDate || null
                );
            }

            // Update bill number
            const finalBillData = {
                ...billData,
                billNumber: billId.toString().padStart(4, '0'),
                printLanguage
            };

            // Print KOT silently
            await window.electronAPI.printSilent(finalBillData, 'KOT');

            const successMsg = billData.editMode ? 'Bill Updated & KOT Reprinted!' : 'KOT Printed Successfully!';
            setToast({ message: successMsg, type: 'success' });
            setTimeout(() => {
                if (billData.editMode) {
                    onNavigate('records');
                } else if (billData.creditCustomerId) {
                    onNavigate('credit-details', billData.creditCustomerId);
                } else {
                    onNavigate('billing');
                }
            }, 1000);
        } catch (error) {
            console.error('Print Error:', error);
            setToast({ message: 'KOT Printing Failed: ' + error.message, type: 'error' });
        } finally {
            setIsPrinting(false);
        }
    };

    /**
     * Handle Print KOT + Bill
     */
    /**
     * Handle Save Bill Only (No Printing)
     */
    const handleSaveBillOnly = async () => {
        setIsPrinting(true);
        try {
            let finalBillId;

            // Check if editing existing bill or creating new one
            if (billData.editMode && billData.originalBillId) {
                // UPDATE existing bill
                await window.electronAPI.updateBill(
                    billData.originalBillId,
                    items,
                    total,
                    billData.supplierId || null,
                    billData.billDate || null
                );
                finalBillId = billData.originalBillId;
            } else {
                // CREATE new bill
                finalBillId = await window.electronAPI.saveBill(
                    items,
                    total,
                    billData.creditCustomerId || null,
                    billData.supplierId || null,
                    billData.billDate || null
                );
            }

            // Navigate back
            const successMsg = billData.editMode ? 'Bill Updated Successfully!' : 'Bill Saved Successfully!';
            setToast({ message: successMsg, type: 'success' });
            setTimeout(() => {
                if (billData.editMode) {
                    onNavigate('records');
                } else if (billData.creditCustomerId) {
                    // Return to credit details for that specific customer
                    onNavigate('credit-details', billData.creditCustomerId);
                } else {
                    onNavigate('billing');
                }
            }, 1500);
        } catch (error) {
            console.error('Save Error:', error);
            setToast({ message: 'Saving Failed: ' + error.message, type: 'error' });
        } finally {
            setIsPrinting(false);
        }
    };

    const handlePrintKOTAndBill = async () => {
        setIsPrinting(true);
        try {
            let finalBillId;

            // Check if editing existing bill or creating new one
            if (billData.editMode && billData.originalBillId) {
                // UPDATE existing bill
                await window.electronAPI.updateBill(
                    billData.originalBillId,
                    items,
                    total,
                    billData.supplierId || null,
                    billData.billDate || null
                );
                finalBillId = billData.originalBillId;
            } else {
                // CREATE new bill
                finalBillId = await window.electronAPI.saveBill(
                    items,
                    total,
                    billData.creditCustomerId || null,
                    billData.supplierId || null,
                    billData.billDate || null
                );
            }

            // Update bill number
            const finalBillData = {
                ...billData,
                billNumber: finalBillId.toString().padStart(4, '0')
            };

            // Print KOT silently
            await window.electronAPI.printSilent(finalBillData, 'KOT');

            // Print Bill silently
            await window.electronAPI.printSilent(finalBillData, 'BILL');

            const successMsg = billData.editMode ? 'Bill Updated & Reprinted with KOT!' : 'KOT & Bill Printed Successfully!';
            setToast({ message: successMsg, type: 'success' });
            setTimeout(() => {
                if (billData.editMode) {
                    onNavigate('records');
                } else if (billData.creditCustomerId) {
                    // Return to credit details for that specific customer
                    onNavigate('credit-details', billData.creditCustomerId);
                } else {
                    onNavigate('billing');
                }
            }, 1500);
        } catch (error) {
            console.error('Print Error:', error);
            setToast({ message: 'Printing Failed: ' + error.message, type: 'error' });
        } finally {
            setIsPrinting(false);
        }
    };

    // Navigation helper to go back to billing with context preserved
    const handleBackToBilling = () => {
        if (billData.creditCustomerId || billData.editMode) {
            onNavigate('billing', {
                creditCustomerId: billData.creditCustomerId,
                customerName: billData.customerName,
                editMode: billData.editMode,
                originalBillId: billData.originalBillId,
                cart: billData.items,
                billDate: billData.billDate
            });
        } else {
            onNavigate('billing');
        }
    };

    return (
        <div className="preview-page">
            <div className="custom-header-stub">
                <PageHeader onNavigate={handleBackToBilling} backTo="billing" />
            </div>
            
            <div className="preview-header">
                <h1>🖨️ Print Preview</h1>
                <div className="language-toggle" role="group" aria-label="Bill print language">
                    <span className="language-toggle-label">Print in:</span>
                    {PRINT_LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            className={`language-btn ${printLanguage === lang.code ? 'active' : ''}`}
                            onClick={() => setPrintLanguage(lang.code)}
                            disabled={isPrinting}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
                <div className="header-actions">
                    <button className="cancel-btn" onClick={handleBackToBilling} disabled={isPrinting}>
                        CANCEL
                    </button>
                </div>
            </div>

            <div className="middle-content">
                <div className="actions-left-column">
                    <button
                        className="action-btn save-only"
                        onClick={handleSaveBillOnly}
                        disabled={isPrinting}
                    >
                        {isPrinting ? 'Saving...' : 'SAVE ONLY'}
                    </button>
                    <button
                        className="action-btn kot-only"
                        onClick={handlePrintKOTOnly}
                        disabled={isPrinting}
                    >
                        {isPrinting ? 'Printing...' : 'KOT ONLY'}
                    </button>
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
                                <span>No: {previewBillNumber || '####'}</span>
                            </div>
                            <div className="bill-info-row">
                                <span className="bold">Bill To: {customerName || 'Cash Sale'}</span>
                            </div>
                            {supplierName && (
                                <div className="bill-info-row">
                                    <span className="bold">To: {supplierName}</span>
                                </div>
                            )}
                            <table className="bill-table">
                                <thead>
                                    <tr>
                                        <th className="col-item">Item</th>
                                        <th className="right col-qty">Qty</th>
                                        <th className="right col-total">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="col-item">{getItemPrintName(item, printLanguage)}</td>
                                            <td className="right col-qty">{item.quantity}</td>
                                            <td className="right col-total">{(item.price * item.quantity).toFixed(0)}</td>
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
                            <div className="text-left bold">Bill No: {previewBillNumber || '####'}</div>
                            <div className="text-left bold">Date: {dateTime}</div>
                            <div className="text-left bold">Bill To: {customerName || 'Cash Sale'}</div>
                            {supplierName && <div className="text-left bold">To: {supplierName}</div>}
                            <div className="bill-divider"></div>
                            <table className="bill-table">
                                <thead>
                                    <tr>
                                        <th className="col-item">ITEM NAME</th>
                                        <th className="right col-qty">QTY</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="bold col-item">{getItemPrintName(item, printLanguage)}</td>
                                            <td className="right bold col-qty">{item.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="bill-divider"></div>
                            <div className="bill-center bold footer-text">KITCHEN COPY</div>
                        </div>
                    </div>
                </div>

                <div className="actions-right-column">
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
                        {isPrinting ? 'Printing...' : 'KOT + BILL'}
                    </button>
                </div>
            </div>
            
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

export default PrintPreviewPage;
