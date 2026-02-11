import { useState, useEffect } from 'react';
import FoodCard from '../components/FoodCard';
import Cart from '../components/Cart';
import SearchBar from '../components/SearchBar';
import './BillingPage.css';

function BillingPage({ onNavigate, creditCustomer }) {
    const [foodItems, setFoodItems] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [cart, setCart] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // Load food items when component mounts
    useEffect(() => {
        loadFoodItems();
    }, []);

    // Filter items when search query changes
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredItems(foodItems);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = foodItems.filter(
                (item) =>
                    item.name_english.toLowerCase().includes(query) ||
                    item.name_tamil.includes(query)
            );
            setFilteredItems(filtered);
        }
    }, [searchQuery, foodItems]);

    /**
     * Load all food items from the database
     */
    async function loadFoodItems() {
        try {
            setLoading(true);
            const items = await window.electronAPI.getAllItems();
            setFoodItems(items);
            setFilteredItems(items);
        } catch (error) {
            console.error('Error loading food items:', error);
            alert('Failed to load food items. Please restart the app.');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Add item to cart or increase quantity if already in cart
     */
    function addToCart(item) {
        setCart((prevCart) => {
            // Check if item already exists in cart
            const existingItem = prevCart.find((cartItem) => cartItem.id === item.id);

            if (existingItem) {
                // Increase quantity
                return prevCart.map((cartItem) =>
                    cartItem.id === item.id
                        ? { ...cartItem, quantity: cartItem.quantity + 1 }
                        : cartItem
                );
            } else {
                // Add new item with quantity 1
                return [...prevCart, { ...item, quantity: 1 }];
            }
        });
    }

    /**
     * Update item quantity in cart
     */
    function updateQuantity(itemId, newQuantity) {
        if (newQuantity <= 0) {
            // Remove item if quantity is 0
            setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
        } else {
            // Update quantity
            setCart((prevCart) =>
                prevCart.map((item) =>
                    item.id === itemId ? { ...item, quantity: newQuantity } : item
                )
            );
        }
    }

    /**
     * Remove item from cart
     */
    function removeFromCart(itemId) {
        setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
    }

    /**
     * Calculate total amount
     */
    function calculateTotal() {
        return cart.reduce((total, item) => total + item.price * item.quantity, 0);
    }

    /**
     * Print bill
     */
    const handlePrintBill = async () => {
        if (cart.length === 0) {
            alert('Please add items to your bill first.');
            return;
        }

        const total = calculateTotal();
        const now = new Date();
        const dateTime = now.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });

        const customerId = creditCustomer?.creditCustomerId || null;
        const customerName = creditCustomer?.customerName || null;

        // Prepare data for preview
        const billData = {
            items: cart,
            total: total,
            dateTime: dateTime,
            customerName: customerName,
            creditCustomerId: customerId,
            billNumber: 'PENDING', // Will be generated on save
        };

        // Navigate to preview page instead of printing immediately
        onNavigate('print-preview', billData);
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Loading food items...</p>
            </div>
        );
    }

    return (
        <div className="billing-page">
            {/* Back Button */}
            {onNavigate && (
                <button className="back-btn-billing" onClick={() => onNavigate(creditCustomer ? 'credits' : 'home')}>
                    ← Back to {creditCustomer ? 'Credits' : 'Home'}
                </button>
            )}

            {/* Credit Customer Banner */}
            {creditCustomer && (
                <div className="credit-banner">
                    <p>📝 Billing for Credit Customer: <strong>{creditCustomer.customerName}</strong></p>
                </div>
            )}

            {/* Search Bar */}
            <div className="search-section">
                <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
            </div>

            {/* Main Content */}
            <div className="billing-content">
                {/* Food Items Grid (Left 2/3) */}
                <div className="food-items-section">
                    {filteredItems.length === 0 ? (
                        <div className="no-items">
                            <p>No food items found.</p>
                            {searchQuery && (
                                <button
                                    className="btn-secondary"
                                    onClick={() => setSearchQuery('')}
                                >
                                    Clear Search
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="food-grid">
                            {filteredItems.map((item) => (
                                <FoodCard
                                    key={item.id}
                                    item={item}
                                    onAddToCart={addToCart}
                                    isInCart={cart.some((cartItem) => cartItem.id === item.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Cart Section (Right 1/3) */}
                <div className="cart-section">
                    <Cart
                        cart={cart}
                        onUpdateQuantity={updateQuantity}
                        onRemoveItem={removeFromCart}
                        total={calculateTotal()}
                        onPrint={handlePrintBill}
                    />
                </div>
            </div>
        </div>
    );
}

export default BillingPage;
