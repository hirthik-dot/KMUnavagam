import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import Footer from '../components/Footer';
import { formatToDisplayDate, getTodayLocaleDate } from '../utils/DateUtils';
import './StaffPage.css';

function StaffPage({ onNavigate }) {
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);

    const [staffList, setStaffList] = useState([]);
    const [selectedStaffDetail, setSelectedStaffDetail] = useState(null);
    const [showAddStaffForm, setShowAddStaffForm] = useState(false);
    const [showEditStaffForm, setShowEditStaffForm] = useState(false);
    const [newStaff, setNewStaff] = useState({ name: '' });
    const [editingStaff, setEditingStaff] = useState(null);

    // Absent (one employee) / Shop holiday (everyone) date picker: { type: 'ABSENT' | 'HOLIDAY', date }
    const [skipForm, setSkipForm] = useState(null);

    const [showTransactionForm, setShowTransactionForm] = useState(false);
    const [transactionType, setTransactionType] = useState('WAGE'); // 'WAGE' or 'PAYMENT'
    const [transAmount, setTransAmount] = useState('');
    const [transDesc, setTransDesc] = useState('');
    const [editingTransactionId, setEditingTransactionId] = useState(null);
    const [transDate, setTransDate] = useState(getTodayLocaleDate());

    useEffect(() => {
        loadStaff(false);
    }, []);

    async function loadStaff(showInactive) {
        try {
            const data = await window.electronAPI.getStaffList(showInactive);
            setStaffList(data || []);
        } catch (error) {
            console.error('Error loading staff:', error);
        }
    }

    async function loadStaffDetails(id) {
        setIsLoading(true);
        try {
            const data = await window.electronAPI.getStaffDetails(id);
            setSelectedStaffDetail(data);
        } catch (error) {
            console.error('Error loading staff details:', error);
        } finally {
            setIsLoading(false);
        }
    }

    // Returns the wage settings to save, or null (with a warning) if auto wage is on without an amount
    const readWageSettings = (staff) => {
        const dailyWage = parseFloat(staff.daily_wage) || 0;
        const autoWage = !!staff.auto_wage;
        if (autoWage && dailyWage <= 0) {
            setToast({ message: 'Enter a daily wage to turn on auto wage', type: 'warning' });
            return null;
        }
        return { dailyWage, autoWage, wageStartDate: staff.wage_start_date || null };
    };

    const handleAddStaff = async (e) => {
        e.preventDefault();
        if (!newStaff.name.trim()) return;
        const wage = readWageSettings(newStaff);
        if (!wage) return;
        try {
            await window.electronAPI.addEmployee(newStaff.name, 0);
            setNewStaff({ name: '' });
            setShowAddStaffForm(false);
            loadStaff(false);
            setToast({ message: '✅ Employee added successfully', type: 'success' });
        } catch (error) {
            setToast({ message: '❌ Failed to add employee', type: 'error' });
        }
    };

    const handleUpdateStaff = async (e) => {
        e.preventDefault();
        if (!editingStaff.name.trim()) return;
        const wage = readWageSettings(editingStaff);
        if (!wage) return;
        try {
            await window.electronAPI.updateEmployee(
                editingStaff.id, 
                editingStaff.name, 
                0, 
                editingStaff.is_active
            );
            setShowEditStaffForm(false);
            setEditingStaff(null);
            loadStaff(false);
            if (selectedStaffDetail?.id === editingStaff.id) {
                loadStaffDetails(editingStaff.id);
            }
            setToast({ message: '✅ Employee updated successfully', type: 'success' });
        } catch (error) {
            setToast({ message: '❌ Failed to update employee', type: 'error' });
        }
    };

    const handleDeleteStaff = (e, staff) => {
        e.stopPropagation();
        setConfirmDialog({
            message: `Are you sure you want to delete ${staff.name}? This will hide them from all records but keep their transaction history.`,
            onConfirm: async () => {
                try {
                    await window.electronAPI.deleteEmployee(staff.id);
                    setToast({ message: '✅ Employee deleted', type: 'success' });
                    loadStaff(false);
                    setSelectedStaffDetail(null);
                } catch (error) {
                    setToast({ message: '❌ Failed to delete employee', type: 'error' });
                } finally {
                    setConfirmDialog(null);
                }
            },
            onCancel: () => setConfirmDialog(null)
        });
    };

    const handleSaveTransaction = async (e) => {
        e.preventDefault();
        const amt = parseFloat(transAmount);
        if (isNaN(amt) || amt <= 0) return;

        try {
            if (editingTransactionId) {
                await window.electronAPI.updateStaffTransaction(editingTransactionId, amt, transDesc, transDate);
                setToast({ message: '✅ Record updated', type: 'success' });
            } else {
                await window.electronAPI.addStaffTransaction(selectedStaffDetail.id, amt, transactionType, transDesc, transDate);
                setToast({ message: '✅ Record added', type: 'success' });
            }
            loadStaffDetails(selectedStaffDetail.id);
            loadStaff();
            setTransAmount('');
            setTransDesc('');
            setEditingTransactionId(null);
            setShowTransactionForm(false);
        } catch (error) {
            setToast({ message: '❌ Failed to save', type: 'error' });
        }
    };

    const handleDeleteTransaction = (transactionId) => {
        setConfirmDialog({
            message: 'Delete this record? If it was a payment, the daily expense will also be removed.',
            onConfirm: async () => {
                try {
                    await window.electronAPI.deleteStaffTransaction(transactionId);
                    setToast({ message: '✅ Record deleted', type: 'success' });
                    if (selectedStaffDetail) {
                        loadStaffDetails(selectedStaffDetail.id);
                    }
                    loadStaff();
                } catch (error) {
                    setToast({ message: '❌ Failed to delete', type: 'error' });
                } finally {
                    setConfirmDialog(null);
                }
            },
            onCancel: () => setConfirmDialog(null)
        });
    };

    const handleEditTransaction = (t) => {
        setEditingTransactionId(t.id);
        setTransactionType(t.type);
        setTransAmount(t.amount.toString());
        setTransDesc(t.description || '');
        setTransDate(t.transaction_date);
        setShowTransactionForm(true);
    };

    return (
        <div className="staff-page">
            <PageHeader onNavigate={onNavigate} backTo="home" />

            <div className="staff-container">
                {!selectedStaffDetail ? (
                    <div className="staff-list-view">
                        <div className="view-header">
                            <div className="header-info">
                                <h1 className="view-title"><i className="fas fa-user-tie"></i> Employee List</h1>
                                <p className="view-subtitle">Manage wages and salary records</p>
                            </div>
                            <div className="header-actions">
                                <button className="add-btn holiday-btn" onClick={() => setSkipForm({ type: 'HOLIDAY', date: getTodayLocaleDate() })}>
                                    <i className="fas fa-umbrella-beach"></i> Shop Holiday
                                </button>
                                <button className="add-btn" onClick={() => setShowAddStaffForm(true)}>+ New Employee</button>
                            </div>
                        </div>

                        {staffList.length === 0 ? (
                            <div className="no-data">
                                <i className="fas fa-users-slash no-data-icon"></i>
                                <p>No employees found.</p>
                            </div>
                        ) : (
                            <div className="table-wrapper">
                                <table className="staff-table">
                                    <thead>
                                        <tr>
                                            <th>Status</th>
                                            <th>Employee Name</th>
                                            <th>Daily Wage</th>
                                            <th className="text-right">Total Payable (₹)</th>
                                            <th className="text-center">Manage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffList.map(s => (
                                            <tr key={s.id} className={`clickable-row ${s.is_active ? '' : 'inactive'}`} onClick={() => loadStaffDetails(s.id)}>
                                                <td className="status-cell">
                                                    <span className={`status-dot ${s.is_active ? 'active' : 'disabled'}`}></span>
                                                </td>
                                                <td className="name-cell">
                                                    {s.name}
                                                    {!s.is_active && <span className="discharged-tag">Discharged</span>}
                                                </td>
                                                <td className={`amount-cell balance text-right ${s.balance > 0 ? 'pending' : ''}`}>
                                                    ₹{s.balance?.toLocaleString()}
                                                </td>
                                                <td className="text-center actions-column" onClick={(e) => e.stopPropagation()}>
                                                    <button className="icon-btn edit" onClick={() => { setEditingStaff({ ...s }); setShowEditStaffForm(true); }}>
                                                        <i className="fas fa-user-edit"></i>
                                                    </button>
                                                    <button className="icon-btn delete" onClick={(e) => handleDeleteStaff(e, s)}>
                                                        <i className="fas fa-user-minus"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="staff-detail-view">
                        <div className="detail-nav">
                            <button className="back-to-list-btn" onClick={() => setSelectedStaffDetail(null)}>
                                <i className="fas fa-arrow-left"></i> Back to List
                            </button>
                            <div className="detail-header-actions">
                                <button className="icon-btn edit big" onClick={() => { setEditingStaff({ ...selectedStaffDetail }); setShowEditStaffForm(true); }}>
                                    <i className="fas fa-user-edit"></i> Edit Info
                                </button>
                                <button className="icon-btn delete big" onClick={(e) => handleDeleteStaff(e, selectedStaffDetail)}>
                                    <i className="fas fa-trash-alt"></i> Delete
                                </button>
                            </div>
                        </div>

                        <div className="detail-header-card">
                            <div className="staff-main-info">
                                <h1 className="staff-name">
                                    {selectedStaffDetail.name}
                                    {!selectedStaffDetail.is_active && <span className="discharged-tag big">Discharged</span>}
                                </h1>
                            </div>
                            <div className="staff-balance-card">
                                <span className="bal-label">Total Payable</span>
                                <h2 className={`bal-value ${selectedStaffDetail.balance > 0 ? 'pending' : ''}`}>
                                    ₹{selectedStaffDetail.balance?.toLocaleString()}
                                </h2>
                            </div>
                        </div>

                        <div className="detail-actions">
                            <button className="action-btn wage-btn" onClick={() => { 
                                setTransactionType('WAGE'); 
                                setEditingTransactionId(null); 
                                setTransAmount(''); 
                                setTransDesc('Daily Wage'); 
                                setTransDate(getTodayLocaleDate());
                                setShowTransactionForm(true); 
                            }}>
                                <i className="fas fa-clock"></i> Add Wage
                            </button>
                            <button className="action-btn pay-btn" onClick={() => { 
                                setTransactionType('PAYMENT'); 
                                setEditingTransactionId(null); 
                                setTransAmount(''); 
                                setTransDesc('Advance / Salary'); 
                                setTransDate(getTodayLocaleDate());
                                setShowTransactionForm(true); 
                            }}>
                                <i className="fas fa-hand-holding-dollar"></i> Give Cash
                            </button>
                            <button className="action-btn settle-btn" disabled={selectedStaffDetail.balance <= 0} onClick={() => { 
                                setTransactionType('PAYMENT'); 
                                setEditingTransactionId(null); 
                                setTransAmount(selectedStaffDetail.balance.toString()); 
                                setTransDesc('Salary Settlement'); 
                                setTransDate(getTodayLocaleDate());
                                setShowTransactionForm(true); 
                            }}>
                                <i className="fas fa-check-double"></i> Settle All
                            </button>
                            {selectedStaffDetail.auto_wage === 1 && (
                                <button className="action-btn absent-btn" onClick={() => setSkipForm({ type: 'ABSENT', date: getTodayLocaleDate() })}>
                                    <i className="fas fa-user-slash"></i> Mark Absent
                                </button>
                            )}
                        </div>

                        <div className="history-section">
                            <h3 className="section-title">Wage & Payment History</h3>
                            <div className="table-wrapper">
                                <table className="history-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th>Description</th>
                                            <th>Amount</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyRows.map(({ skip: s, transaction: t }) => s ? (
                                            // Absent / holiday day: no wage, can be undone
                                            <tr key={`skip-${s.skip_date}`} className="skip-row">
                                                <td>{formatToDisplayDate(s.skip_date)}</td>
                                                <td>
                                                    <span className={`type-badge ${s.reason === 'ABSENT' ? 'absent' : 'holiday'}`}>
                                                        {s.reason === 'ABSENT' ? 'Absent' : 'Holiday'}
                                                    </span>
                                                </td>
                                                <td>No wage for this day</td>
                                                <td>-</td>
                                                <td>
                                                    <div className="actions-cell">
                                                        <button className="icon-btn edit" title="Undo — add the wage back" onClick={() => handleRemoveSkip(s)}>
                                                            <i className="fas fa-rotate-left"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr key={t.id}>
                                                <td>{formatToDisplayDate(t.transaction_date)}</td>
                                                <td>
                                                    <span className={`type-badge ${t.type === 'WAGE' ? 'wage' : 'payment'}`}>
                                                        {t.type === 'WAGE' ? 'Earned' : 'Received'}
                                                    </span>
                                                </td>
                                                <td>{t.description || '-'}</td>
                                                <td className={t.type === 'WAGE' ? 'amt-wage' : 'amt-payment'}>
                                                    ₹{t.amount.toLocaleString()}
                                                </td>
                                                <td>
                                                    <div className="actions-cell">
                                                        <button className="icon-btn edit" onClick={() => handleEditTransaction(t)}><i className="fas fa-edit"></i></button>
                                                        <button className="icon-btn delete" onClick={() => handleDeleteTransaction(t.id)}><i className="fas fa-trash"></i></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS */}
            {showAddStaffForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <button type="button" className="modal-close-btn" title="Close" onClick={() => setShowAddStaffForm(false)}>
                            <i className="fas fa-xmark"></i>
                        </button>
                        <h2>Add New Employee</h2>
                        <form onSubmit={handleAddStaff}>
                            <div className="form-group">
                                <label>Full Name</label>
                                <input type="text" required value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} autoFocus />
                            </div>
                            {renderWageFields(newStaff, setNewStaff)}
                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setShowAddStaffForm(false)}>Cancel</button>
                                <button type="submit" className="btn-save">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showEditStaffForm && editingStaff && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <button type="button" className="modal-close-btn" title="Close" onClick={() => { setShowEditStaffForm(false); setEditingStaff(null); }}>
                            <i className="fas fa-xmark"></i>
                        </button>
                        <h2>Edit Employee Information</h2>
                        <form onSubmit={handleUpdateStaff}>
                             <div className="form-group">
                                <label>Full Name</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={editingStaff.name} 
                                    onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })} 
                                />
                            </div>
                            {renderWageFields(editingStaff, setEditingStaff)}
                            <div className="form-group">
                                <label className="chk-label">
                                    <input 
                                        type="checkbox" 
                                        className="status-chk"
                                        checked={editingStaff.is_active === 1 || editingStaff.is_active === true} 
                                        onChange={(e) => setEditingStaff({ ...editingStaff, is_active: e.target.checked })} 
                                    />
                                    Employee is Active
                                </label>
                                <p className="help-text">Uncheck to discharge/disable this employee.</p>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => { setShowEditStaffForm(false); setEditingStaff(null); }}>Cancel</button>
                                <button type="submit" className="btn-save">Update Info</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {skipForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <button type="button" className="modal-close-btn" title="Close" onClick={() => setSkipForm(null)}>
                            <i className="fas fa-xmark"></i>
                        </button>
                        <h2>{skipForm.type === 'ABSENT' ? `Mark ${selectedStaffDetail?.name} Absent` : 'Shop Holiday'}</h2>
                        <p className="help-text skip-help">
                            {skipForm.type === 'ABSENT'
                                ? 'No daily wage will be added for this day. If it was already added, it is removed.'
                                : 'No daily wage for any employee on auto wage for this day. Already added wages for the day are removed.'}
                        </p>
                        <form onSubmit={handleSaveSkip}>
                            <div className="form-group">
                                <label>Date</label>
                                <input type="date" required value={skipForm.date} onChange={(e) => setSkipForm({ ...skipForm, date: e.target.value })} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setSkipForm(null)}>Cancel</button>
                                <button type="submit" className="btn-save">{skipForm.type === 'ABSENT' ? 'Mark Absent' : 'Mark Holiday'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showTransactionForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <button type="button" className="modal-close-btn" title="Close" onClick={() => { setShowTransactionForm(false); setEditingTransactionId(null); }}>
                            <i className="fas fa-xmark"></i>
                        </button>
                        <h2>{editingTransactionId ? 'Edit Entry' : (transactionType === 'WAGE' ? 'Add Wage' : 'Give Cash')}</h2>
                        <form onSubmit={handleSaveTransaction}>
                            <div className="form-group">
                                <label>Amount (₹)</label>
                                <input type="number" required value={transAmount} onChange={(e) => setTransAmount(e.target.value)} autoFocus />
                            </div>
                            <div className="form-group">
                                <label>Notes / Description</label>
                                <input type="text" value={transDesc} onChange={(e) => setTransDesc(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Date</label>
                                <input type="date" value={transDate} onChange={(e) => setTransDate(e.target.value)} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => { setShowTransactionForm(false); setEditingTransactionId(null); }}>Cancel</button>
                                <button type="submit" className="btn-save">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmDialog && <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={confirmDialog.onCancel} />}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <Footer />
        </div>
    );
}

export default StaffPage;
