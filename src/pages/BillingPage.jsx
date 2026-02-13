import { useState, useEffect } from 'react';
import FoodCard from '../components/FoodCard';
import Cart from '../components/Cart';
import SearchBar from '../components/SearchBar';
import PageHeader from '../components/PageHeader';
import Toast from '../components/Toast';
import './BillingPage.css';

function BillingPage({ onNavigate, creditCustomer }) {
    const [foodItems, setFoodItems] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [cart, setCart] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [originalBillId, setOriginalBillId] = useState(null);

    const [categories, setCategories] = useState([{ id: 0, name: 'All' }]);
    const [toast, setToast] = useState(null);

    // Load food items and categories when component mounts
    useEffect(() => {
        loadFoodItems();
        loadCategories();
    }, []);

    // Pre-fill cart if editing mode
    useEffect(() => {
        if (creditCustomer?.editMode && creditCustomer?.cart) {
            setCart(creditCustomer.cart);
            setEditMode(true);
            setOriginalBillId(creditCustomer.originalBillId);
        }
    }, [creditCustomer]);

    // Filter items when search query or category changes
    useEffect(() => {
        let filtered = foodItems;

        // Filter by category
        if (selectedCategory !== 'All') {
            filtered = filtered.filter(item => 
                item.category === selectedCategory
            );
        }

        // Filter by search query
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (item) =>
                    item.name_english.toLowerCase().includes(query) ||
                    item.name_tamil.includes(query)
            );
        }

        setFilteredItems(filtered);
    }, [searchQuery, selectedCategory, foodItems]);

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
            setToast({ message: 'Failed to load food items. Please restart the app.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }

    /**
     * Load all categories from the database
     */
    async function loadCategories() {
        try {
            const dbCategories = await window.electronAPI.getAllCategories();
            setCategories([{ id: 0, name: 'All' }, ...dbCategories]);
        } catch (error) {
            console.error('Error loading categories:', error);
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
     * Handle price change from FoodCard double-click
     */
    function handlePriceChange(itemId, newPrice) {
        // Update ONLY the items list (temporary change, not saved to DB)
        setFoodItems((prevItems) =>
            prevItems.map((item) =>
                item.id === itemId ? { ...item, price: newPrice } : item
            )
        );
        
        // Also update cart if item is already in cart
        setCart((prevCart) =>
            prevCart.map((item) =>
                item.id === itemId ? { ...item, price: newPrice } : item
            )
        );
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
            setToast({ message: 'Please add items to your bill first.', type: 'warning' });
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
            billNumber: editMode ? originalBillId : 'PENDING',
            editMode: editMode,
            originalBillId: originalBillId
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

    const isBannerActive = editMode || creditCustomer;
    
    return (
        <div className={`billing-page ${isBannerActive ? 'with-banner' : ''}`}>
            <PageHeader 
                onNavigate={onNavigate} 
                backTo={editMode ? 'records' : (creditCustomer ? 'credits' : 'home')} 
            />

            {/* Edit Mode Banner */}
            {editMode && (
                <div className="edit-mode-banner">
                    <p><i className="fa-solid fa-pen-to-square"></i> Editing Bill #{originalBillId} - Make changes and print to update</p>
                </div>
            )}

            {/* Credit Customer Banner */}
            {creditCustomer && !editMode && (
                <div className="credit-banner">
                    <p><i className="fa-solid fa-file-pen"></i> Billing for Credit Customer: <strong>{creditCustomer.customerName}</strong></p>
                </div>
            )}



            {/* Search Bar */}
            <div className="search-section">
                <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
            </div>

            {/* Category Filter */}
            <div className="category-filter">
                {categories.map((category) => (
                    <button
                        key={category.id}
                        className={`category-btn ${selectedCategory === category.name ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(category.name)}
                    >
                        {category.name}
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <div className="billing-content">
                {/* Food Items Grid (Left 2/3) */}
                <div className={`food-items-section ${(creditCustomer || editMode) ? 'with-banner' : ''}`}>
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
                                    onPriceChange={handlePriceChange}
                                    isInCart={cart.some((cartItem) => cartItem.id === item.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Cart Section (Right 1/3) */}
                <div className={`cart-section ${isBannerActive ? 'with-banner' : ''}`}>
                    <Cart
                        cart={cart}
                        onUpdateQuantity={updateQuantity}
                        onRemoveItem={removeFromCart}
                        total={calculateTotal()}
                        onPrint={handlePrintBill}
                        className={isBannerActive ? 'with-banner' : ''}
                    />
                </div>
            </div>
            
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

export default BillingPage;
