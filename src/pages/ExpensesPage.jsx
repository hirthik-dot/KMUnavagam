import { useState } from 'react';
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

    // Handle adding expense
    const handleAddExpense = async () => {
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
            // Call Electron to save expense
            await window.electronAPI.addExpense(
                description.trim(),
                parseFloat(amount)
            );

            // Success message
            setMessage(`✅ Expense added: ${description} - ₹${amount}`);

            // Clear form
            setDescription('');
            setAmount('');

            // Auto-clear message after 3 seconds
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error adding expense:', error);
            setMessage('❌ Error adding expense. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle Enter key press
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleAddExpense();
        }
    };

    return (
        <div className="expenses-page">
            {/* Back Button */}
            <button className="back-btn" onClick={() => onNavigate('home')}>
                ← Back to Home
            </button>

            <div className="expenses-container">
                {/* Header */}
                <div className="expenses-header">
                    <h1 className="expenses-title">💰 Add Expense</h1>
                    <p className="expenses-subtitle">
                        Today's Date: {new Date().toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                        })}
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
                            step="0.01"
                        />
                    </div>

                    {/* Add Button */}
                    <button
                        className="add-expense-btn"
                        onClick={handleAddExpense}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Adding...' : '✓ Add Expense'}
                    </button>

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
                        <button onClick={() => setDescription('Gas')} className="example-btn">Gas</button>
                        <button onClick={() => setDescription('Vegetables')} className="example-btn">Vegetables</button>
                        <button onClick={() => setDescription('Milk')} className="example-btn">Milk</button>
                        <button onClick={() => setDescription('Salary')} className="example-btn">Salary</button>
                        <button onClick={() => setDescription('Electricity')} className="example-btn">Electricity</button>
                        <button onClick={() => setDescription('Water')} className="example-btn">Water</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ExpensesPage;
