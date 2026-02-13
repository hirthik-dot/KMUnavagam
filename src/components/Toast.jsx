import { useEffect } from 'react';
import './Toast.css';

function Toast({ message, type = 'success', onClose }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);

        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`toast toast-${type}`}>
            <div className="toast-icon">
                {type === 'success' && <i className="fas fa-check-circle"></i>}
                {type === 'error' && <i className="fas fa-exclamation-circle"></i>}
                {type === 'warning' && <i className="fas fa-exclamation-triangle"></i>}
            </div>
            <span className="toast-message">{message}</span>
        </div>
    );
}

export default Toast;
