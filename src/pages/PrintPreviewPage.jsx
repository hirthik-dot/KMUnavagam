import { useState, useEffect, useRef } from 'react';
import PageHeader from '../components/PageHeader';
import Toast from '../components/Toast';
import {
    PRINT_LANGUAGES,
    PRINT_LANGUAGE_SETTING_KEY,
    DEFAULT_PRINT_LANGUAGE,
    getItemPrintName,
} from '../utils/itemLanguage';
import './PrintPreviewPage.css';
import { formatMoney } from '../utils/money';

/**
 * PRINT PREVIEW PAGE
 * Shows side-by-side preview of Customer Bill and KOT
 * Handles silent printing via Electron
 */
function PrintPreviewPage({ onNavigate, billData }) {
    const [isPrinting, setIsPrinting] = useState(false);
    const [toast, setToast] = useState(null);
    const [previewBillNumber, setPreviewBillNumber] = useState(billData?.billNumber);
    // Per-bill language override; starts from the default saved in Admin settings
    const [printLanguage, setPrintLanguage] = useState(DEFAULT_PRINT_LANGUAGE);
    // Id of the bill this preview has already saved (a NEW bill is saved at most once, even if printing fails)
    const savedBillIdRef = useRef(null);
    const [savedBillId, setSavedBillId] = useState(null);
    // Synchronous guard: a double click fires twice before React re-renders the disabled buttons
    const actionInFlightRef = useRef(false);

    useEffect(() => {
        window.electronAPI.getSetting(PRINT_LANGUAGE_SETTING_KEY, DEFAULT_PRINT_LANGUAGE)
            .then((lang) => setPrintLanguage(lang || DEFAULT_PRINT_LANGUAGE))
            .catch((err) => console.error('Error loading print language:', err));
    }, []);

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
     * Save the bill once: edits update the original bill, new bills are inserted only on the first attempt.
     * Retrying after a print failure (or a second click) re-uses the saved bill instead of creating a duplicate.
     */
    const saveBillOnce = async () => {
        if (billData.editMode && billData.originalBillId) {
            await window.electronAPI.updateBill(
                billData.originalBillId,
                items,
                total,
                billData.supplierId || null,
                billData.billDate || null
            );
            return billData.originalBillId;
        }
        if (savedBillIdRef.current) return savedBillIdRef.current;

        const newId = await window.electronAPI.saveBill(
            items,
            total,
            billData.creditCustomerId || null,
            billData.supplierId || null,
            billData.billDate || null
        );
        savedBillIdRef.current = newId;
        setSavedBillId(newId);
        return newId;
    };

    /**
     * Save, then print the requested copies, then leave the page.
     * Buttons stay disabled after success (until navigation) so a quick second click can't act again.
     */
    const runAction = async ({ print = [], successMsg, failMsg, delay }) => {
        if (actionInFlightRef.current) return;
        actionInFlightRef.current = true;
        setIsPrinting(true);
        let billId = null;
        try {
            billId = await saveBillOnce();

            const finalBillData = {
                ...billData,
                billNumber: billId.toString().padStart(4, '0'),
                printLanguage
            };
            for (const type of print) {
                await window.electronAPI.printSilent(finalBillData, type);
            }

            setToast({ message: successMsg, type: 'success' });
            setTimeout(() => {
                if (billData.editMode) {
                    goBackAfterEdit();
                } else if (billData.creditCustomerId) {
                    // Return to credit details for that specific customer
                    onNavigate('credit-details', billData.creditCustomerId);
                } else {
                    onNavigate('billing');
                }
            }, delay);
        } catch (error) {
            console.error('Bill action error:', error);
            const savedNote = billId && !billData.editMode
                ? ` Bill #${String(billId).padStart(4, '0')} is already saved — try again to print it (it will not be saved twice).`
                : '';
            setToast({ message: `${failMsg}: ${error.message}.${savedNote}`, type: 'error' });
            actionInFlightRef.current = false;
            setIsPrinting(false);
        }
    };

    const handlePrintBill = () => runAction({
        print: ['BILL'],
        successMsg: billData.editMode ? 'Bill Updated & Reprinted!' : 'Bill Printed Successfully!',
        failMsg: 'Printing Failed',
        delay: 1000,
    });

    const handlePrintKOTOnly = () => runAction({
        print: ['KOT'],
        successMsg: billData.editMode ? 'Bill Updated & KOT Reprinted!' : 'KOT Printed Successfully!',
        failMsg: 'KOT Printing Failed',
        delay: 1000,
    });

    const handleSaveBillOnly = () => runAction({
        print: [],
        successMsg: billData.editMode ? 'Bill Updated Successfully!' : 'Bill Saved Successfully!',
        failMsg: 'Saving Failed',
        delay: 1500,
    });

    const handlePrintKOTAndBill = () => runAction({
        print: ['KOT', 'BILL'],
        successMsg: billData.editMode ? 'Bill Updated & Reprinted with KOT!' : 'KOT & Bill Printed Successfully!',
        failMsg: 'Printing Failed',
        delay: 1500,
    });

    // After editing a bill: back to where the edit started (customer page) or Records by default
    const goBackAfterEdit = () => {
        if (billData.returnTo) {
            onNavigate(billData.returnTo.page, billData.returnTo.data);
        } else {
            onNavigate('records');
        }
    };

    // Navigation helper to go back to billing with context preserved
    // (cart, staff and date are kept for every bill type so mistakes can be fixed quickly)
    const handleBackToBilling = () => {
        if (savedBillId && !billData.editMode) {
            // This new bill is already saved (printing failed): go back as an edit of it, so it is never saved twice
            onNavigate('billing', {
                editMode: true,
                originalBillId: savedBillId,
                customerName: billData.customerName,
                cart: billData.items,
                billDate: billData.billDate,
                supplierId: billData.supplierId,
                returnTo: billData.creditCustomerId
                    ? { page: 'credit-details', data: billData.creditCustomerId }
                    : { page: 'billing' }
            });
            return;
        }
        onNavigate('billing', {
            creditCustomerId: billData.creditCustomerId,
            customerName: billData.customerName,
            editMode: billData.editMode,
            originalBillId: billData.originalBillId,
            cart: billData.items,
            billDate: billData.billDate,
            supplierId: billData.supplierId,
            returnTo: billData.returnTo
        });
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
                                            <td className="right col-total">{formatMoney(item.price * item.quantity)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="bill-divider"></div>
                            <div className="bill-total-row">
                                <span>TOTAL</span>
                                <span>₹{formatMoney(total)}</span>
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
