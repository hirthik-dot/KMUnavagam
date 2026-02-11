import { useState, useEffect } from 'react';
import './CreditDetailsPage.css';

/**
 * CREDIT CUSTOMER DETAIL PAGE
 * Shows transaction history for a specific customer
 * Allows recording payments
 */
function CreditDetailsPage({ onNavigate, customerId }) {
    const [customer, setCustomer] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const getTodayLocalDate = () => {
        const now = new Date();
        return now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0');
    };

    const [paymentDate, setPaymentDate] = useState(getTodayLocalDate());

    // For Bill Preview Modal
    const [selectedBill, setSelectedBill] = useState(null);
    const [billItems, setBillItems] = useState([]);
    const [isBillLoading, setIsBillLoading] = useState(false);

    useEffect(() => {
        console.log('CreditDetailsPage: customerId prop is', customerId);
        if (customerId) {
            loadCustomerDetails();
        }
    }, [customerId]);

    const loadCustomerDetails = async () => {
        setIsLoading(true);
        try {
            // If customerId is an object (e.g. from navData), extract the ID
            const id = (typeof customerId === 'object' && customerId !== null)
                ? (customerId.creditCustomerId || customerId.id)
                : customerId;

            console.log('Fetching details for ID:', id);
            const data = await window.electronAPI.getCreditCustomerDetails(id);
            console.log('Data received:', data);
            setCustomer(data);
        } catch (error) {
            console.error('Error loading customer details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddPayment = async (e) => {
        e.preventDefault();
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) return;

        try {
            await window.electronAPI.addCreditPayment(customerId, amount, paymentDate);
            setPaymentAmount('');
            setShowPaymentForm(false);
            loadCustomerDetails();
        } catch (error) {
            console.error('Error adding payment:', error);
            alert('Failed to save payment');
        }
    };

    const viewBillDetails = async (bill) => {
        setSelectedBill(bill);
        setIsBillLoading(true);
        try {
            const items = await window.electronAPI.getBillItems(bill.id);
            setBillItems(items);
        } catch (error) {
            console.error('Error loading bill items:', error);
        } finally {
            setIsBillLoading(false);
        }
    };

    if (isLoading) return <div className="loading">Loading details...</div>;
    if (!customer) return (
        <div className="no-data">
            <p>Customer not found (ID: {JSON.stringify(customerId)})</p>
            <button onClick={() => onNavigate('credits')}>Back to List</button>
        </div>
    );

    return (
        <div className="details-page">
            {/* Navigation */}
            <div className="nav-header">
                <button className="back-btn" onClick={() => onNavigate('credits')}>
                    ← Back to Credits
                </button>
                <span className="debug-id">DEBUG: ID={customer.id} | Bills={customer.bills?.length || 0}</span>
            </div>

            <div className="details-container">
                {/* Info Header */}
                <div className="customer-info-header">
                    <div>
                        <h1 className="customer-name">{customer.name}</h1>
                        <p className="customer-phone">📱 {customer.phone || 'No phone provided'}</p>
                    </div>
                    <div className="balance-card">
                        <span className="balance-label">Pending Balance</span>
                        <h2 className={`balance-value ${(customer.balance || 0) > 0 ? 'pending' : ''}`}>
                            ₹{(customer.balance || 0).toFixed(0)}
                        </h2>
                    </div>
                </div>

                {/* Actions */}
                <div className="details-actions">
                    <button
                        className="new-bill-btn"
                        onClick={() => onNavigate('billing', { creditCustomerId: customer.id, customerName: customer.name })}
                    >
                        ➕ New Bill for this Customer
                    </button>
                    <button
                        className="payment-btn"
                        onClick={() => setShowPaymentForm(true)}
                    >
                        💰 Add Payment / Settlement
                    </button>
                </div>

                {/* Transactions Layout */}
                <div className="transactions-grid">
                    {/* Bills Column */}
                    <div className="transaction-section">
                        <h3 className="section-title">📄 Bill History</h3>
                        {customer.bills.length === 0 ? (
                            <p className="no-data-small">No bills recorded yet.</p>
                        ) : (
                            <div className="table-wrapper">
                                <table className="history-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Bill #</th>
                                            <th>Amount</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customer.bills.map((bill) => (
                                            <tr key={bill.id}>
                                                <td>{new Date(bill.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                                                <td>#{bill.id}</td>
                                                <td className="bold">₹{bill.total_amount.toFixed(0)}</td>
                                                <td>
                                                    <button className="view-btn" onClick={() => viewBillDetails(bill)}>View Bill</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Payments Column */}
                    <div className="transaction-section">
                        <h3 className="section-title">💸 Payment History</h3>
                        {customer.payments.length === 0 ? (
                            <p className="no-data-small">No payments recorded yet.</p>
                        ) : (
                            <div className="table-wrapper">
                                <table className="history-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customer.payments.map((p) => (
                                            <tr key={p.id}>
                                                <td>{new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                <td className="paid-amount">₹{p.amount.toFixed(0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Payment Modal */}
            {showPaymentForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Record Payment / Settlement</h2>
                        <form onSubmit={handleAddPayment}>
                            <div className="form-group">
                                <label>Amount (₹) *</label>
                                <input
                                    type="number"
                                    required
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder="Enter amount paid"
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>Payment Date</label>
                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={() => setShowPaymentForm(false)}>Cancel</button>
                                <button type="submit" className="save-btn">Save Payment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bill Details Modal */}
            {selectedBill && (
                <div className="modal-overlay" onClick={() => setSelectedBill(null)}>
                    <div className="bill-modal" onClick={e => e.stopPropagation()}>
                        <div className="bill-header">
                            <div>
                                <h2>Bill #{selectedBill.id} Details</h2>
                                <p>{new Date(selectedBill.created_at).toLocaleString('en-IN')}</p>
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
        </div>
    );
}

export default CreditDetailsPage;
