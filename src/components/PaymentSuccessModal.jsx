import React from 'react';
import './PaymentSuccessModal.css';

const PaymentSuccessModal = ({ amount, customerName, onClose }) => {
    return (
        <div className="success-modal-overlay">
            <div className="success-modal-card">
                <div className="success-icon-wrapper">
                    <div className="success-checkmark">
                        <i className="fas fa-check"></i>
                    </div>
                </div>
                
                <h2 className="success-title">Payment Successful!</h2>
                
                <div className="success-details">
                    <div className="detail-item">
                        <span className="detail-label">Amount Paid</span>
                        <span className="detail-value">₹{parseFloat(amount).toFixed(2)}</span>
                    </div>
                    {customerName && (
                        <div className="detail-item">
                            <span className="detail-label">Customer</span>
                            <span className="detail-value">{customerName}</span>
                        </div>
                    )}
                </div>

                <p className="success-message">The payment has been recorded and the balance has been updated.</p>
                
                <button className="success-close-btn" onClick={onClose}>
                    Done
                </button>
            </div>
        </div>
    );
};

export default PaymentSuccessModal;
