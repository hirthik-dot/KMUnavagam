import { useState, useRef } from 'react';
import './FoodCard.css';

function FoodCard({ item, onAddToCart, isInCart, onPriceChange, quantity, onUpdateQuantity }) {
    const [isClicked, setIsClicked] = useState(false);
    const [isEditingPrice, setIsEditingPrice] = useState(false);
    const [tempPrice, setTempPrice] = useState(item.price);
    const priceInputRef = useRef(null);

    /**
     * Handle card click - add to cart and show visual feedback
     */
    function handleClick() {
        if (isEditingPrice) return; // Don't add to cart when editing price
        
        // If already in cart, don't do anything on card click except if we want it to increment
        // But the user requested specific buttons, so we should probably keep card click simple
        onAddToCart(item);

        // Show click animation
        setIsClicked(true);
        setTimeout(() => setIsClicked(false), 300);
    }

    /**
     * Handle quantity increase
     */
    function handleIncrement(e) {
        e.stopPropagation();
        onUpdateQuantity(item.id, quantity + 1);
    }

    /**
     * Handle quantity decrease
     */
    function handleDecrement(e) {
        e.stopPropagation();
        if (quantity > 0) {
            onUpdateQuantity(item.id, quantity - 1);
        }
    }

    /**
     * Handle double click on price - enable editing
     */
    function handlePriceDoubleClick(e) {
        e.stopPropagation(); // Prevent card click
        setIsEditingPrice(true);
        setTempPrice(item.price);
    }

    /**
     * Handle price input change
     */
    function handlePriceInputChange(e) {
        const value = e.target.value;
        setTempPrice(value);
    }

    /**
     * Save the edited price
     */
    function savePriceChange() {
        const finalPrice = tempPrice === '' || tempPrice === '0' ? item.price : parseFloat(tempPrice);
        
        if (!isNaN(finalPrice) && finalPrice > 0 && onPriceChange) {
            onPriceChange(item.id, finalPrice);
        }
        setIsEditingPrice(false);
    }

    /**
     * Handle Enter key to save price immediately
     */
    function handlePriceKeyDown(e) {
        e.stopPropagation();
        
        if (e.key === 'Enter') {
            e.preventDefault();
            savePriceChange();
        }
        if (e.key === 'Escape') {
            setTempPrice(item.price);
            setIsEditingPrice(false);
        }
    }

    return (
        <div
            className={`food-card ${isInCart ? 'in-cart' : ''} ${isClicked ? 'clicked' : ''}`}
            onClick={handleClick}
        >
            {/* Food Image */}
            <div className="food-image">
                {item.image_path ? (
                    <img
                        src={`/food-images/${item.image_path}`}
                        alt={item.name_english}
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div class="no-image">No Image</div>';
                        }}
                    />
                ) : (
                    <div className="no-image">No Image</div>
                )}
            </div>

            {/* Food Details */}
            <div className="food-details">
                {/* Tamil Name (Big) */}
                <h3 className="food-name-tamil">{item.name_tamil}</h3>

                {/* English Name */}
                <p className="food-name-english">{item.name_english}</p>

                {/* Price - Editable on double click */}
                {isEditingPrice ? (
                    <input
                        ref={priceInputRef}
                        type="number"
                        className="food-price-input"
                        value={tempPrice}
                        onChange={handlePriceInputChange}
                        onBlur={savePriceChange}
                        onKeyDown={handlePriceKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.target.select()}
                        autoFocus
                        step="1"
                        min="0"
                    />
                ) : (
                    <p 
                        className="food-price editable" 
                        onDoubleClick={handlePriceDoubleClick}
                        title="Double-click to edit price"
                    >
                        ₹{item.price.toFixed(0)}
                    </p>
                )}

                {/* Quantity Controls - Only when in cart */}
                {isInCart && (
                    <div className="card-quantity-controls">
                        <button 
                            className="card-qty-btn decrease" 
                            onClick={handleDecrement}
                        >
                            -
                        </button>
                        <span className="card-qty-value">{quantity}</span>
                        <button 
                            className="card-qty-btn increase" 
                            onClick={handleIncrement}
                        >
                            +
                        </button>
                    </div>
                )}
            </div>

            {/* In Cart Indicator */}
            {isInCart && (
                <div className="in-cart-badge">
                    ✓
                </div>
            )}
        </div>
    );
}

export default FoodCard;
