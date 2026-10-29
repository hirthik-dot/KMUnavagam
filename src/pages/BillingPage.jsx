import { useState, useEffect } from 'react';
import FoodCard from '../components/FoodCard';
import Cart from '../components/Cart';
import SearchBar from '../components/SearchBar';
import PageHeader from '../components/PageHeader';
import Toast from '../components/Toast';
import SupplierModal from '../components/SupplierModal';
import { getTodayLocaleDate } from '../utils/DateUtils';
import { DISPLAY_LANGUAGE_SETTING_KEY, DEFAULT_DISPLAY_LANGUAGE } from '../utils/itemLanguage';
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
    const [suppliers, setSuppliers] = useState([]);
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    // Staff picked for this bill before going to preview (pre-selected when coming back)
    const [lastSupplierId, setLastSupplierId] = useState(null);
    // When editing a bill whose staff is no longer active serving staff, they stay selectable
    // (otherwise the edit would move the sale to someone else or clear the staff)
    const [originalStaff, setOriginalStaff] = useState(null);
    // Where to go after editing a bill: { page, data } (e.g. the credit customer page), default Records
    const [editReturnTo, setEditReturnTo] = useState(null);
    const [toast, setToast] = useState(null);
    const [billDate, setBillDate] = useState(getTodayLocaleDate());
    const [displayLanguage, setDisplayLanguage] = useState(DEFAULT_DISPLAY_LANGUAGE);

    // Load food items and categories when component mounts
    useEffect(() => {
        loadFoodItems();
        loadCategories();
        loadSuppliers();
        window.electronAPI.getSetting(DISPLAY_LANGUAGE_SETTING_KEY, DEFAULT_DISPLAY_LANGUAGE)
            .then((lang) => setDisplayLanguage(lang || DEFAULT_DISPLAY_LANGUAGE))
            .catch((err) => console.error('Error loading display language:', err));
    }, []);

    // Pre-fill cart when editing a bill or coming back from Print Preview
    useEffect(() => {
        if (creditCustomer?.cart) {
            setCart(creditCustomer.cart);
            if (creditCustomer.editMode) {
                setEditMode(true);
                setOriginalBillId(creditCustomer.originalBillId);
                setEditReturnTo(creditCustomer.returnTo || null);
            }
            if (creditCustomer.billDate) {
                setBillDate(creditCustomer.billDate);
            }
        }
    }, [creditCustomer]);

    // Staff shown in the picker: active serving staff, plus the edited bill's original staff if missing
    const pickerSuppliers = originalStaff && !suppliers.some((s) => s.id === originalStaff.id)
        ? [...suppliers, { ...originalStaff, label: `${originalStaff.name} (this bill's staff)` }]
        : suppliers;

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
                    item.name_tamil.includes(query) ||
                    (item.name_hindi && item.name_hindi.includes(query))
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
     * Load all active suppliers
     */
    async function loadSuppliers() {
        try {
            const activeSuppliers = await window.electronAPI.getAllSuppliers();
            setSuppliers(activeSuppliers);
        } catch (error) {
            console.error('Error loading suppliers:', error);
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
     * Print bill - opens supplier modal first
     */
    const handlePrintBill = async () => {
        if (cart.length === 0) {
            setToast({ message: 'Please add items to your bill first.', type: 'warning' });
            return;
        }

        // If no suppliers are added, skip modal and go straight to preview
        if (pickerSuppliers.length === 0) {
            confirmPrintWithSupplier(null);
        } else {
            setShowSupplierModal(true);
        }
    }

    /**
     * Proceed to preview after supplier selection
     */
    const confirmPrintWithSupplier = (supplier) => {
        setShowSupplierModal(false);
        const total = calculateTotal();

        // Format dateTime string from selected billDate
        const [year, month, day] = billDate.split('-');
        const selectedDate = new Date(year, month - 1, day);
        const now = new Date();
        // Combine selected date with current time
        selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
        
        const dateTime = selectedDate.toLocaleString('en-IN', {
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
            billDate: billDate, // YYYY-MM-DD
            customerName: customerName,
            creditCustomerId: customerId,
            supplierId: supplier?.id || null,
            supplierName: supplier?.name || null,
            billNumber: editMode ? originalBillId : 'PENDING',
            editMode: editMode,
            originalBillId: originalBillId,
            returnTo: editReturnTo
        };

        // Navigate to preview page
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

    // Credit bill only when a credit customer id is present (navData is also used to restore a cash bill's cart)
    const isCreditBill = !!creditCustomer?.creditCustomerId;
    const isBannerActive = editMode || isCreditBill;

    return (
        <div className={`billing-page ${isBannerActive ? 'with-banner' : ''}`}>
            <PageHeader
                onNavigate={editMode && editReturnTo ? () => onNavigate(editReturnTo.page, editReturnTo.data) : onNavigate}
                backTo={editMode ? 'records' : (isCreditBill ? 'credits' : 'home')}
            />

            {showSupplierModal && (
                <SupplierModal
                    suppliers={pickerSuppliers}
                    initialSupplierId={lastSupplierId}
                    onSelect={confirmPrintWithSupplier}
                    onCancel={() => setShowSupplierModal(false)}
                />
            )}

            {/* Edit Mode Banner */}
            {editMode && (
                <div className="edit-mode-banner">
                    <p><i className="fa-solid fa-pen-to-square"></i> Editing Bill #{originalBillId} - Make changes and print to update</p>
                    <div className="banner-date-picker">
                        <label>Bill Date:</label>
                        <input 
                            type="date" 
                            value={billDate} 
                            onChange={(e) => setBillDate(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* Credit Customer Banner */}
            {isCreditBill && !editMode && (
                <div className="credit-banner">
                    <p><i className="fa-solid fa-file-pen"></i> Billing for Credit Customer: <strong>{creditCustomer.customerName}</strong></p>
                    <div className="banner-date-picker">
                        <label>Bill Date:</label>
                        <input 
                            type="date" 
                            value={billDate} 
                            onChange={(e) => setBillDate(e.target.value)}
                        />
                    </div>
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
                <div className={`food-items-section ${(isCreditBill || editMode) ? 'with-banner' : ''}`}>
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
                            {filteredItems.map((item) => {
                                const cartItem = cart.find((ci) => ci.id === item.id);
                                return (
                                    <FoodCard
                                        key={item.id}
                                        item={item}
                                        onAddToCart={addToCart}
                                        onPriceChange={handlePriceChange}
                                        onUpdateQuantity={updateQuantity}
                                        isInCart={!!cartItem}
                                        quantity={cartItem ? cartItem.quantity : 0}
                                        displayLanguage={displayLanguage}
                                    />
                                );
                            })}
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
                        displayLanguage={displayLanguage}
                    />
                </div>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

export default BillingPage;
