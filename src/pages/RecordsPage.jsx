import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Footer from '../components/Footer';
import Toast from '../components/Toast';
import './RecordsPage.css';

/**
 * RECORDS PAGE
 * Tally/Notebook style daily records
 * Shows day-wise sales, expenses, and profit
 * Click on a day to see all bills
 */
function RecordsPage({ onNavigate }) {
    const [records, setRecords] = useState([]);
    const [filter, setFilter] = useState('today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [selectedDate, setSelectedDate] = useState(null);
    const [dayDetails, setDayDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState(null);

    // For Individual Bill View
    const [selectedBill, setSelectedBill] = useState(null);
    const [billItems, setBillItems] = useState([]);
    const [isBillLoading, setIsBillLoading] = useState(false);

    // Load records when filter changes
    useEffect(() => {
        loadRecords();
    }, [filter, customStartDate, customEndDate]);

    // Calculate date range based on filter
    const getDateRange = () => {
        const today = new Date();
        let startDate, endDate;

        switch (filter) {
            case 'today':
                startDate = endDate = formatDate(today);
                break;

            case 'week':
                // Last 7 days
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 6);
                startDate = formatDate(weekAgo);
                endDate = formatDate(today);
                break;

            case 'month':
                // Current month
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                startDate = formatDate(monthStart);
                endDate = formatDate(today);
                break;

            case 'custom':
                startDate = customStartDate;
                endDate = customEndDate;
                break;

            default:
                startDate = endDate = formatDate(today);
        }

        return { startDate, endDate };
    };

    // Format date as local YYYY-MM-DD
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Load records from database
    const loadRecords = async () => {
        if (filter === 'custom' && (!customStartDate || !customEndDate)) {
            return;
        }

        setIsLoading(true);
        try {
            const { startDate, endDate } = getDateRange();
            const data = await window.electronAPI.getDailyRecords(startDate, endDate);
            setRecords(data);
        } catch (error) {
            console.error('Error loading records:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Load details for a specific day
    const loadDayDetails = async (date) => {
        setSelectedDate(date);
        setIsLoading(true);

        try {
            const [bills, expenses] = await Promise.all([
                window.electronAPI.getBillsByDate(date),
                window.electronAPI.getExpensesByDate(date)
            ]);

            setDayDetails({ bills, expenses });
        } catch (error) {
            console.error('Error loading day details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // View specific bill details
    const viewBillDetails = async (bill) => {
        setSelectedBill(bill);
        setIsBillLoading(true);
        try {
            const items = await window.electronAPI.getBillItems(bill.id);
            setBillItems(items);
        } catch (error) {
            console.error('Error loading bill items:', error);
            setToast({ message: 'Failed to load bill items', type: 'error' });
        } finally {
            setIsBillLoading(false);
        }
    };

    // Handle full data backup
    const handleBackup = async () => {
        try {
            const result = await window.electronAPI.backupDatabase();
            if (result.success) {
                setToast({ message: `Backup saved to: ${result.path}`, type: 'success' });
            }
        } catch (error) {
            console.error('Backup failed:', error);
            setToast({ message: 'Backup failed: ' + error.message, type: 'error' });
        }
    };

    // Edit and reprint bill - load into billing page
    const handleEditAndReprint = async (bill) => {
        try {
            // Load bill items
            const items = await window.electronAPI.getBillItems(bill.id);
            
            // Transform items to cart format (ensure item_id is preserved)
            const cartItems = items.map(item => ({
                id: item.item_id || item.id,
                item_id: item.item_id || item.id,
                name_tamil: item.name_tamil,
                name_english: item.name_english,
                price: item.rate,
                quantity: item.quantity,
                image_path: item.image_path || null
            }));

            // Prepare bill data for editing
            const editBillData = {
                editMode: true,
                originalBillId: bill.id,
                cart: cartItems,
                creditCustomer: bill.bill_type === 'CREDIT' ? {
                    creditCustomerId: bill.credit_customer_id,
                    customerName: bill.customer_name
                } : null
            };

            // Navigate to billing page with pre-filled cart
            onNavigate('billing', editBillData);
        } catch (error) {
            console.error('Error loading bill for editing:', error);
            setToast({ message: 'Failed to load bill for editing', type: 'error' });
        }
    };

    // Close day details
    const closeDayDetails = () => {
        setSelectedDate(null);
        setDayDetails(null);
        setSelectedBill(null);
    };

    // Format date for display
    const formatDisplayDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        // Standardize to dd/mm/yyyy
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Calculate totals
    const calculateTotals = () => {
        const totalCashSales = records.reduce((sum, r) => sum + (r.cash_sales || 0), 0);
        const totalCreditSales = records.reduce((sum, r) => sum + (r.credit_sales || 0), 0);
        const totalExpenses = records.reduce((sum, r) => sum + r.total_expenses, 0);
        const totalProfit = (totalCashSales + totalCreditSales) - totalExpenses;

        return { totalCashSales, totalCreditSales, totalExpenses, totalProfit, totalSales: totalCashSales + totalCreditSales };
    };

    const totals = calculateTotals();

    return (
        <div className="records-page">
            <PageHeader onNavigate={onNavigate} backTo="home" />

            <div className="records-container">
                {/* Header */}
                <div className="records-header">
                    <h1 className="records-title"><i className="fa-solid fa-chart-line"></i> Daily Records</h1>
                    <p className="records-subtitle">Sales, Expenses & Profit</p>
                    <button className="backup-btn" onClick={handleBackup} title="Download full data backup (SQLite format)">
                        <i className="fa-solid fa-download"></i> Backup Data
                    </button>
                </div>

                {/* Filters ... (Keep existing filter buttons) */}
                <div className="filters">
                    <button className={`filter-btn ${filter === 'today' ? 'active' : ''}`} onClick={() => setFilter('today')}>Today</button>
                    <button className={`filter-btn ${filter === 'week' ? 'active' : ''}`} onClick={() => setFilter('week')}>This Week</button>
                    <button className={`filter-btn ${filter === 'month' ? 'active' : ''}`} onClick={() => setFilter('month')}>This Month</button>
                    <button className={`filter-btn ${filter === 'custom' ? 'active' : ''}`} onClick={() => setFilter('custom')}>Custom Range</button>
                </div>

                {/* Custom Date Range */}
                {filter === 'custom' && (
                    <div className="custom-range">
                        <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="date-input" />
                        <span>to</span>
                        <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="date-input" />
                    </div>
                )}

                {/* Summary Cards */}
                <div className="summary-cards">
                    <div className="summary-card sales">
                        <div className="card-label">Cash Sales</div>
                        <div className="card-value">₹{totals.totalCashSales.toFixed(0)}</div>
                    </div>
                    <div className="summary-card credit">
                        <div className="card-label">Credit Sales</div>
                        <div className="card-value">₹{totals.totalCreditSales.toFixed(0)}</div>
                    </div>
                    <div className="summary-card expenses">
                        <div className="card-label">Total Expenses</div>
                        <div className="card-value">₹{totals.totalExpenses.toFixed(0)}</div>
                    </div>
                    <div className="summary-card profit">
                        <div className="card-label">Net Profit</div>
                        <div className="card-value">₹{totals.totalProfit.toFixed(0)}</div>
                    </div>
                </div>

                {/* Records Table */}
                {isLoading && !selectedDate ? (
                    <div className="loading">Loading records...</div>
                ) : records.length === 0 ? (
                    <div className="no-records">No records found for selected period</div>
                ) : (
                    <div className="records-table-container">
                        <table className="records-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Cash Sales (₹)</th>
                                    <th>Credit Sales (₹)</th>
                                    <th>Expenses (₹)</th>
                                    <th>Profit (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((record) => (
                                    <tr key={record.date} onClick={() => loadDayDetails(record.date)} className="clickable-row">
                                        <td className="date-cell">{formatDisplayDate(record.date)}</td>
                                        <td className="sales-cell">₹{record.cash_sales?.toFixed(0) || 0}</td>
                                        <td className="credit-cell">₹{record.credit_sales?.toFixed(0) || 0}</td>
                                        <td className="expenses-cell">₹{record.total_expenses.toFixed(0)}</td>
                                        <td className={`profit-cell ${record.profit >= 0 ? 'positive' : 'negative'}`}>₹{record.profit.toFixed(0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Day Details Modal */}
            {selectedDate && dayDetails && (
                <div className="modal-overlay" onClick={closeDayDetails}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Details for {formatDisplayDate(selectedDate)}</h2>
                            <button className="close-btn" onClick={closeDayDetails}>✕</button>
                        </div>

                        <div className="modal-body">
                            <div className="two-column-layout">
                                {/* Left Column - Bills */}
                                <div className="details-section">
                                    <h3 className="section-title"><i className="fa-solid fa-file-invoice"></i> Bills ({dayDetails.bills.length})</h3>
                                    {dayDetails.bills.length === 0 ? (
                                        <p className="no-data">No bills for this day</p>
                                    ) : (
                                        <table className="details-table">
                                            <thead>
                                                <tr>
                                                    <th>Bill #</th>
                                                    <th>Time</th>
                                                    <th>Type</th>
                                                    <th>Customer</th>
                                                    <th>Amount</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dayDetails.bills.map((bill) => (
                                                    <tr key={bill.id} className={bill.bill_type === 'CREDIT' ? 'credit-row' : ''}>
                                                        <td>#{bill.id}</td>
                                                        <td>{bill.time}</td>
                                                        <td className="type-cell">
                                                            <span className={`type-badge ${bill.bill_type.toLowerCase()}`}>
                                                                {bill.bill_type}
                                                            </span>
                                                        </td>
                                                        <td className="customer-cell">{bill.customer_name || '-'}</td>
                                                        <td className="bold">₹{bill.total_amount.toFixed(0)}</td>
                                                        <td>
                                                            <div className="action-buttons">
                                                                <button
                                                                    className="view-btn-small"
                                                                    onClick={() => viewBillDetails(bill)}
                                                                >
                                                                    View
                                                                </button>
                                                                <button
                                                                    className="edit-reprint-btn"
                                                                    onClick={() => handleEditAndReprint(bill)}
                                                                    title="Edit and reprint this bill"
                                                                >
                                                                    Edit & Reprint
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>

                                {/* Right Column - Expenses */}
                                <div className="details-section">
                                    <h3 className="section-title"><i className="fa-solid fa-wallet"></i> Expenses ({dayDetails.expenses.length})</h3>
                                    {dayDetails.expenses.length === 0 ? (
                                        <p className="no-data">No expenses for this day</p>
                                    ) : (
                                        <table className="details-table">
                                            <thead>
                                                <tr>
                                                    <th>Description</th>
                                                    <th>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dayDetails.expenses.map((expense) => (
                                                    <tr key={expense.id}>
                                                        <td>{expense.description}</td>
                                                        <td>₹{expense.amount.toFixed(0)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>

                            {/* Summary Footer */}
                            <div className="modal-summary">
                                <div className="summary-item">
                                    <span className="summary-label">Total Sales:</span>
                                    <span className="summary-value sales">₹{dayDetails.bills.reduce((sum, bill) => sum + bill.total_amount, 0).toFixed(0)}</span>
                                </div>
                                <div className="summary-item">
                                    <span className="summary-label">Total Expenses:</span>
                                    <span className="summary-value expenses">₹{dayDetails.expenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(0)}</span>
                                </div>
                                <div className="summary-item profit">
                                    <span className="summary-label">Net Profit:</span>
                                    <span className="summary-value">₹{(dayDetails.bills.reduce((sum, bill) => sum + bill.total_amount, 0) - dayDetails.expenses.reduce((sum, exp) => sum + exp.amount, 0)).toFixed(0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Individual Bill Details Modal (Nested) */}
            {selectedBill && (
                <div className="modal-overlay nested" onClick={() => setSelectedBill(null)}>
                    <div className="bill-modal" onClick={e => e.stopPropagation()}>
                        <div className="bill-header">
                            <div>
                                <h2>Bill #{selectedBill.id} Details</h2>
                                <p>{selectedBill.customer_name ? `Customer: ${selectedBill.customer_name}` : 'Cash Sale'}</p>
                            </div>
                            <button className="close-btn" onClick={() => setSelectedBill(null)}>✕</button>
                        </div>
                        <div className="bill-body">
                            {isBillLoading ? (
                                <p>Loading items...</p>
                            ) : (
                                <table className="bill-items-table">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>Qty</th>
                                            <th>Rate</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {billItems.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{item.name_tamil || item.name_english}</td>
                                                <td>{item.quantity}</td>
                                                <td>₹{item.rate.toFixed(0)}</td>
                                                <td>₹{(item.rate * item.quantity).toFixed(0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bill-total-row">
                                            <td colSpan="3">TOTAL</td>
                                            <td>₹{selectedBill.total_amount.toFixed(0)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <Footer />
        </div>
    );
}

export default RecordsPage;
