import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Toast from '../components/Toast';
import './PrintPreviewPage.css';
import { formatMoney } from '../utils/money';

/**
 * CREDIT SUMMARY PREVIEW PAGE
 * Same layout as the bill Print Preview page.
 * Shows the exact HTML that print:creditSummary sends to the printer, so the client can confirm before printing.
 *
 * previewData = { customerId, summaryRange: { start, end }, data } where data is the printCreditSummary payload
 */
function SummaryPreviewPage({ onNavigate, previewData }) {
    const [html, setHtml] = useState('');
    const [isPrinting, setIsPrinting] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        if (!previewData) return;
        window.electronAPI.previewCreditSummary(previewData.data)
            .then(setHtml)
            .catch((err) => {
                console.error('Error loading summary preview:', err);
                setToast({ message: 'Failed to load summary preview', type: 'error' });
            });
    }, [previewData]);

    if (!previewData) {
        return (
            <div className="preview-error">
                <h2>No Summary Data Found</h2>
                <button onClick={() => onNavigate('credits')}>Back to Credits</button>
            </div>
        );
    }

    const { customerId, summaryRange, data } = previewData;

    // Back to the customer page with the date picker reopened on the same range
    const handleChangeDates = () => {
        onNavigate('credit-details', { customerId, summaryRange });
    };

    const handleCancel = () => {
        onNavigate('credit-details', customerId);
    };

    // Save a full statement (ledger, payments, bill details) for the client's own records
    const handleExport = async (format) => {
        setIsPrinting(true);
        try {
            const result = await window.electronAPI.exportCreditStatement(
                customerId,
                summaryRange.start,
                summaryRange.end,
                format
            );
            if (result?.success) {
                setToast({ message: `Saved: ${result.path}`, type: 'success' });
            }
        } catch (error) {
            console.error('Export Error:', error);
            setToast({ message: 'Download Failed: ' + error.message, type: 'error' });
        } finally {
            setIsPrinting(false);
        }
    };

    const handlePrint = async () => {
        setIsPrinting(true);
        try {
            // Print exactly what is previewed
            await window.electronAPI.printCreditSummary(data);
            setToast({ message: 'Summary Bill Printed Successfully!', type: 'success' });
            setTimeout(() => onNavigate('credit-details', customerId), 1000);
        } catch (error) {
            console.error('Print Error:', error);
            setToast({ message: 'Printing Failed: ' + error.message, type: 'error' });
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <div className="preview-page">
            <div className="custom-header-stub">
                <PageHeader onNavigate={handleCancel} backTo="credit-details" />
            </div>

            <div className="preview-header">
                <h1>🖨️ Summary Bill Preview</h1>
                <div className="summary-preview-meta">
                    {data.bills.length} day{data.bills.length === 1 ? '' : 's'} · {data.startDate} to {data.endDate} · Total <strong>₹{formatMoney(data.total)}</strong>
                </div>
                <div className="header-actions">
                    <button className="cancel-btn" onClick={handleCancel} disabled={isPrinting}>
                        CANCEL
                    </button>
                </div>
            </div>

            <div className="middle-content">
                <div className="actions-left-column">
                    <button
                        className="action-btn save-only"
                        onClick={handleChangeDates}
                        disabled={isPrinting}
                    >
                        CHANGE DATES
                    </button>
                </div>

                <div className="previews-container">
                    <div className="preview-box">
                        <h3 className="preview-label">CREDIT SUMMARY PREVIEW</h3>
                        <div className="bill-paper summary-paper">
                            {/* Exact HTML sent to the printer; sandboxed so nothing in it can run.
                                Only mount once html is loaded: React 19 omits an empty srcDoc, and a sandboxed
                                iframe that starts without srcdoc stays blank when srcdoc is added later. */}
                            {html && <iframe title="Summary bill preview" srcDoc={html} sandbox="" />}
                        </div>
                    </div>
                </div>

                <div className="actions-right-column">
                    <button
                        className="action-btn bill-only"
                        onClick={handlePrint}
                        disabled={isPrinting || !html}
                    >
                        {isPrinting ? 'Please wait...' : 'PRINT SUMMARY'}
                    </button>
                    <button
                        className="action-btn download-pdf"
                        onClick={() => handleExport('pdf')}
                        disabled={isPrinting}
                    >
                        <i className="fa-solid fa-file-pdf"></i> DOWNLOAD PDF
                    </button>
                    <button
                        className="action-btn download-excel"
                        onClick={() => handleExport('xlsx')}
                        disabled={isPrinting}
                    >
                        <i className="fa-solid fa-file-excel"></i> DOWNLOAD EXCEL
                    </button>
                </div>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

export default SummaryPreviewPage;
