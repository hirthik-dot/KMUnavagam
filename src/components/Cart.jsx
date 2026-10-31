import { useState, useRef, useEffect } from 'react';
import { getItemDisplayNames } from '../utils/itemLanguage';
import './Cart.css';

function Cart({ cart, onUpdateQuantity, onRemoveItem, total, onPrint, className = '', displayLanguage }) {
    const [editingItemId, setEditingItemId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef(null);

    // Focus input when editing starts
    useEffect(() => {
        if (editingItemId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingItemId]);

    const handleDoubleClick = (item) => {
        setEditingItemId(item.id);
        setEditValue(item.quantity.toString());
    };

    const handleBlur = () => {
        saveQuantity();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            saveQuantity();
        }
    };

    const saveQuantity = () => {
        if (editingItemId === null) return;
        
        const newQty = parseInt(editValue, 10);
        if (!isNaN(newQty) && newQty > 0) {
            onUpdateQuantity(editingItemId, newQty);
        }
        setEditingItemId(null);
    };

    return (
        <div className={`cart ${className}`}>
            <h2 className="cart-title">Cart</h2>

            {cart.length === 0 ? (
                <div className="empty-cart">
                    <p className="empty-cart-icon">Cart</p>
                    <p className="empty-cart-text">Cart is empty</p>
                    <p className="empty-cart-hint">Click on food items to add</p>
                </div>
            ) : (
                <>
                    {/* Cart Items */}
                    <div className="cart-items">
                        {cart.map((item) => {
                            const names = getItemDisplayNames(item, displayLanguage);
                            return (
                            <div key={item.id} className="cart-item">
                                {/* Item Info */}
                                <div className="cart-item-info">
                                    <p className="cart-item-name-tamil">{names.primary}</p>
                                    {names.secondary && <p className="cart-item-name-english">{names.secondary}</p>}
                                    <p className="cart-item-rate">₹{item.price.toFixed(2)} each</p>
                                </div>

                                {/* Quantity Controls */}
                                <div className="cart-item-controls">
                                    <button
                                        className="qty-btn"
                                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                    >
                                        −
                                    </button>
                                    
                                    {editingItemId === item.id ? (
                                        <input
                                            ref={inputRef}
                                            type="number"
                                            className="qty-input"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleBlur}
                                            onKeyDown={handleKeyDown}
                                            min="1"
                                        />
                                    ) : (
                                        <span 
                                            className="qty-display"
                                            onDoubleClick={() => handleDoubleClick(item)}
                                            title="Double click to edit quantity"
                                        >
                                            {item.quantity}
                                        </span>
                                    )}

                                    <button
                                        className="qty-btn"
                                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                    >
                                        +
                                    </button>
                                </div>

                                {/* Item Total */}
                                <div className="cart-item-total">
                                    <p className="item-total-amount">
                                        ₹{(item.price * item.quantity).toFixed(2)}
                                    </p>
                                    <button
                                        className="remove-btn"
                                        onClick={() => onRemoveItem(item.id)}
                                        title="Remove item"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                            );
                        })}
                    </div>

                    {/* Grand Total */}
                    <div className="cart-total">
                        <div className="total-label">GRAND TOTAL</div>
                        <div className="total-amount">₹{total.toFixed(2)}</div>
                    </div>

                    {/* Print Button */}
                    <button
                        className="cart-print-btn"
                        onClick={onPrint}
                        title="Print Bill (Enter)"
                    >
                        Print Bill
                    </button>
                </>
            )}
        </div>
    );
}

export default Cart;
