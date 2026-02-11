import { useState, useEffect } from 'react';
import './CreditsPage.css';

/**
 * CREDITS PAGE
 * Manage customers who buy on credit
 * Shows summary of all credit customers
 */
function CreditsPage({ onNavigate }) {
    const [customers, setCustomers] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        setIsLoading(true);
        try {
            const data = await window.electronAPI.getAllCreditCustomers();
            setCustomers(data);
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddCustomer = async (e) => {
        e.preventDefault();
        if (!newCustomer.name.trim()) return;

        try {
            await window.electronAPI.addCreditCustomer(newCustomer.name, newCustomer.phone);
            setNewCustomer({ name: '', phone: '' });
            setShowAddForm(false);
            loadCustomers();
        } catch (error) {
            console.error('Error adding customer:', error);
            alert('Failed to add customer');
        }
    };

    return (
        <div className="credits-page">
            {/* Back Button */}
            <button className="back-btn" onClick={() => onNavigate('home')}>
                ← Back to Home
            </button>

            <div className="credits-container">
                <div className="credits-header">
                    <div>
                        <h1 className="credits-title">🤝 Credit Customers</h1>
                        <p className="credits-subtitle">Track pending balances and payments</p>
                    </div>
                    <button
                        className="add-customer-btn"
                        onClick={() => setShowAddForm(true)}
                    >
                        + Add Credit Customer
                    </button>
                </div>

                {/* Summary Table */}
                {isLoading ? (
                    <div className="loading">Loading customers...</div>
                ) : customers.length === 0 ? (
                    <div className="no-data">No credit customers found.</div>
                ) : (
                    <div className="table-container">
                        <table className="credits-table">
                            <thead>
                                <tr>
                                    <th>Customer Name</th>
                                    <th>Phone</th>
                                    <th>Total Credit (₹)</th>
                                    <th>Total Paid (₹)</th>
                                    <th>Balance (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((c) => (
                                    <tr
                                        key={c.id}
                                        onClick={() => onNavigate('credit-details', c.id)}
                                        className="clickable-row"
                                    >
                                        <td className="name-cell">{c.name}</td>
                                        <td>{c.phone || '-'}</td>
                                        <td className="amount-cell">₹{c.total_credit?.toFixed(0)}</td>
                                        <td className="amount-cell paid">₹{c.total_paid?.toFixed(0)}</td>
                                        <td className={`amount-cell balance ${c.balance > 0 ? 'pending' : ''}`}>
                                            ₹{c.balance?.toFixed(0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add Customer Modal */}
            {showAddForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Add New Credit Customer</h2>
                        <form onSubmit={handleAddCustomer}>
                            <div className="form-group">
                                <label>Customer Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newCustomer.name}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                    placeholder="Enter full name"
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone Number (Optional)</label>
                                <input
                                    type="text"
                                    value={newCustomer.phone}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                    placeholder="Enter mobile number"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={() => setShowAddForm(false)}>Cancel</button>
                                <button type="submit" className="save-btn">Save Customer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CreditsPage;
