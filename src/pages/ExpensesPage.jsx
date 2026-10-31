import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Footer from '../components/Footer';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import { formatToDisplayDate, getTodayLocaleDate } from '../utils/DateUtils';
import './ExpensesPage.css';
import { formatMoney, roundMoney } from '../utils/money';
import DateInput from '../components/DateInput';
import './CreditDetailsPage.css'; // For detail styling consistency
import './CreditsPage.css'; // For list styling consistency

function ExpensesPage({ onNavigate, initialTab }) {
    // Shared state
    const [activeTab, setActiveTab] = useState(initialTab || 'daily'); // 'daily' or 'vendors'
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);

    // --- Daily Expenses State ---
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [expenses, setExpenses] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [expenseDate, setExpenseDate] = useState(getTodayLocaleDate());

    // --- Vendor Management State ---
    const [vendors, setVendors] = useState([]);
    const [selectedVendorDetail, setSelectedVendorDetail] = useState(null);
    const [showAddVendorForm, setShowAddVendorForm] = useState(false);
    const [newVendor, setNewVendor] = useState({ name: '', phone: '' });
    
    // --- Shared Transaction State ---
    const [showTransactionForm, setShowTransactionForm] = useState(false);
    const [transactionType, setTransactionType] = useState('CREDIT'); // CREDIT or PAYMENT
    const [transAmount, setTransAmount] = useState('');
    const [transDesc, setTransDesc] = useState('');
    const [editingTransactionId, setEditingTransactionId] = useState(null);
    const [transDate, setTransDate] = useState(getTodayLocaleDate());
    
    // --- Expense History State ---
    const [historyExpenses, setHistoryExpenses] = useState([]);
    const [historyFilter, setHistoryFilter] = useState('all'); // 'all', 'month', 'custom'
    const [historySearch, setHistorySearch] = useState('');
    const [historyStartDate, setHistoryStartDate] = useState(getTodayLocaleDate());
    const [historyEndDate, setHistoryEndDate] = useState(getTodayLocaleDate());

    // Initial load
    useEffect(() => {
        const initData = async () => {
            await Promise.all([
                loadTodayExpenses(),
                loadVendors(),
                loadExpenseHistory()
            ]);
        };
        initData();
    }, []);

    // Also update if initialTab changes
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    // --- API Calls ---
    async function loadTodayExpenses() {
        try {
            const data = await window.electronAPI.getTodayExpenses();
            setExpenses(data || []);
            // Also refresh history if it's currently showing
            if (activeTab === 'history') loadExpenseHistory();
        } catch (error) {
            console.error('Error loading expenses:', error);
        }
    }

    async function loadExpenseHistory() {
        try {
            let data;
            if (historyFilter === 'all') {
                // Get last 100 for 'all' to prevent lag, or more as needed
                data = await window.electronAPI.getDailyRecords("2000-01-01", "2099-12-31"); 
                // Actually getDailyRecords returns grouped data. For expense list we need the raw items.
                // Let's use getExpensesByDateRange for full history
                data = await window.electronAPI.getExpensesByDateRange("2000-01-01", "2099-12-31");
            } else if (historyFilter === 'month') {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                data = await window.electronAPI.getExpensesByDateRange(firstDay, getTodayLocaleDate());
            } else {
                data = await window.electronAPI.getExpensesByDateRange(historyStartDate, historyEndDate);
            }
            setHistoryExpenses(data || []);
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    async function loadVendors() {
        try {
            const data = await window.electronAPI.getAllVendors();
            setVendors(data || []);
        } catch (error) {
            console.error('Error loading vendors:', error);
        }
    }

    async function loadVendorDetails(id) {
        setIsLoading(true);
        try {
            const data = await window.electronAPI.getVendorDetails(id);
            setSelectedVendorDetail(data);
        } catch (error) {
            console.error('Error loading vendor details:', error);
        } finally {
            setIsLoading(false);
        }
    }

    // --- Daily Expense Handlers ---
    const handleSaveExpense = async () => {
        if (!description.trim()) {
            setToast({ message: 'Please enter description', type: 'warning' });
            return;
        }
        if (!amount || parseFloat(amount) <= 0) {
            setToast({ message: 'Please enter valid amount', type: 'warning' });
            return;
        }

        setIsLoading(true);
        try {
            if (editingId) {
                await window.electronAPI.updateExpense(editingId, description.trim(), parseFloat(amount), expenseDate);
                setToast({ message: 'Expense updated', type: 'success' });
                setEditingId(null);
            } else {
                await window.electronAPI.addExpense(description.trim(), parseFloat(amount), expenseDate);
                setToast({ message: 'Expense added', type: 'success' });
            }

            setDescription('');
            setAmount('');
            setExpenseDate(getTodayLocaleDate());
            loadTodayExpenses();
            loadVendors();
        } catch (error) {
            setToast({ message: 'Error saving expense', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteExpense = (id) => {
        setConfirmDialog({
            message: 'Are you sure you want to delete this expense?',
            onConfirm: async () => {
                try {
                    await window.electronAPI.deleteExpense(id);
                    setToast({ message: 'Expense deleted', type: 'success' });
                    loadTodayExpenses();
                    loadVendors();
                    if (activeTab === 'history') {
                        loadExpenseHistory();
                    }
                } catch (error) {
                    setToast({ message: 'Error deleting expense', type: 'error' });
                } finally {
                    setConfirmDialog(null);
                }
            },
            onCancel: () => setConfirmDialog(null)
        });
    };

    // --- Vendor Handlers ---
    const handleAddVendor = async (e) => {
        e.preventDefault();
        if (!newVendor.name.trim()) return;
        try {
            await window.electronAPI.addVendor(newVendor.name, newVendor.phone);
            setNewVendor({ name: '', phone: '' });
            setShowAddVendorForm(false);
            loadVendors();
            setToast({ message: 'Vendor added successfully', type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to add vendor', type: 'error' });
        }
    };

    const handleDeleteVendor = (id, name) => {
        setConfirmDialog({
            message: `Are you sure you want to delete vendor "${name}"? This will hide the vendor from list but keep all history.`,
            onConfirm: async () => {
                try {
                    await window.electronAPI.deleteVendor(id);
                    setToast({ message: 'Vendor deleted', type: 'success' });
                    setSelectedVendorDetail(null);
                    loadVendors();
                } catch (error) {
                    setToast({ message: 'Error deleting vendor', type: 'error' });
                } finally {
                    setConfirmDialog(null);
                }
            },
            onCancel: () => setConfirmDialog(null)
        });
    };

    const handleSaveTransaction = async (e) => {
        e.preventDefault();
        const amt = parseFloat(transAmount);
        if (isNaN(amt) || amt <= 0) return;

        try {
            if (editingTransactionId) {
                await window.electronAPI.updateVendorTransaction(editingTransactionId, amt, transDesc, transDate);
                setToast({ message: 'Transaction updated', type: 'success' });
            } else {
                await window.electronAPI.addVendorTransaction(selectedVendorDetail.id, amt, transactionType, transDesc, transDate);
                setToast({ message: 'Transaction recorded', type: 'success' });
            }
            loadVendorDetails(selectedVendorDetail.id);
            loadVendors();
            setTransAmount('');
            setTransDesc('');
            setEditingTransactionId(null);
            setShowTransactionForm(false);
            loadTodayExpenses(); 
        } catch (error) {
            setToast({ message: 'Failed to save transaction', type: 'error' });
        }
    };

    const handleDeleteVendorTransaction = (transactionId) => {
        setConfirmDialog({
            message: 'Delete this transaction? If it was a payment, the daily expense will also be removed.',
            onConfirm: async () => {
                try {
                    const changes = await window.electronAPI.deleteVendorTransaction(transactionId);
                    if (changes > 0) {
                        setToast({ message: 'Transaction deleted', type: 'success' });
                        if (selectedVendorDetail) {
                            loadVendorDetails(selectedVendorDetail.id);
                        }
                        loadVendors();
                        loadTodayExpenses();
                    } else {
                        setToast({ message: 'Already deleted', type: 'warning' });
                    }
                } catch (error) {
                    setToast({ message: 'Failed to delete', type: 'error' });
                } finally {
                    setConfirmDialog(null);
                }
            },
            onCancel: () => setConfirmDialog(null)
        });
    };

    const todayTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    return (
        <div className="expenses-page">
            <PageHeader onNavigate={onNavigate} backTo="home" />

            {/* Simple Tab Navigation */}
            <div className="expenses-nav-tabs">
                <button 
                    className={`nav-tab ${activeTab === 'daily' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('daily');
                        setSelectedVendorDetail(null);
                        setShowAddVendorForm(false);
                        setShowTransactionForm(false);
                    }}
                >
                    <i className="fas fa-calendar-alt"></i> Daily Expenses
                </button>
                <button 
                    className={`nav-tab ${activeTab === 'vendors' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('vendors');
                        setShowAddVendorForm(false);
                        setShowTransactionForm(false);
                    }}
                >
                    <i className="fas fa-store"></i> Vendor Credits
                </button>
                <button 
                    className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('history');
                        loadExpenseHistory();
                    }}
                >
                    <i className="fas fa-history"></i> Expense History
                </button>
            </div>

            <div className="expenses-container">
                {activeTab === 'daily' && (
                    <div className="daily-view">
                        <div className="expenses-header">
                            <h1 className="expenses-title">Daily Expenses</h1>
                            <p className="expenses-subtitle">Manage today's spending</p>
                        </div>

                        <div className="expenses-form">
                            <div className="form-group">
                                <label className="form-label">Expense Description</label>
                                <input
                                    className="form-input"
                                    placeholder="Milk, Vegetables, Rent, etc."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Amount (₹)</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    placeholder="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date</label>
                                <DateInput
                                    className="form-input" value={expenseDate}
                                    onChange={(e) => setExpenseDate(e.target.value)}
                                />
                            </div>
                            <div className="form-actions">
                                <button className="add-expense-btn" onClick={handleSaveExpense} disabled={isLoading}>
                                    {editingId ? 'Update Expense' : 'Add Expense'}
                                </button>
                                {editingId && (
                                    <button className="cancel-btn" onClick={() => { 
                                        setEditingId(null); 
                                        setDescription(''); 
                                        setAmount(''); 
                                        setExpenseDate(getTodayLocaleDate());
                                    }}>
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="expenses-list-section">
                            <div className="list-header">
                                <h3 className="list-title"><i className="fas fa-list"></i> Today's History</h3>
                                <div className="total-badge">Total: ₹{formatMoney(todayTotal)}</div>
                            </div>

                            <div className="expenses-list">
                                {expenses.length === 0 ? (
                                    <div className="no-items">No expenses recorded today</div>
                                ) : (
                                    expenses.map((exp) => (
                                        <div key={exp.id} className="expense-item">
                                            <div className="expense-info">
                                                <div className="expense-desc">
                                                    <i className="fas fa-dot-circle"></i> {exp.description}
                                                </div>
                                                <div className="expense-amount">₹{formatMoney(exp.amount)}</div>
                                            </div>
                                            <div className="expense-actions">
                                                <button className="edit-btn-expense" onClick={() => {
                                                    setEditingId(exp.id);
                                                    setDescription(exp.description);
                                                    setAmount(exp.amount.toString());
                                                    setExpenseDate(exp.expense_date); // Support date editing
                                                    window.scrollTo(0, 0);
                                                }}>
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                                <button className="delete-btn-expense" onClick={() => handleDeleteExpense(exp.id)}>
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="history-view">
                        <div className="expenses-header">
                            <h1 className="expenses-title">Expense Search</h1>
                            <p className="expenses-subtitle">Search and filter past expenses</p>
                        </div>

                        <div className="history-filters">
                            <div className="filter-row">
                                <div className="filter-group">
                                    <label>Search Description</label>
                                    <div className="search-box">
                                        <input 
                                            type="text" 
                                            placeholder="Search items..." 
                                            value={historySearch}
                                            onChange={(e) => setHistorySearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="filter-group">
                                    <label>Date Filter</label>
                                    <select 
                                        value={historyFilter} 
                                        onChange={(e) => {
                                            setHistoryFilter(e.target.value);
                                            // Handle immediate load if not custom
                                            if (e.target.value !== 'custom') {
                                                // We'll use useEffect to trigger load on filter change or just call it
                                                setTimeout(() => loadExpenseHistory(), 0);
                                            }
                                        }}
                                    >
                                        <option value="all">Last 100 Expenses</option>
                                        <option value="month">Current Month</option>
                                        <option value="custom">Custom Range</option>
                                    </select>
                                </div>
                            </div>

                            {historyFilter === 'custom' && (
                                <div className="filter-row custom-dates">
                                    <div className="filter-group">
                                        <label>From</label>
                                        <DateInput value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} />
                                    </div>
                                    <div className="filter-group">
                                        <label>To</label>
                                        <DateInput value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} />
                                    </div>
                                    <button className="apply-btn" onClick={loadExpenseHistory}>Apply</button>
                                </div>
                            )}
                        </div>

                        <div className="history-table-container">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Description</th>
                                        <th className="text-right">Amount (₹)</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyExpenses
                                        .filter(exp => exp.description.toLowerCase().includes(historySearch.toLowerCase()))
                                        .map(exp => (
                                            <tr key={exp.id}>
                                                <td>{formatToDisplayDate(exp.expense_date)}</td>
                                                <td className="bold">{exp.description}</td>
                                                <td className="text-right bold">₹{formatMoney(exp.amount)}</td>
                                                <td>
                                                    <div className="actions-cell">
                                                        <button className="icon-btn edit" onClick={() => {
                                                            setActiveTab('daily');
                                                            setEditingId(exp.id);
                                                            setDescription(exp.description);
                                                            setAmount(exp.amount.toString());
                                                            setExpenseDate(exp.expense_date);
                                                            window.scrollTo(0, 0);
                                                        }}>
                                                            <i className="fas fa-edit"></i>
                                                        </button>
                                                        <button className="icon-btn delete" onClick={() => handleDeleteExpense(exp.id)}>
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    }
                                    {historyExpenses.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="no-data-cell">No records found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'vendors' && !selectedVendorDetail && (
                    <div className="credits-page">
                        <div className="credits-header">
                            <div>
                                <h1 className="credits-title">Vendor Management</h1>
                                <p className="credits-subtitle">Manage supplier accounts and payments</p>
                            </div>
                            <button className="add-customer-btn" onClick={() => setShowAddVendorForm(true)}>
                                + New Vendor
                            </button>
                        </div>

                        {vendors.length === 0 ? (
                            <div className="no-data">No vendors added yet.</div>
                        ) : (
                            <div className="table-container">
                                <table className="credits-table">
                                    <thead>
                                        <tr>
                                            <th>Vendor Name</th>
                                            <th>Phone</th>
                                            <th className="text-right">Balance (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {vendors.map(v => (
                                            <tr key={v.id} className="clickable-row" onClick={() => loadVendorDetails(v.id)}>
                                                <td className="name-cell">{v.name}</td>
                                                <td>{v.phone || '-'}</td>
                                                <td className={`amount-cell balance text-right ${v.balance > 0 ? 'pending' : ''}`}>
                                                    ₹{formatMoney(v.balance, { grouping: true })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'vendors' && selectedVendorDetail && (
                    <div className="credit-details-page full-width">
                        <button className="back-btn" onClick={() => setSelectedVendorDetail(null)}>
                            <i className="fas fa-arrow-left"></i> Back to Vendors
                        </button>

                        <div className="customer-info-header">
                            <div className="name-and-phone">
                                <h1 className="staff-name">{selectedVendorDetail.name}</h1>
                                <p>{selectedVendorDetail.phone}</p>
                                <button 
                                    className="delete-vendor-btn" 
                                    onClick={() => handleDeleteVendor(selectedVendorDetail.id, selectedVendorDetail.name)}
                                    title="Delete Vendor"
                                >
                                    <i className="fas fa-trash"></i> Delete Vendor
                                </button>
                            </div>
                            <div className="balance-card">
                                <span className="balance-label">Current Balance</span>
                                <h2 className={`balance-value ${selectedVendorDetail.balance > 0 ? 'pending' : ''}`}>
                                    ₹{formatMoney(selectedVendorDetail.balance, { grouping: true })}
                                </h2>
                            </div>
                        </div>

                        <div className="details-actions">
                            <button className="payment-btn" onClick={() => { setTransactionType('CREDIT'); setEditingTransactionId(null); setTransAmount(''); setTransDesc(''); setTransDate(getTodayLocaleDate()); setShowTransactionForm(true); }}>
                                <i className="fas fa-plus"></i> Add New Bill
                            </button>
                            <button className="new-bill-btn" onClick={() => { setTransactionType('PAYMENT'); setEditingTransactionId(null); setTransAmount(''); setTransDesc(''); setTransDate(getTodayLocaleDate()); setShowTransactionForm(true); }}>
                                <i className="fas fa-hand-holding-dollar"></i> Make Payment
                            </button>
                            <button className="settle-btn" disabled={selectedVendorDetail.balance <= 0} onClick={() => { setTransactionType('PAYMENT'); setEditingTransactionId(null); setTransAmount(roundMoney(selectedVendorDetail.balance).toString()); setTransDesc('Full Settlement'); setTransDate(getTodayLocaleDate()); setShowTransactionForm(true); }}>
                                <i className="fas fa-check-double"></i> Settle All
                            </button>
                        </div>

                        <div className="history-section">
                            <h3 className="section-title">Transaction History</h3>
                            <div className="table-wrapper">
                                <table className="history-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th>Description</th>
                                            <th className="text-right">Amount (₹)</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedVendorDetail.transactions.map(t => (
                                            <tr key={t.id}>
                                                 <td>{formatToDisplayDate(t.transaction_date)}</td>
                                                <td className={t.type === 'CREDIT' ? 'type-credit' : 'type-payment'}>
                                                    {t.type === 'CREDIT' ? 'Purchased bill' : 'Money Paid'}
                                                </td>
                                                <td>{t.description || '-'}</td>
                                                <td className={`text-right ${t.type === 'CREDIT' ? 'amount-credit' : 'amount-payment'}`}>
                                                    ₹{formatMoney(t.amount, { grouping: true })}
                                                </td>
                                                <td>
                                                    <div className="actions-cell">
                                                        <button className="icon-btn edit" onClick={() => {
                                                            setEditingTransactionId(t.id);
                                                            setTransactionType(t.type);
                                                            setTransAmount(t.amount.toString());
                                                            setTransDesc(t.description || '');
                                                            setTransDate(t.transaction_date);
                                                            setShowTransactionForm(true);
                                                        }}><i className="fas fa-edit"></i></button>
                                                        <button className="icon-btn delete" onClick={() => handleDeleteVendorTransaction(t.id)}><i className="fas fa-trash"></i></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS */}
            {showAddVendorForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Add New Vendor</h2>
                        <form onSubmit={handleAddVendor}>
                            <div className="form-group">
                                <label>Vendor Name</label>
                                <input type="text" required value={newVendor.name} onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })} autoFocus />
                            </div>
                            <div className="form-group">
                                <label>Phone (Optional)</label>
                                <input type="text" value={newVendor.phone} onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setShowAddVendorForm(false)}>Cancel</button>
                                <button type="submit" className="btn-save">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showTransactionForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>{editingTransactionId ? 'Edit Entry' : (transactionType === 'CREDIT' ? 'Add Purchase Bill' : 'Record Payment')}</h2>
                        <form onSubmit={handleSaveTransaction}>
                            <div className="form-group">
                                <label>Amount (₹)</label>
                                <input type="number" required value={transAmount} onChange={(e) => setTransAmount(e.target.value)} autoFocus />
                            </div>
                            <div className="form-group">
                                <label>Notes / Description</label>
                                <input type="text" value={transDesc} onChange={(e) => setTransDesc(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Date</label>
                                <DateInput value={transDate} onChange={(e) => setTransDate(e.target.value)} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => { setShowTransactionForm(false); setEditingTransactionId(null); }}>Cancel</button>
                                <button type="submit" className="btn-save">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmDialog && <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={confirmDialog.onCancel} />}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <Footer />
        </div>
    );
}

export default ExpensesPage;
