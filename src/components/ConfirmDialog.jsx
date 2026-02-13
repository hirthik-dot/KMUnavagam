import './ConfirmDialog.css';

function ConfirmDialog({ message, onConfirm, onCancel }) {
    return (
        <div className="confirm-overlay" onClick={onCancel}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-icon">
                    <i className="fas fa-exclamation-triangle"></i>
                </div>
                <div className="confirm-message">{message}</div>
                <div className="confirm-actions">
                    <button className="confirm-btn-cancel" onClick={onCancel}>
                        Cancel
                    </button>
                    <button className="confirm-btn-delete" onClick={onConfirm}>
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmDialog;
