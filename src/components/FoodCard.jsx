import { useState } from 'react';
import './FoodCard.css';

function FoodCard({ item, onAddToCart, isInCart }) {
    const [isClicked, setIsClicked] = useState(false);

    /**
     * Handle card click - add to cart and show visual feedback
     */
    function handleClick() {
        onAddToCart(item);

        // Show click animation
        setIsClicked(true);
        setTimeout(() => setIsClicked(false), 300);
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

                {/* Price */}
                <p className="food-price">₹{item.price.toFixed(2)}</p>
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
