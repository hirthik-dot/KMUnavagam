import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Footer from '../components/Footer';
import Toast from '../components/Toast';
import './CreditsPage.css';
import { formatMoney } from '../utils/money';

/**
 * CREDITS PAGE
 * Manage customers who buy on credit
 * Shows summary of all credit customers
 */
function CreditsPage({ onNavigate, navData }) {
    const [customers, setCustomers] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState(null);
    // Remembered per PC so it stays on while going in and out of a deleted customer's page
    const [showDeleted, setShowDeleted] = useState(() => {
        try { return localStorage.getItem('credits.showDeleted') === '1'; } catch (e) { return false; }
    });

    useEffect(() => {
        try { localStorage.setItem('credits.showDeleted', showDeleted ? '1' : '0'); } catch (e) { /* ignore */ }
        loadCustomers();
    }, [showDeleted]);

    useEffect(() => {

        // Show deletion success message if passed from details page
        if (navData && navData.deletedCustomer) {
            setToast({
                message: `Customer "${navData.deletedCustomer}" deleted successfully.`,
                type: 'success'
            });
        }
    }, [navData]);

    const loadCustomers = async () => {
        setIsLoading(true);
        try {
            const data = await window.electronAPI.getAllCreditCustomers(showDeleted);
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
            setToast({ message: 'Failed to add customer', type: 'error' });
        }
    };

    return (
        <div className="credits-page">
            <PageHeader onNavigate={onNavigate} backTo="home" />

            <div className="credits-container">
                <div className="credits-header">
                    <div>
                        <h1 className="credits-title"><i className="fa-solid fa-handshake"></i> Credit Customers</h1>
                        <p className="credits-subtitle">Track pending balances and payments</p>
                    </div>
                    <div className="credits-header-actions">
                        <label className="show-deleted-toggle">
                            <input
                                type="checkbox"
                                checked={showDeleted}
                                onChange={(e) => setShowDeleted(e.target.checked)}
                            />
                            Show deleted customers
                        </label>
                        <button
                            className="add-customer-btn"
                            onClick={() => setShowAddForm(true)}
                        >
                            + Add Credit Customer
                        </button>
                    </div>
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
                                    <th className="name-header">Customer Name</th>
                                    <th className="phone-header">Phone</th>
                                    <th className="amount-header text-right">Total Credit (₹)</th>
                                    <th className="amount-header text-right">Total Paid (₹)</th>
                                    <th className="amount-header text-right">Balance (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((c) => (
                                    <tr
                                        key={c.id}
                                        onClick={() => onNavigate('credit-details', c.id)}
                                        className={`clickable-row ${c.is_deleted ? 'deleted-row' : ''}`}
                                    >
                                        <td className="name-cell">
                                            {c.name}
                                            {c.is_deleted === 1 && <span className="deleted-tag">Deleted</span>}
                                        </td>
                                        <td className="phone-cell">{c.phone || '-'}</td>
                                        <td className="amount-cell text-right">₹{formatMoney(c.total_credit)}</td>
                                        <td className="amount-cell paid text-right">₹{formatMoney(c.total_paid)}</td>
                                        <td className={`amount-cell balance text-right ${c.balance > 0 ? 'pending' : ''}`}>
                                            ₹{formatMoney(c.balance)}
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

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <Footer />
        </div>
    );
}

export default CreditsPage;
