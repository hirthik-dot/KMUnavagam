import './Cart.css';

function Cart({ cart, onUpdateQuantity, onRemoveItem, total, onPrint, className = '' }) {
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
                        {cart.map((item) => (
                            <div key={item.id} className="cart-item">
                                {/* Item Info */}
                                <div className="cart-item-info">
                                    <p className="cart-item-name-tamil">{item.name_tamil}</p>
                                    <p className="cart-item-name-english">{item.name_english}</p>
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
                                    <span className="qty-display">{item.quantity}</span>
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
                        ))}
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
                    >
                        Print Bill
                    </button>

                    {/* Cutting Border */}
                    <div className="cart-cutting-border"></div>
                </>
            )}
        </div>
    );
}

export default Cart;
