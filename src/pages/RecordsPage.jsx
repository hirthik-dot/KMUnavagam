import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Footer from '../components/Footer';
import Toast from '../components/Toast';
import { getTodayLocaleDate } from '../utils/DateUtils';
import './RecordsPage.css';
import { formatMoney } from '../utils/money';
import DateInput from '../components/DateInput';

/**
 * RECORDS PAGE
 * Tally/Notebook style daily records
 * Shows day-wise sales, expenses, and profit
 * Click on a day to see all bills
 */
function RecordsPage({ onNavigate, restoreView }) {
    const [records, setRecords] = useState([]);
    // restoreView: the view to come back to after Edit & Reprint (same filter, range, tab and open day)
    const [filter, setFilter] = useState(restoreView?.filter || 'today');
    const [customStartDate, setCustomStartDate] = useState(restoreView?.customStartDate || '');
    const [customEndDate, setCustomEndDate] = useState(restoreView?.customEndDate || '');
    const [selectedDate, setSelectedDate] = useState(null);
    const [dayDetails, setDayDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState(null);

    // For Individual Bill View
    const [selectedBill, setSelectedBill] = useState(null);
    const [billItems, setBillItems] = useState([]);
    const [isBillLoading, setIsBillLoading] = useState(false);
    const [tab, setTab] = useState(restoreView?.tab || 'daily'); // 'daily' or 'supplier'
    const [supplierSales, setSupplierSales] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [supplierFilter, setSupplierFilter] = useState('');
    const [billToDelete, setBillToDelete] = useState(null);

    // Load suppliers on mount
    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                // Includes discharged / deleted staff so their past sales can still be filtered
                const data = await window.electronAPI.getSuppliersForReports();
                setSuppliers(data);
            } catch (err) {
                console.error('Error fetching suppliers:', err);
            }
        };
        fetchSuppliers();
    }, []);

    // Load records when filter, tab or supplier filter changes
    useEffect(() => {
        if (tab === 'daily') {
            loadRecords();
        } else {
            loadSupplierSales();
        }
    }, [filter, customStartDate, customEndDate, tab, supplierFilter]);

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
            // Daily records should always show total, ignore supplier filter
            const data = await window.electronAPI.getDailyRecords(startDate, endDate, '');
            setRecords(data);

            // AUTO-LOAD TODAY DETAILS: If filtering for today, only auto-fetch if there's actually data for today's date
            const todayResult = data.find(r => r.date === startDate);
            
            if (filter === 'today' && todayResult) {
                const [bills, expenses] = await Promise.all([
                    window.electronAPI.getBillsByDate(todayResult.date),
                    window.electronAPI.getExpensesByDate(todayResult.date)
                ]);
                setDayDetails({ bills, expenses, isTodayView: true });
            } else if (filter === 'today') {
                // If it's today but no records for today exist yet, clear details
                setDayDetails({ bills: [], expenses: [], isTodayView: true });
            } else {
                // Switched away from today: clear only the auto-loaded Today panel, never an open day popup
                // (checking selectedDate here read a stale value and could wipe a reopened popup)
                setDayDetails((prev) => (prev?.isTodayView ? null : prev));
            }
        } catch (error) {
            console.error('Error loading records:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Load supplier-wise sales
    const loadSupplierSales = async () => {
        if (filter === 'custom' && (!customStartDate || !customEndDate)) {
            return;
        }

        setIsLoading(true);
        try {
            const { startDate, endDate } = getDateRange();
            const data = await window.electronAPI.getSupplierWiseSales(startDate, endDate, supplierFilter);
            setSupplierSales(data);
        } catch (error) {
            console.error('Error loading supplier sales:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Coming back from editing a bill: reopen the day popup it was opened from
    useEffect(() => {
        if (restoreView?.openDate) loadDayDetails(restoreView.openDate);
    }, [restoreView]);

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
                name_hindi: item.name_hindi,
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
                } : null,
                // Top-level customerName so PrintPreviewPage renders it correctly
                customerName: bill.bill_type === 'CREDIT' ? bill.customer_name : null,
                supplierId: bill.supplier_id,
                supplierName: bill.supplier_name,
                billDate: bill.created_at ? bill.created_at.split('T')[0] : getTodayLocaleDate(),
                // After printing / saving / going back, return to this same Records view
                returnTo: {
                    page: 'records',
                    data: { filter, customStartDate, customEndDate, tab, openDate: selectedDate }
                }
            };

            // Navigate to billing page with pre-filled cart
            onNavigate('billing', editBillData);
        } catch (error) {
            console.error('Error loading bill for editing:', error);
            setToast({ message: 'Failed to load bill for editing', type: 'error' });
        }
    };

    // Handle Bill Deletion
    const handleDeleteBill = async () => {
        if (!billToDelete) return;

        try {
            const success = await window.electronAPI.deleteBill(billToDelete.id);
            if (success) {
                setToast({ message: 'Bill Deleted Successfully', type: 'success' });
                // Refresh data
                loadRecords();
                if (selectedDate) loadDayDetails(selectedDate);
            } else {
                setToast({ message: 'Bill not found or already deleted', type: 'error' });
            }
        } catch (error) {
            console.error('Error deleting bill:', error);
            setToast({ message: `Failed to delete bill: ${error.message || 'Unknown error'}`, type: 'error' });
        } finally {
            setBillToDelete(null);
        }
    };

    // Close day details
    const closeDayDetails = () => {
        setSelectedDate(null);
        // Only clear if not in the fixed Today view
        if (filter !== 'today') {
            setDayDetails(null);
        }
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
                    <h1 className="records-title"><i className="fa-solid fa-chart-line"></i> Sales Records</h1>
                    <div className="tab-buttons">
                        <button className={`tab-btn ${tab === 'daily' ? 'active' : ''}`} onClick={() => {
                            setTab('daily');
                            setSupplierFilter('');
                        }}>
                            <i className="fas fa-calendar-day"></i> Daily Records
                        </button>
                        <button className={`tab-btn ${tab === 'supplier' ? 'active' : ''}`} onClick={() => setTab('supplier')}>
                            <i className="fas fa-user-tie"></i> Supplier Sales
                        </button>
                    </div>
                    <button className="backup-btn" onClick={handleBackup} title="Download full data backup (SQLite format)">
                        <i className="fa-solid fa-download"></i> Backup Data
                    </button>
                </div>

                {/* Filters ... (Keep existing filter buttons) */}
                <div className="filters">
                    <div className="filter-group">
                        <button className={`filter-btn ${filter === 'today' ? 'active' : ''}`} onClick={() => setFilter('today')}>Today</button>
                        <button className={`filter-btn ${filter === 'week' ? 'active' : ''}`} onClick={() => setFilter('week')}>This Week</button>
                        <button className={`filter-btn ${filter === 'month' ? 'active' : ''}`} onClick={() => setFilter('month')}>This Month</button>
                        <button className={`filter-btn ${filter === 'custom' ? 'active' : ''}`} onClick={() => setFilter('custom')}>Custom Range</button>
                    </div>

                    {tab === 'supplier' && (
                        <div className="supplier-filter">
                            <label>Filter by Supplier:</label>
                            <select
                                value={supplierFilter}
                                onChange={(e) => setSupplierFilter(e.target.value)}
                                className="supplier-select"
                            >
                                <option value="">All Suppliers</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}{s.is_deleted ? ' (deleted)' : !s.is_active ? ' (inactive)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Custom Date Range */}
                {filter === 'custom' && (
                    <div className="custom-range">
                        <DateInput value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="date-input" />
                        <span>to</span>
                        <DateInput value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="date-input" />
                    </div>
                )}

                {/* Summary Cards */}
                {tab === 'daily' && (
                    <div className="summary-cards">
                        <div className="summary-card total">
                            <div className="card-label">Total Sales</div>
                            <div className="card-value">₹{formatMoney(totals.totalSales)}</div>
                        </div>
                        <div className="summary-card sales">
                            <div className="card-label">Cash Sales</div>
                            <div className="card-value">₹{formatMoney(totals.totalCashSales)}</div>
                        </div>
                        <div className="summary-card credit">
                            <div className="card-label">Credit Sales</div>
                            <div className="card-value">₹{formatMoney(totals.totalCreditSales)}</div>
                        </div>
                        <div className="summary-card expenses">
                            <div className="card-label">Total Expenses</div>
                            <div className="card-value">₹{formatMoney(totals.totalExpenses)}</div>
                        </div>
                        <div className="summary-card profit">
                            <div className="card-label">Net Profit</div>
                            <div className="card-value">₹{formatMoney(totals.totalProfit)}</div>
                        </div>
                    </div>
                )}

                {/* Records Table */}
                {isLoading && !selectedDate ? (
                    <div className="loading">Loading records...</div>
                ) : tab === 'supplier' ? (
                    <div className="records-table-container">
                        {supplierSales.length === 0 ? (
                            <div className="no-records">No supplier records found for selected period</div>
                        ) : (
                            <table className="records-table">
                                <thead>
                                    <tr>
                                        <th>Supplier Name</th>
                                        <th>Total Orders</th>
                                        <th>Total Sales (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {supplierSales.map((supplier) => (
                                        <tr key={supplier.supplier_id || 'unassigned'}>
                                            <td className="date-cell">
                                                <i className="fas fa-user-circle"></i> {supplier.supplier_name || 'Unassigned'}
                                                {supplier.is_deleted === 1 && <span className="removed-badge">(Removed)</span>}
                                            </td>
                                            <td className="sales-cell">{supplier.bill_count}</td>
                                            <td className="profit-cell positive">₹{supplier.total_sales.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                ) : records.length === 0 ? (
                    <div className="no-records">No records found for selected period</div>
                ) : filter === 'today' && dayDetails?.isTodayView ? (
                    /* INLINE TODAY VIEW: Direct bills and expenses */
                    <div className="today-details-inline">
                        <div className="two-column-layout">
                            {/* Left Column - Bills */}
                            <div className="details-section">
                                <h3 className="section-title"><i className="fa-solid fa-file-invoice"></i> Recent Bills ({dayDetails.bills.length})</h3>
                                {dayDetails.bills.length === 0 ? (
                                    <p className="no-data">No bills for today yet.</p>
                                ) : (
                                    <div className="records-table-container">
                                        <table className="details-table">
                                            <thead>
                                                <tr>
                                                    <th>Bill #</th>
                                                    <th>Time</th>
                                                    <th>Type</th>
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
                                                        <td className="bold">₹{formatMoney(bill.total_amount)}</td>
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
                                                                <button
                                                                    className="delete-btn-small"
                                                                    onClick={() => setBillToDelete(bill)}
                                                                    title="Delete this bill"
                                                                >
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Right Column - Expenses */}
                            <div className="details-section">
                                <h3 className="section-title"><i className="fa-solid fa-wallet"></i> Today's Expenses ({dayDetails.expenses.length})</h3>
                                {dayDetails.expenses.length === 0 ? (
                                    <p className="no-data">No expenses for today yet.</p>
                                ) : (
                                    <div className="records-table-container">
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
                                                        <td className="expenses-cell">₹{formatMoney(expense.amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
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
                                        <td className="sales-cell">₹{formatMoney(record.cash_sales)}</td>
                                        <td className="credit-cell">₹{formatMoney(record.credit_sales)}</td>
                                        <td className="expenses-cell">₹{formatMoney(record.total_expenses)}</td>
                                        <td className={`profit-cell ${record.profit >= 0 ? 'positive' : 'negative'}`}>₹{formatMoney(record.profit)}</td>
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
                                                    <th>Supplier</th>
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
                                                        <td className="customer-cell supplier-name-cell">
                                                            {bill.supplier_name ? (
                                                                <>
                                                                    <i className="fas fa-user-circle"></i> {bill.supplier_name}
                                                                    {bill.supplier_deleted === 1 && <span className="removed-badgeSmall">(Removed)</span>}
                                                                </>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="bold">₹{formatMoney(bill.total_amount)}</td>
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
                                                                <button
                                                                    className="delete-btn-small"
                                                                    onClick={() => setBillToDelete(bill)}
                                                                    title="Delete this bill"
                                                                >
                                                                    <i className="fa-solid fa-trash"></i>
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
                                                        <td>₹{formatMoney(expense.amount)}</td>
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
                                    <span className="summary-value sales">₹{formatMoney(dayDetails.bills.reduce((sum, bill) => sum + bill.total_amount, 0))}</span>
                                </div>
                                <div className="summary-item">
                                    <span className="summary-label">Total Expenses:</span>
                                    <span className="summary-value expenses">₹{formatMoney(dayDetails.expenses.reduce((sum, exp) => sum + exp.amount, 0))}</span>
                                </div>
                                <div className="summary-item profit">
                                    <span className="summary-label">Net Profit:</span>
                                    <span className="summary-value">₹{formatMoney((dayDetails.bills.reduce((sum, bill) => sum + bill.total_amount, 0) - dayDetails.expenses.reduce((sum, exp) => sum + exp.amount, 0)))}</span>
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
                            <div className="bill-header-main">
                                <h2>Bill #{selectedBill.id}</h2>
                                <div className="bill-badges">
                                    <span className={`type-badge ${selectedBill.bill_type?.toLowerCase() || 'cash'}`}>
                                        {selectedBill.bill_type || 'CASH'}
                                    </span>
                                </div>
                            </div>
                            <button className="close-btn" onClick={() => setSelectedBill(null)}>✕</button>
                        </div>
                        
                        <div className="bill-metadata">
                            <div className="meta-row">
                                <span className="meta-label">Date:</span>
                                <span className="meta-value">{selectedBill.created_at ? formatDisplayDate(selectedBill.created_at.split('T')[0]) : '-'}</span>
                            </div>
                            <div className="meta-row">
                                <span className="meta-label">Time:</span>
                                <span className="meta-value">{selectedBill.time || '-'}</span>
                            </div>
                            {selectedBill.bill_type === 'CREDIT' && (
                                <div className="meta-row">
                                    <span className="meta-label">Customer:</span>
                                    <span className="meta-value bold">{selectedBill.customer_name}</span>
                                </div>
                            )}
                            <div className="meta-row">
                                <span className="meta-label">Supplier:</span>
                                <span className="meta-value">{selectedBill.supplier_name || 'Counter'}</span>
                            </div>
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
                                                <td>₹{formatMoney(item.rate)}</td>
                                                <td>₹{formatMoney(item.rate * item.quantity)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bill-total-row">
                                            <td colSpan="3">TOTAL</td>
                                            <td>₹{formatMoney(selectedBill.total_amount)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Bill Delete Confirmation Modal */}
            {billToDelete && (
                <div className="modal-overlay danger">
                    <div className="modal-content small danger">
                        <div className="modal-header">
                            <h2>Delete Bill?</h2>
                            <button className="close-btn" onClick={() => setBillToDelete(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to delete <strong>Bill #{billToDelete.id}</strong> (₹{formatMoney(billToDelete.total_amount)})?</p>
                            <p className="danger-text">This action cannot be undone and will remove the record from all history and account balances.</p>
                        </div>
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setBillToDelete(null)}>CANCEL</button>
                            <button className="confirm-delete-btn" onClick={handleDeleteBill}>DELETE PERMANENTLY</button>
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
