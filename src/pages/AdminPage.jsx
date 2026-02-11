import { useState, useEffect } from 'react';
import './AdminPage.css';

function AdminPage({ onNavigate }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        nameTamil: '',
        nameEnglish: '',
        price: '',
        imagePath: '',
    });

    // Load all items when component mounts
    useEffect(() => {
        loadItems();
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
            alert('Failed to load items. Please restart the app.');
        } finally {
            setLoading(false);
        }
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
            alert('Failed to upload image. Please try again.');
        }
    }

    /**
     * Handle form submission (Add or Update)
     */
    async function handleSubmit(e) {
        e.preventDefault();

        // Validation
        if (!formData.nameTamil || !formData.nameEnglish || !formData.price) {
            alert('Please fill in all required fields!');
            return;
        }

        const price = parseFloat(formData.price);
        if (isNaN(price) || price <= 0) {
            alert('Please enter a valid price!');
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
                    formData.imagePath || null
                );
                alert('Item updated successfully!');
                setEditingItem(null);
            } else {
                // Add new item
                await window.electronAPI.addItem(
                    formData.nameTamil,
                    formData.nameEnglish,
                    price,
                    formData.imagePath || null
                );
                alert('Item added successfully!');
            }

            // Reset form
            setFormData({
                nameTamil: '',
                nameEnglish: '',
                price: '',
                imagePath: '',
            });

            // Reload items
            loadItems();
        } catch (error) {
            console.error('Error saving item:', error);
            alert('Failed to save item. Please try again.');
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
            alert('Failed to update item status.');
        }
    }

    /**
     * Delete an item
     */
    async function handleDelete(item) {
        const confirmed = confirm(
            `Are you sure you want to delete "${item.name_english}"?\nThis action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            await window.electronAPI.deleteItem(item.id);
            alert('Item deleted successfully!');
            loadItems();
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Failed to delete item.');
        }
    }

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
            {/* Back Button */}
            {onNavigate && (
                <button className="back-btn-admin" onClick={() => onNavigate('home')}>
                    ← Back to Home
                </button>
            )}

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
                                📁 Choose Image
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
                                ✕ Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Existing Items List */}
            <div className="admin-items-section">
                <h2 className="section-title">Existing Items ({items.length})</h2>

                {items.length === 0 ? (
                    <div className="no-items card">
                        <p>No items found. Add your first item above!</p>
                    </div>
                ) : (
                    <div className="items-grid">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className={`item-card card ${!item.is_active ? 'inactive' : ''}`}
                            >
                                {/* Item Info */}
                                <div className="item-info">
                                    <h3 className="item-name-tamil">{item.name_tamil}</h3>
                                    <p className="item-name-english">{item.name_english}</p>
                                    <p className="item-price">₹{item.price.toFixed(2)}</p>
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
                                        ✏️ Edit
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
    );
}

export default AdminPage;
