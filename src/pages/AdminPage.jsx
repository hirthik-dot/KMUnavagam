import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import Footer from '../components/Footer';
import {
    PRINT_LANGUAGES,
    PRINT_LANGUAGE_SETTING_KEY,
    DEFAULT_PRINT_LANGUAGE,
    DISPLAY_LANGUAGE_SETTING_KEY,
    DEFAULT_DISPLAY_LANGUAGE,
} from '../utils/itemLanguage';
import './AdminPage.css';

function AdminPage({ onNavigate }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState(null);

    const [categories, setCategories] = useState([]);
    const [editingCategory, setEditingCategory] = useState(null);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [categoryFilter, setCategoryFilter] = useState('All');
    const [toast, setToast] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [printLanguage, setPrintLanguage] = useState(DEFAULT_PRINT_LANGUAGE);
    const [displayLanguage, setDisplayLanguage] = useState(DEFAULT_DISPLAY_LANGUAGE);
    // Staff Maintenance PIN lock (always on): whether a PIN exists yet, and the set/change form (null when hidden)
    const [staffLockEnabled, setStaffLockEnabled] = useState(false);
    const [pinForm, setPinForm] = useState(null);
    // Reset PIN form (asks for the reset password given by LancingHub); null when hidden
    const [resetForm, setResetForm] = useState(null);

    // Form state for NEW item
    const [formData, setFormData] = useState({
        nameTamil: '',
        nameEnglish: '',
        nameHindi: '',
        price: '',
        category: 'Other',
        imagePath: '',
    });

    // Form state for EDITING item (Modal)
    const [editFormData, setEditFormData] = useState({
        nameTamil: '',
        nameEnglish: '',
        nameHindi: '',
        price: '',
        category: 'Other',
        imagePath: '',
    });

    // Load data when component mounts
    useEffect(() => {
        loadItems();
        loadCategories();
        loadLanguageSettings();
        window.electronAPI.hasStaffPin().then(setStaffLockEnabled).catch(() => {});
    }, []);

    /**
     * Load default bill print language and screen display language
     */
    async function loadLanguageSettings() {
        try {
            const printLang = await window.electronAPI.getSetting(PRINT_LANGUAGE_SETTING_KEY, DEFAULT_PRINT_LANGUAGE);
            setPrintLanguage(printLang || DEFAULT_PRINT_LANGUAGE);
            const displayLang = await window.electronAPI.getSetting(DISPLAY_LANGUAGE_SETTING_KEY, DEFAULT_DISPLAY_LANGUAGE);
            setDisplayLanguage(displayLang || DEFAULT_DISPLAY_LANGUAGE);
        } catch (error) {
            console.error('Error loading language settings:', error);
        }
    }

    /**
     * Save screen display language (item names on Billing page and Cart)
     */
    async function handleDisplayLanguageChange(lang) {
        try {
            await window.electronAPI.setSetting(DISPLAY_LANGUAGE_SETTING_KEY, lang);
            setDisplayLanguage(lang);
            showToast('Display language saved!');
        } catch (error) {
            console.error('Error saving display language:', error);
            showToast('Failed to save display language.', 'error');
        }
    }

    /**
     * Save default bill print language
     */
    async function handlePrintLanguageChange(lang) {
        try {
            await window.electronAPI.setSetting(PRINT_LANGUAGE_SETTING_KEY, lang);
            setPrintLanguage(lang);
            showToast('Default print language saved!');
        } catch (error) {
            console.error('Error saving print language:', error);
            showToast('Failed to save print language.', 'error');
        }
    }

    /**
     * Load all food items (including inactive ones)
     */
    async function loadItems() {
        try {
            setLoading(true);
            const allItems = await window.electronAPI.getAllItemsAdmin();
            setItems(allItems);
        } catch (error) {
            console.error('Error loading items:', error);
            showToast('Failed to load items. Please restart the app.', 'error');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Show toast notification
     */
    function showToast(message, type = 'success') {
        setToast({ message, type });
    }

    /**
     * Load all categories
     */
    async function loadCategories() {
        try {
            const allCategories = await window.electronAPI.getAllCategories();
            setCategories(allCategories);
        } catch (error) {
            console.error('Error loading categories:', error);
            showToast('Failed to load categories.', 'error');
        }
    }

    /**
     * Add a new category
     */
    async function handleAddCategory() {
        if (!newCategoryName.trim()) {
            showToast('Please enter a category name!', 'warning');
            return;
        }

        try {
            await window.electronAPI.addCategory(newCategoryName.trim());
            setNewCategoryName('');
            loadCategories();
            showToast('Category added successfully!');
        } catch (error) {
            console.error('Error adding category:', error);
            showToast('Failed to add category. It may already exist.', 'error');
        }
    }

    /**
     * Update a category name
     */
    async function handleUpdateCategory(id, newName) {
        if (!newName.trim()) {
            showToast('Category name cannot be empty!', 'warning');
            return;
        }

        try {
            await window.electronAPI.updateCategory(id, newName.trim());
            setEditingCategory(null);
            loadCategories();
            // Reload items to show updated category names
            loadItems();
            showToast('Category updated successfully!');
        } catch (error) {
            console.error('Error updating category:', error);
            showToast('Failed to update category. Name may already exist.', 'error');
        }
    }

    /**
     * Delete a category
     */
    async function handleDeleteCategory(id, name) {
        setConfirmDialog({
            message: `Are you sure you want to delete "${name}"?\n\nAll items in this category will be moved to "Other".`,
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await window.electronAPI.deleteCategory(id);
                    loadCategories();
                    loadItems();
                    showToast('Category deleted successfully!');
                } catch (error) {
                    console.error('Error deleting category:', error);
                    showToast('Failed to delete category.', 'error');
                }
            },
            onCancel: () => setConfirmDialog(null)
        });
    }

    /**
     * Handle form input changes
     */
    function handleInputChange(e) {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    }

    /**
     * Handle edit form input changes
     */
    function handleEditInputChange(e) {
        const { name, value } = e.target;
        setEditFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    }

    /**
     * Handle image upload for Edit Modal
     */
    async function handleEditImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const imageData = event.target.result;
                const fileName = `food_${Date.now()}_${file.name}`;
                const savedPath = await window.electronAPI.saveImage(imageData, fileName);
                setEditFormData((prev) => ({
                    ...prev,
                    imagePath: savedPath,
                }));
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error uploading image:', error);
            showToast('Failed to upload image.', 'error');
        }
    }

    /**
     * Handle form submission (Add New Item Only)
     */
    async function handleSubmit(e) {
        e.preventDefault();

        // Validation
        if (!formData.nameTamil || !formData.nameEnglish || !formData.price) {
            showToast('Please fill in all required fields!', 'warning');
            return;
        }

        const price = parseFloat(formData.price);
        if (isNaN(price) || price <= 0) {
            showToast('Please enter a valid price!', 'warning');
            return;
        }

        try {
            // Add new item (will reactivate if same name found as inactive)
            await window.electronAPI.addItem(
                formData.nameTamil,
                formData.nameEnglish,
                price,
                formData.imagePath || null,
                formData.category,
                formData.nameHindi.trim() || null
            );
            showToast('Item added successfully!');

            // Reset form
            setFormData({
                nameTamil: '',
                nameEnglish: '',
                nameHindi: '',
                price: '',
                category: 'Other',
                imagePath: '',
            });

            // Reload items
            loadItems();
        } catch (error) {
            console.error('Error adding item:', error);
            // Show a user-friendly error — surface the actual reason if available
            const msg = error?.message || '';
            if (msg.toLowerCase().includes('already exists')) {
                showToast(msg, 'warning');
            } else {
                showToast('Failed to add item. Please try again.', 'error');
            }
        }
    }

    /**
     * Handle Edit Modal Submission
     */
    async function handleEditSubmit(e) {
        e.preventDefault();

        if (!editFormData.nameTamil || !editFormData.nameEnglish || !editFormData.price) {
            showToast('Please fill in all required fields!', 'warning');
            return;
        }

        const price = parseFloat(editFormData.price);
        if (isNaN(price) || price <= 0) {
            showToast('Please enter a valid price!', 'warning');
            return;
        }

        try {
            await window.electronAPI.updateItem(
                editingItem.id,
                editFormData.nameTamil,
                editFormData.nameEnglish,
                price,
                editFormData.imagePath || null,
                editFormData.category,
                editFormData.nameHindi.trim() || null
            );
            showToast('Item updated successfully!');
            setEditingItem(null);
            loadItems();
        } catch (error) {
            console.error('Error updating item:', error);
            showToast('Failed to update item.', 'error');
        }
    }

    /**
     * Start editing an item (Open Modal)
     */
    function handleEdit(item) {
        setEditingItem(item);
        setEditFormData({
            nameTamil: item.name_tamil,
            nameEnglish: item.name_english,
            nameHindi: item.name_hindi || '',
            price: item.price.toString(),
            category: item.category || 'Other',
            imagePath: item.image_path || '',
        });
    }

    /**
     * Cancel editing
     */
    function handleCancelEdit() {
        setEditingItem(null);
        setFormData({
            nameTamil: '',
            nameEnglish: '',
            nameHindi: '',
            price: '',
            category: 'Other',
            imagePath: '',
        });
    }

    /**
     * Toggle item active status
     */
    async function handleToggleStatus(item) {
        // Save scroll position before update
        const scrollY = window.scrollY;

        try {
            const newStatus = !item.is_active;
            await window.electronAPI.toggleItemStatus(item.id, newStatus);
            await loadItems();

            // Restore scroll position after state update
            requestAnimationFrame(() => {
                window.scrollTo(0, scrollY);
            });
        } catch (error) {
            console.error('Error toggling item status:', error);
            showToast('Failed to update item status.', 'error');
        }
    }

    /**
     * Delete an item
     */
    async function handleDelete(item) {
        setConfirmDialog({
            message: `Are you sure you want to delete "${item.name_english}"?\n\nNote: If this item was used in past bills, it will be disabled instead of permanently removed to protect bill history.`,
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await window.electronAPI.deleteItem(item.id);
                    showToast('Item deleted successfully!');
                    loadItems();
                } catch (error) {
                    console.error('Error deleting item:', error);
                    showToast('Failed to delete item.', 'error');
                }
            },
            onCancel: () => setConfirmDialog(null)
        });
    }

    const missingHindiCount = items.filter(item => item.is_active && !item.name_hindi).length;

    /**
     * Save a new Staff Maintenance PIN (set or change). Entered twice so a typo can't lock everyone out.
     */
    async function handleSavePin(e) {
        e.preventDefault();
        if (!/^\d{4,6}$/.test(pinForm.pin)) {
            showToast('PIN must be 4 to 6 digits.', 'warning');
            return;
        }
        if (pinForm.pin !== pinForm.confirm) {
            showToast('The two PINs do not match.', 'warning');
            return;
        }
        try {
            await window.electronAPI.setStaffPin(pinForm.pin, pinForm.current);
            setStaffLockEnabled(true);
            setPinForm(null);
            showToast('Staff Maintenance PIN saved!');
        } catch (error) {
            console.error('Error saving PIN:', error);
            showToast(/Current PIN is wrong/.test(error.message) ? 'Current PIN is wrong.' : 'Failed to save PIN.', 'error');
        }
    }

    // Forgotten PIN: with the reset password the PIN is cleared; the next visit asks to create a new one
    async function handleResetPin(e) {
        e.preventDefault();
        try {
            await window.electronAPI.resetStaffPin(resetForm.password);
            setStaffLockEnabled(false);
            setResetForm(null);
            showToast('PIN reset. A new PIN will be asked on the next visit to Staff Maintenance.');
        } catch (error) {
            console.error('Error resetting PIN:', error);
            showToast(/Reset password is wrong/.test(error.message) ? 'Reset password is wrong.' : 'Failed to reset PIN.', 'error');
        }
    }

    // Filter items based on category selection
    const filteredItems = categoryFilter === 'All'
        ? items
        : items.filter(item => item.category === categoryFilter);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Loading items...</p>
            </div>
        );
    }

    return (
        <div className="admin-page">
            <PageHeader onNavigate={onNavigate} backTo="home" />

            <div className="admin-page-content">
                {/* Add Form */}
                <div className="admin-form-section card">
                    <h2 className="section-title">
                        <i className="fas fa-plus-circle"></i> Add New Food Item
                    </h2>

                    <form onSubmit={handleSubmit} className="admin-form">
                        <div className="form-group">
                            <label htmlFor="nameTamil">Tamil Name *</label>
                            <input
                                type="text"
                                id="nameTamil"
                                name="nameTamil"
                                value={formData.nameTamil}
                                onChange={(e) => setFormData({ ...formData, nameTamil: e.target.value })}
                                placeholder="தோசை"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="nameEnglish">English Name *</label>
                            <input
                                type="text"
                                id="nameEnglish"
                                name="nameEnglish"
                                value={formData.nameEnglish}
                                onChange={(e) => setFormData({ ...formData, nameEnglish: e.target.value })}
                                placeholder="Dosa"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="nameHindi">Hindi Name (Optional)</label>
                            <input
                                type="text"
                                id="nameHindi"
                                name="nameHindi"
                                value={formData.nameHindi}
                                onChange={(e) => setFormData({ ...formData, nameHindi: e.target.value })}
                                placeholder="डोसा"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="price">Price (₹) *</label>
                            <input
                                type="number"
                                id="price"
                                name="price"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                placeholder="40"
                                step="0.01"
                                min="0"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="category">Category *</label>
                            <select
                                id="category"
                                name="category"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                required
                            >
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.name}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="imageUpload">Food Image (Optional)</label>
                            <div className="image-upload-container">
                                <input
                                    type="file"
                                    id="imageUpload"
                                    accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.svg"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = async (event) => {
                                            const savedPath = await window.electronAPI.saveImage(event.target.result, `food_${Date.now()}_${file.name}`);
                                            setFormData({ ...formData, imagePath: savedPath });
                                        };
                                        reader.readAsDataURL(file);
                                    }}
                                    style={{ display: 'none' }}
                                />
                                <button
                                    type="button"
                                    className="btn-upload"
                                    onClick={() => document.getElementById('imageUpload').click()}
                                >
                                    <i className="fa-solid fa-folder-open"></i> Choose Image
                                </button>
                                {formData.imagePath && (
                                    <span className="image-selected">✓ Image selected</span>
                                )}
                            </div>
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn-primary">
                                Add Item
                            </button>
                        </div>
                    </form>
                </div>

                {/* Category Management Section */}
                <div className="category-management-section card">
                    <h2 className="section-title">
                        <i className="fas fa-tags"></i> Manage Categories
                    </h2>

                    {/* Add New Category */}
                    <div className="add-category-form">
                        <input
                            type="text"
                            placeholder="New category name..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleAddCategory();
                                }
                            }}
                        />
                        <button className="btn-primary" onClick={handleAddCategory}>
                            <i className="fas fa-plus"></i> Add Category
                        </button>
                    </div>

                    {/* Category List */}
                    <div className="category-list">
                        {categories.map((category) => (
                            <div key={category.id} className="category-item">
                                {editingCategory === category.id ? (
                                    <div className="category-edit-container">
                                        <input
                                            type="text"
                                            id={`edit-cat-${category.id}`}
                                            defaultValue={category.name}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleUpdateCategory(category.id, e.target.value);
                                                }
                                                if (e.key === 'Escape') {
                                                    setEditingCategory(null);
                                                }
                                            }}
                                            autoFocus
                                        />
                                        <div className="category-actions">
                                            <button
                                                className="btn-success"
                                                onClick={() => {
                                                    const val = document.getElementById(`edit-cat-${category.id}`).value;
                                                    handleUpdateCategory(category.id, val);
                                                }}
                                            >
                                                <i className="fas fa-check"></i>
                                            </button>
                                            <button
                                                className="btn-secondary"
                                                onClick={() => setEditingCategory(null)}
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <span className="category-name" title={category.name}>
                                            <i className="fas fa-tag"></i> {category.name}
                                        </span>
                                        <div className="category-actions">
                                            <button
                                                className="btn-edit"
                                                onClick={() => setEditingCategory(category.id)}
                                            >
                                                <i className="fas fa-edit"></i> Edit
                                            </button>
                                            <button
                                                className="btn-delete"
                                                onClick={() => handleDeleteCategory(category.id, category.name)}
                                            >
                                                <i className="fas fa-trash"></i> Delete
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Language Settings Section (screen display + bill print) */}
                <div className="print-settings-section card">
                    <h2 className="section-title">
                        <i className="fas fa-language"></i> Item Name Language
                    </h2>

                    <h3 className="language-setting-title">Screen Display</h3>
                    <p className="print-settings-hint">
                        Language of the big item name on the Billing page and Cart. If an item has no Hindi name, it shows in English with Tamil underneath.
                    </p>
                    <div className="print-language-options">
                        {PRINT_LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                type="button"
                                className={`print-language-option ${displayLanguage === lang.code ? 'active' : ''}`}
                                onClick={() => handleDisplayLanguageChange(lang.code)}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>

                    {missingHindiCount > 0 && (
                        <p className="missing-hindi-note">
                            <i className="fas fa-circle-info"></i> {missingHindiCount} active item{missingHindiCount === 1 ? '' : 's'} {missingHindiCount === 1 ? 'has' : 'have'} no Hindi name yet. Add it with Edit on the item below.
                        </p>
                    )}

                    <h3 className="language-setting-title">Bill &amp; KOT Print</h3>
                    <p className="print-settings-hint">
                        Default language for item names on the bill and KOT. You can still change it for a single bill on the Print Preview screen. Items without a name in the chosen language print in English.
                    </p>
                    <div className="print-language-options">
                        {PRINT_LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                type="button"
                                className={`print-language-option ${printLanguage === lang.code ? 'active' : ''}`}
                                onClick={() => handlePrintLanguageChange(lang.code)}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Staff Maintenance Lock Section */}
                <div className="staff-lock-section card">
                    <h2 className="section-title">
                        <i className="fas fa-lock"></i> Staff Maintenance Lock
                    </h2>
                    <p className="print-settings-hint">
                        {staffLockEnabled
                            ? 'Staff Maintenance asks for the PIN every time it is opened. Forgot the PIN? Use Reset PIN with the reset password from LancingHub.'
                            : 'No PIN yet: it will be created the first time Staff Maintenance is opened (or set it here).'}
                    </p>

                    {resetForm ? (
                        <form className="pin-form" onSubmit={handleResetPin}>
                            <input
                                type="password"
                                autoFocus
                                placeholder="Reset password"
                                value={resetForm.password}
                                onChange={(e) => setResetForm({ password: e.target.value })}
                            />
                            <button type="submit" className="btn-primary" disabled={!resetForm.password.trim()}>Reset PIN</button>
                            <button type="button" className="btn-secondary" onClick={() => setResetForm(null)}>Cancel</button>
                        </form>
                    ) : pinForm ? (
                        <form className="pin-form" onSubmit={handleSavePin}>
                            {staffLockEnabled && (
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={6}
                                    autoFocus
                                    placeholder="Current PIN"
                                    value={pinForm.current}
                                    onChange={(e) => setPinForm({ ...pinForm, current: e.target.value.replace(/\D/g, '') })}
                                />
                            )}
                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength={6}
                                autoFocus={!staffLockEnabled}
                                placeholder="New PIN (4-6 digits)"
                                value={pinForm.pin}
                                onChange={(e) => setPinForm({ ...pinForm, pin: e.target.value.replace(/\D/g, '') })}
                            />
                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="Enter PIN again"
                                value={pinForm.confirm}
                                onChange={(e) => setPinForm({ ...pinForm, confirm: e.target.value.replace(/\D/g, '') })}
                            />
                            <button type="submit" className="btn-primary">Save PIN</button>
                            <button type="button" className="btn-secondary" onClick={() => setPinForm(null)}>Cancel</button>
                        </form>
                    ) : (
                        <div className="print-language-options">
                            <button type="button" className="print-language-option" onClick={() => setPinForm({ current: '', pin: '', confirm: '' })}>
                                <i className="fas fa-key"></i> {staffLockEnabled ? 'Change PIN' : 'Set PIN'}
                            </button>
                            {staffLockEnabled && (
                                <button type="button" className="print-language-option" onClick={() => setResetForm({ password: '' })}>
                                    <i className="fas fa-rotate-left"></i> Reset PIN
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Food Item Grid Section */}
                <div className="admin-items-section">
                    <div className="items-header">
                        <h2 className="section-title">Existing Items ({filteredItems.length})</h2>

                        <div className="filter-controls">
                            <label htmlFor="categoryFilter">Filter by Category:</label>
                            <select
                                id="categoryFilter"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="All">All Categories</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.name}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {filteredItems.length === 0 ? (
                        <div className="no-items card">
                            {categoryFilter === 'All' ? (
                                <p>No items found. Add your first item above!</p>
                            ) : (
                                <p>No items found in category "{categoryFilter}".</p>
                            )}
                        </div>
                    ) : (
                        <div className="items-grid">
                            {filteredItems.map((item) => (
                                <div
                                    key={item.id}
                                    className={`item-card card ${!item.is_active ? 'inactive' : ''} ${editingItem?.id === item.id ? 'editing' : ''}`}
                                >
                                    {/* Item Image Preview */}
                                    <div className="item-image-preview">
                                        {item.image_path ? (
                                            <img
                                                src={`media://${item.image_path}`}
                                                alt={item.name_english}
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.parentElement.innerHTML = '<div class="no-image-small">No Image</div>';
                                                }}
                                            />
                                        ) : (
                                            <div className="no-image-small">No Image</div>
                                        )}
                                    </div>

                                    {/* Item Info */}
                                    <div className="item-info">
                                        <h3 className="item-name-tamil">{item.name_tamil}</h3>
                                        <p className="item-name-english">{item.name_english}</p>
                                        {item.name_hindi && (
                                            <p className="item-name-english">{item.name_hindi}</p>
                                        )}
                                        <p className="item-price">₹{item.price.toFixed(2)}</p>
                                        <p className="item-category">
                                            <i className="fas fa-tag"></i> {item.category || 'Other'}
                                        </p>
                                        <p className="item-status">
                                            {item.is_active ? 'Active' : 'Inactive'}
                                        </p>
                                    </div>

                                    {/* Item Actions */}
                                    <div className="item-actions">
                                        <button
                                            className="btn-secondary"
                                            onClick={() => handleEdit(item)}
                                        >
                                            <i className="fa-solid fa-pen-to-square"></i> Edit
                                        </button>
                                        <button
                                            className={`btn-toggle ${item.is_active ? 'active' : 'inactive'}`}
                                            onClick={() => handleToggleStatus(item)}
                                        >
                                            {item.is_active ? 'Disable' : 'Enable'}
                                        </button>
                                        <button
                                            className="btn-danger"
                                            onClick={() => handleDelete(item)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirmDialog && <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={confirmDialog.onCancel} />}

            {/* Edit Item Modal */}
            {editingItem && (
                <div className="edit-modal-overlay" onClick={() => setEditingItem(null)}>
                    <div className="edit-modal-content card" onClick={(e) => e.stopPropagation()}>
                        <div className="edit-modal-header">
                            <h2 className="section-title">
                                <i className="fa-solid fa-pen-to-square"></i> Edit Food Item
                            </h2>
                            <button className="close-modal" onClick={() => setEditingItem(null)}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <form onSubmit={handleEditSubmit} className="admin-form">
                            <div className="form-group">
                                <label htmlFor="edit-nameTamil">Tamil Name *</label>
                                <input
                                    type="text"
                                    id="edit-nameTamil"
                                    name="nameTamil"
                                    value={editFormData.nameTamil}
                                    onChange={handleEditInputChange}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="edit-nameEnglish">English Name *</label>
                                <input
                                    type="text"
                                    id="edit-nameEnglish"
                                    name="nameEnglish"
                                    value={editFormData.nameEnglish}
                                    onChange={handleEditInputChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="edit-nameHindi">Hindi Name (Optional)</label>
                                <input
                                    type="text"
                                    id="edit-nameHindi"
                                    name="nameHindi"
                                    value={editFormData.nameHindi}
                                    onChange={handleEditInputChange}
                                    placeholder="डोसा"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="edit-price">Price (₹) *</label>
                                <input
                                    type="number"
                                    id="edit-price"
                                    name="price"
                                    value={editFormData.price}
                                    onChange={handleEditInputChange}
                                    step="0.01"
                                    min="0"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="edit-category">Category *</label>
                                <select
                                    id="edit-category"
                                    name="category"
                                    value={editFormData.category}
                                    onChange={handleEditInputChange}
                                    required
                                >
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.name}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="editImageUpload">Food Image (Optional)</label>
                                <div className="image-upload-container">
                                    <input
                                        type="file"
                                        id="editImageUpload"
                                        accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.svg"
                                        onChange={handleEditImageUpload}
                                        style={{ display: 'none' }}
                                    />
                                    <button
                                        type="button"
                                        className="btn-upload"
                                        onClick={() => document.getElementById('editImageUpload').click()}
                                    >
                                        <i className="fa-solid fa-folder-open"></i> Change Image
                                    </button>
                                    {editFormData.imagePath && (
                                        <span className="image-selected">✓ Image selected</span>
                                    )}
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="btn-primary">
                                    Update Item
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setEditingItem(null)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}

export default AdminPage;
