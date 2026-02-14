import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Footer from '../components/Footer';
import Toast from '../components/Toast';
import PaymentSuccessModal from '../components/PaymentSuccessModal';
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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [lastPaymentAmount, setLastPaymentAmount] = useState(0);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [toast, setToast] = useState(null);
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
        if (customerId) {
            loadCustomerDetails();
        }
    }, [customerId]);

    const loadCustomerDetails = async () => {
        setIsLoading(true);
        try {
            const id = (typeof customerId === 'object' && customerId !== null)
                ? (customerId.creditCustomerId || customerId.id)
                : customerId;

            const data = await window.electronAPI.getCreditCustomerDetails(id);
            setCustomer(data);
        } catch (error) {
            console.error('Error loading customer details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const confirmDelete = async () => {
        try {
            await window.electronAPI.deleteCreditCustomer(customer.id);
            onNavigate('credits', { deletedCustomer: customer.name });
        } catch (error) {
            console.error('Error deleting customer:', error);
            setToast({ message: 'Failed to delete customer', type: 'error' });
        } finally {
            setShowDeleteConfirm(false);
        }
    };

    const handleAddPayment = async (e) => {
        e.preventDefault();
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) return;

        try {
            await window.electronAPI.addCreditPayment(customerId, amount, paymentDate);
            setLastPaymentAmount(amount);
            setPaymentAmount('');
            setShowPaymentForm(false);
            setShowSuccessModal(true);
            loadCustomerDetails();
        } catch (error) {
            console.error('Error adding payment:', error);
            setToast({ message: 'Failed to save payment', type: 'error' });
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
            <PageHeader onNavigate={onNavigate} backTo="credits" />

            <div className="details-container">
                {/* Info Header */}
                <div className="customer-info-header">
                    <div className="name-and-phone">
                        <div className="name-with-actions">
                            <h1 className="customer-name">{customer.name}</h1>
                            <button 
                                className="delete-customer-btn" 
                                onClick={() => setShowDeleteConfirm(true)}
                                title="Delete this customer"
                            >
                                <i className="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                        <p className="customer-phone"><i className="fa-solid fa-mobile-screen-button"></i> {customer.phone || 'No phone provided'}</p>
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
                        <i className="fa-solid fa-plus"></i> New Bill for this Customer
                    </button>
                    <button
                        className="payment-btn"
                        onClick={() => setShowPaymentForm(true)}
                    >
                        <i className="fa-solid fa-wallet"></i> Add Payment
                    </button>
                    <button
                        className="settle-btn"
                        onClick={() => {
                            setPaymentAmount(customer.balance.toString());
                            setShowPaymentForm(true);
                        }}
                        disabled={customer.balance <= 0}
                    >
                        <i className="fa-solid fa-check-double"></i> Full Settlement
                    </button>
                </div>

                {/* Transactions Layout */}
                <div className="transactions-grid">
                    {/* Bills Column */}
                    <div className="transaction-section">
                        <h3 className="section-title"><i className="fa-solid fa-file-invoice"></i> Bill History</h3>
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
                                                <td>{(() => {
                                                    const d = new Date(bill.date);
                                                    const day = String(d.getDate()).padStart(2, '0');
                                                    const month = String(d.getMonth() + 1).padStart(2, '0');
                                                    const year = d.getFullYear();
                                                    return `${day}/${month}/${year}`;
                                                })()}</td>
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
                        <h3 className="section-title"><i className="fa-solid fa-money-bill-transfer"></i> Payment History</h3>
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
                                                <td>{(() => {
                                                    const d = new Date(p.date);
                                                    const day = String(d.getDate()).padStart(2, '0');
                                                    const month = String(d.getMonth() + 1).padStart(2, '0');
                                                    const year = d.getFullYear();
                                                    return `${day}/${month}/${year}`;
                                                })()}</td>
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
                                <div className="amount-input-wrapper">
                                    <input
                                        type="number"
                                        required
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        placeholder="Enter amount paid"
                                        autoFocus
                                    />
                                    <button 
                                        type="button" 
                                        className="settle-shortcut-btn"
                                        onClick={() => setPaymentAmount(customer.balance.toString())}
                                    >
                                        Full Balance
                                    </button>
                                </div>
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

            {/* Deletion Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content delete-confirm-modal">
                        <div className="confirm-icon">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <h2>Delete Customer?</h2>
                        <p className="confirm-text">
                            Are you sure you want to delete <strong>{customer.name}</strong>? 
                            This will permanently remove all their credit and payment records.
                        </p>
                        <div className="modal-actions">
                            <button className="confirm-cancel-btn" onClick={() => setShowDeleteConfirm(false)}>No, Keep</button>
                            <button className="confirm-delete-btn" onClick={confirmDelete}>Yes, Delete</button>
                        </div>
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
                                <p>{(() => {
                                    const d = new Date(selectedBill.created_at);
                                    const day = String(d.getDate()).padStart(2, '0');
                                    const month = String(d.getMonth() + 1).padStart(2, '0');
                                    const year = d.getFullYear();
                                    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                                    return `${day}/${month}/${year} ${time}`;
                                })()}</p>
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
            
            {showSuccessModal && (
                <PaymentSuccessModal 
                    amount={lastPaymentAmount}
                    customerName={customer.name}
                    onClose={() => setShowSuccessModal(false)}
                />
            )}
            
            <Footer />
        </div>
    );
}

export default CreditDetailsPage;
