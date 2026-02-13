import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Footer from '../components/Footer';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import './ExpensesPage.css';

/**
 * EXPENSES PAGE
 * Simple expense entry - like writing in a notebook
 * Only 2 fields: Description and Amount
 * Date is automatically set to today
 */
function ExpensesPage({ onNavigate }) {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [expenses, setExpenses] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);

    // Load today's expenses on mount
    useEffect(() => {
        loadTodayExpenses();
    }, []);

    async function loadTodayExpenses() {
        try {
            const data = await window.electronAPI.getTodayExpenses();
            setExpenses(data);
        } catch (error) {
            console.error('Error loading expenses:', error);
        }
    }

    // Handle adding/updating expense
    const handleSaveExpense = async () => {
        // Validation
        if (!description.trim()) {
            setMessage('⚠️ Please enter expense description');
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            setMessage('⚠️ Please enter valid amount');
            return;
        }

        setIsLoading(true);
        setMessage('');

        try {
            if (editingId) {
                // Update existing expense
                await window.electronAPI.updateExpense(
                    editingId,
                    description.trim(),
                    parseFloat(amount)
                );
                setMessage(`✅ Expense updated: ${description} - ₹${amount}`);
                setEditingId(null);
            } else {
                // Add new expense
                await window.electronAPI.addExpense(
                    description.trim(),
                    parseFloat(amount)
                );
                setMessage(`✅ Expense added: ${description} - ₹${amount}`);
            }

            // Clear form
            setDescription('');
            setAmount('');

            // Reload expenses
            await loadTodayExpenses();

            // Auto-clear message after 3 seconds
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error saving expense:', error);
            setMessage('❌ Error saving expense. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle edit button click
    const handleEdit = (expense) => {
        setEditingId(expense.id);
        setDescription(expense.description);
        setAmount(expense.amount.toString());
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Handle cancel edit
    const handleCancelEdit = () => {
        setEditingId(null);
        setDescription('');
        setAmount('');
    };

    // Handle delete
    const handleDelete = async (expense) => {
        setConfirmDialog({
            message: `Delete expense "${expense.description}" (₹${expense.amount})?`,
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await window.electronAPI.deleteExpense(expense.id);
                    setMessage(`✅ Expense deleted: ${expense.description}`);
                    await loadTodayExpenses();
                    setTimeout(() => setMessage(''), 3000);
                } catch (error) {
                    console.error('Error deleting expense:', error);
                    setMessage('❌ Error deleting expense.');
                }
            },
            onCancel: () => setConfirmDialog(null)
        });
    };

    // Handle Enter key press
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSaveExpense();
        }
    };

    // Handle quick expense selection
    const handleQuickExpense = (desc) => {
        setDescription(desc);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Calculate today's total
    const todayTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    return (
        <div className="expenses-page">
            <PageHeader onNavigate={onNavigate} backTo="home" />

            <div className="expenses-container">
                {/* Header */}
                <div className="expenses-header">
                    <h1 className="expenses-title">
                        <i className="fas fa-wallet"></i> {editingId ? 'Edit' : 'Add'} Expense
                    </h1>
                    <p className="expenses-subtitle">
                        Today's Date: {(() => {
                            const now = new Date();
                            const d = String(now.getDate()).padStart(2, '0');
                            const m = String(now.getMonth() + 1).padStart(2, '0');
                            const y = now.getFullYear();
                            return `${d}/${m}/${y}`;
                        })()}
                    </p>
                </div>

                {/* Input Form */}
                <div className="expenses-form">
                    {/* Description Input */}
                    <div className="form-group">
                        <label className="form-label">Expense Description</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g., Gas, Vegetables, Milk, Salary"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            onKeyPress={handleKeyPress}
                            autoFocus
                        />
                    </div>

                    {/* Amount Input */}
                    <div className="form-group">
                        <label className="form-label">Amount (₹)</label>
                        <input
                            type="number"
                            className="form-input"
                            placeholder="Enter amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            onKeyPress={handleKeyPress}
                            min="0"
                            step="1"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="form-actions">
                        <button
                            className="add-expense-btn"
                            onClick={handleSaveExpense}
                            disabled={isLoading}
                        >
                            <i className="fas fa-check"></i> {isLoading ? 'Saving...' : (editingId ? 'Update Expense' : 'Add Expense')}
                        </button>
                        
                        {editingId && (
                            <button
                                className="cancel-btn"
                                onClick={handleCancelEdit}
                            >
                                <i className="fas fa-times"></i> Cancel
                            </button>
                        )}
                    </div>

                    {/* Message */}
                    {message && (
                        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
                            {message}
                        </div>
                    )}
                </div>

                {/* Quick Examples */}
                <div className="quick-examples">
                    <p className="examples-title">Common Expenses:</p>
                    <div className="examples-list">
                        <button onClick={() => handleQuickExpense('Gas')} className="example-btn">Gas</button>
                        <button onClick={() => handleQuickExpense('Vegetables')} className="example-btn">Vegetables</button>
                        <button onClick={() => handleQuickExpense('Milk')} className="example-btn">Milk</button>
                        <button onClick={() => handleQuickExpense('Salary')} className="example-btn">Salary</button>
                        <button onClick={() => handleQuickExpense('Electricity')} className="example-btn">Electricity</button>
                        <button onClick={() => handleQuickExpense('Water')} className="example-btn">Water</button>
                    </div>
                </div>

                {/* Today's Expenses List */}
                {expenses.length > 0 && (
                    <div className="expenses-list-section">
                        <div className="list-header">
                            <h2 className="list-title">
                                <i className="fas fa-receipt"></i> Today's Expenses
                            </h2>
                            <div className="total-badge">
                                <i className="fas fa-calculator"></i> Total: ₹{todayTotal}
                            </div>
                        </div>

                        <div className="expenses-list">
                            {expenses.map((expense) => (
                                <div key={expense.id} className="expense-item">
                                    <div className="expense-info">
                                        <div className="expense-desc">
                                            <i className="fas fa-file-invoice-dollar"></i>
                                            {expense.description}
                                        </div>
                                        <div className="expense-amount">₹{expense.amount}</div>
                                    </div>
                                    <div className="expense-actions">
                                        <button
                                            className="edit-btn-expense"
                                            onClick={() => handleEdit(expense)}
                                        >
                                            <i className="fas fa-edit"></i> Edit
                                        </button>
                                        <button
                                            className="delete-btn-expense"
                                            onClick={() => handleDelete(expense)}
                                        >
                                            <i className="fas fa-trash-alt"></i> Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            {confirmDialog && <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={confirmDialog.onCancel} />}
            
            <Footer />
        </div>
    );
}

export default ExpensesPage;
