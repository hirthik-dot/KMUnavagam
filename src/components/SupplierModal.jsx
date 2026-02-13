import './SupplierModal.css';
import { useState } from 'react';

function SupplierModal({ suppliers, onSelect, onCancel }) {
    const [selectedSupplierId, setSelectedSupplierId] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedSupplierId) return;
        
        const supplier = suppliers.find(s => s.id === parseInt(selectedSupplierId));
        onSelect(supplier);
    };

    return (
        <div className="supplier-overlay" onClick={onCancel}>
            <div className="supplier-modal" onClick={(e) => e.stopPropagation()}>
                <div className="supplier-modal-header">
                    <i className="fas fa-user-circle"></i>
                    <h2>Select Staff</h2>
                    <p>Who is attending this order?</p>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="supplier-select-group">
                        <select 
                            value={selectedSupplierId} 
                            onChange={(e) => setSelectedSupplierId(e.target.value)}
                            required
                            autoFocus
                        >
                            <option value="" disabled>-- Choose Supplier --</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="supplier-modal-actions">
                        <button type="button" className="btn-cancel" onClick={onCancel}>
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn-confirm" 
                            disabled={!selectedSupplierId}
                        >
                            Continue to Preview
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default SupplierModal;
