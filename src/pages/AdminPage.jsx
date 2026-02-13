import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import Footer from '../components/Footer';
import './AdminPage.css';

function AdminPage({ onNavigate }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState(null);

    const [categories, setCategories] = useState([]);
    const [editingCategory, setEditingCategory] = useState(null);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [suppliers, setSuppliers] = useState([]);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [newSupplierName, setNewSupplierName] = useState('');

    const [categoryFilter, setCategoryFilter] = useState('All');
    const [toast, setToast] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        nameTamil: '',
        nameEnglish: '',
        price: '',
        category: 'Breakfast',
        imagePath: '',
    });

    // Load data when component mounts
    useEffect(() => {
        loadItems();
        loadCategories();
        loadSuppliers();
    }, []);

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
     * Load all suppliers
     */
    async function loadSuppliers() {
        try {
            const allSuppliers = await window.electronAPI.getAllSuppliersAdmin();
            setSuppliers(allSuppliers);
        } catch (error) {
            console.error('Error loading suppliers:', error);
            showToast('Failed to load suppliers.', 'error');
        }
    }

    /**
     * Add a new supplier
     */
    async function handleAddSupplier() {
        if (!newSupplierName.trim()) {
            showToast('Please enter a supplier name!', 'warning');
            return;
        }

        try {
            await window.electronAPI.addSupplier(newSupplierName.trim());
            setNewSupplierName('');
            loadSuppliers();
            showToast('Supplier added successfully!');
        } catch (error) {
            console.error('Error adding supplier:', error);
            showToast('Failed to add supplier.', 'error');
        }
    }

    /**
     * Update a supplier
     */
    async function handleUpdateSupplier(id, newName, isActive) {
        if (!newName.trim()) {
            showToast('Supplier name cannot be empty!', 'warning');
            return;
        }

        try {
            await window.electronAPI.updateSupplier(id, newName.trim(), isActive);
            setEditingSupplier(null);
            loadSuppliers();
            showToast('Supplier updated successfully!');
        } catch (error) {
            console.error('Error updating supplier:', error);
            showToast('Failed to update supplier.', 'error');
        }
    }

    /**
     * Delete a supplier
     */
    async function handleDeleteSupplier(id, name) {
        setConfirmDialog({
            message: `Are you sure you want to delete "${name}"?`,
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await window.electronAPI.deleteSupplier(id);
                    loadSuppliers();
                    showToast('Supplier deleted successfully!');
                } catch (error) {
                    console.error('Error deleting supplier:', error);
                    showToast('Failed to delete supplier.', 'error');
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
     * Handle image file selection
     */
    async function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Read file as base64
            const reader = new FileReader();
            reader.onload = async (event) => {
                const imageData = event.target.result;
                const fileName = `food_${Date.now()}_${file.name}`;

                // Save image via Electron
                const savedPath = await window.electronAPI.saveImage(imageData, fileName);

                // Update form data with saved path
                setFormData((prev) => ({
                    ...prev,
                    imagePath: savedPath,
                }));
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error uploading image:', error);
            showToast('Failed to upload image. Please try again.', 'error');
        }
    }

    /**
     * Handle form submission (Add or Update)
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
            if (editingItem) {
                // Update existing item
                await window.electronAPI.updateItem(
                    editingItem.id,
                    formData.nameTamil,
                    formData.nameEnglish,
                    price,
                    formData.imagePath || null,
                    formData.category
                );
                showToast('Item updated successfully!');
                setEditingItem(null);
            } else {
                // Add new item
                await window.electronAPI.addItem(
                    formData.nameTamil,
                    formData.nameEnglish,
                    price,
                    formData.imagePath || null,
                    formData.category
                );
                showToast('Item added successfully!');
            }

            // Reset form
            setFormData({
                nameTamil: '',
                nameEnglish: '',
                price: '',
                category: 'Breakfast',
                imagePath: '',
            });

            // Reload items
            loadItems();
        } catch (error) {
            console.error('Error saving item:', error);
            showToast('Failed to save item. Please try again.', 'error');
        }
    }

    /**
     * Start editing an item
     */
    function handleEdit(item) {
        setEditingItem(item);
        setFormData({
            nameTamil: item.name_tamil,
            nameEnglish: item.name_english,
            price: item.price.toString(),
            category: item.category || 'Breakfast',
            imagePath: item.image_path || '',
        });
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * Cancel editing
     */
    function handleCancelEdit() {
        setEditingItem(null);
        setFormData({
            nameTamil: '',
            nameEnglish: '',
            price: '',
            category: 'Breakfast',
            imagePath: '',
        });
    }

    /**
     * Toggle item active status
     */
    async function handleToggleStatus(item) {
        try {
            const newStatus = !item.is_active;
            await window.electronAPI.toggleItemStatus(item.id, newStatus);
            loadItems();
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
            message: `Are you sure you want to delete "${item.name_english}"?\nThis action cannot be undone.`,
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
                {/* Add/Edit Form */}
                <div className="admin-form-section card">
                <h2 className="section-title">
                    {editingItem ? 'Edit Food Item' : 'Add New Food Item'}
                </h2>

                <form onSubmit={handleSubmit} className="admin-form">
                    <div className="form-group">
                        <label htmlFor="nameTamil">Tamil Name *</label>
                        <input
                            type="text"
                            id="nameTamil"
                            name="nameTamil"
                            value={formData.nameTamil}
                            onChange={handleInputChange}
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
                            onChange={handleInputChange}
                            placeholder="Dosa"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="price">Price (₹) *</label>
                        <input
                            type="number"
                            id="price"
                            name="price"
                            value={formData.price}
                            onChange={handleInputChange}
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
                            onChange={handleInputChange}
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
                                onChange={handleImageUpload}
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
                        <p className="form-hint">
                            Click to select an image from your computer (JPG, PNG, etc.)
                        </p>
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn-primary">
                            {editingItem ? 'Update Item' : 'Add Item'}
                        </button>
                        {editingItem && (
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={handleCancelEdit}
                            >
                                <i className="fa-solid fa-xmark"></i> Cancel
                            </button>
                        )}
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
                                    <span className="category-name">
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

                {/* Staff Management Section */}
                <div className="staff-management-section card">
                    <h2 className="section-title">
                        <i className="fas fa-user-tie"></i> Manage Service Staff
                    </h2>

                    {/* Add New Staff */}
                    <div className="add-category-form">
                        <input
                            type="text"
                            placeholder="Staff name..."
                            value={newSupplierName}
                            onChange={(e) => setNewSupplierName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleAddSupplier();
                                }
                            }}
                        />
                        <button className="btn-primary" onClick={handleAddSupplier}>
                            <i className="fas fa-plus"></i> Add Staff
                        </button>
                    </div>

                    {/* Staff List */}
                    <div className="category-list">
                        {suppliers.map((supplier) => (
                            <div key={supplier.id} className="category-item">
                                {editingSupplier === supplier.id ? (
                                    <div className="category-edit-container">
                                        <input
                                            type="text"
                                            id={`edit-staff-${supplier.id}`}
                                            defaultValue={supplier.name}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleUpdateSupplier(supplier.id, e.target.value, supplier.is_active);
                                                }
                                                if (e.key === 'Escape') {
                                                    setEditingSupplier(null);
                                                }
                                            }}
                                            autoFocus
                                        />
                                        <div className="category-actions">
                                            <button
                                                className="btn-success"
                                                onClick={() => {
                                                    const val = document.getElementById(`edit-staff-${supplier.id}`).value;
                                                    handleUpdateSupplier(supplier.id, val, supplier.is_active);
                                                }}
                                            >
                                                <i className="fas fa-check"></i>
                                            </button>
                                            <button
                                                className="btn-secondary"
                                                onClick={() => setEditingSupplier(null)}
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <span className={`category-name ${!supplier.is_active ? 'inactive-text' : ''}`}>
                                            <i className="fas fa-user"></i> {supplier.name} {!supplier.is_active && '(Inactive)'}
                                        </span>
                                        <div className="category-actions">
                                            <button
                                                className={`btn-toggle ${supplier.is_active ? 'active' : 'inactive'}`}
                                                onClick={() => handleUpdateSupplier(supplier.id, supplier.name, !supplier.is_active)}
                                                title={supplier.is_active ? 'Deactivate' : 'Activate'}
                                            >
                                                <i className={`fas fa-${supplier.is_active ? 'eye' : 'eye-slash'}`}></i>
                                            </button>
                                            <button
                                                className="btn-edit"
                                                onClick={() => setEditingSupplier(supplier.id)}
                                            >
                                                <i className="fas fa-edit"></i> Edit
                                            </button>
                                            <button
                                                className="btn-delete"
                                                onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
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
                                    className={`item-card card ${!item.is_active ? 'inactive' : ''}`}
                                >
                                    {/* Item Info */}
                                    <div className="item-info">
                                        <h3 className="item-name-tamil">{item.name_tamil}</h3>
                                        <p className="item-name-english">{item.name_english}</p>
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
            
            <Footer />
        </div>
    );
}

export default AdminPage;
