import { useState, useEffect } from 'react';
import { formatToDisplayDate } from '../utils/DateUtils';
import './PendingWagesModal.css';
import { formatMoney } from '../utils/money';

/**
 * PENDING WAGES MODAL
 * Shown on app start when the app was not opened on some days.
 * The user picks which of those days staff actually worked; only those get auto daily wages.
 */
function PendingWagesModal() {
    const [pendingDays, setPendingDays] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        window.electronAPI.getPendingWageDays()
            .then((days) => {
                setPendingDays(days || []);
                setSelected(new Set((days || []).map((d) => d.date)));
            })
            .catch((err) => console.error('Error checking pending wage days:', err));
    }, []);

    if (pendingDays.length === 0) return null;

    const toggle = (date) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date); else next.add(date);
            return next;
        });
    };

    const resolve = async (dates) => {
        setIsSaving(true);
        try {
            await window.electronAPI.resolvePendingWageDays(dates);
            setPendingDays([]);
        } catch (error) {
            console.error('Error saving pending wage days:', error);
            setIsSaving(false);
        }
    };

    const selectedTotal = pendingDays
        .filter((d) => selected.has(d.date))
        .reduce((sum, d) => sum + d.total, 0);

    return (
        <div className="pending-wages-overlay">
            <div className="pending-wages-modal">
                <h2><i className="fas fa-calendar-check"></i> Add Missed Daily Wages?</h2>
                <p className="pending-wages-intro">
                    The app was not opened on {pendingDays.length === 1 ? 'this day' : 'these days'}.
                    Tick the days staff worked — daily wages will be added only for those.
                </p>

                <div className="pending-wages-list">
                    {pendingDays.map((d) => (
                        <label key={d.date} className={`pending-wages-row ${selected.has(d.date) ? 'checked' : ''}`}>
                            <input type="checkbox" checked={selected.has(d.date)} onChange={() => toggle(d.date)} />
                            <span className="pending-wages-date">
                                {formatToDisplayDate(d.date)}
                                <small>{new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' })}</small>
                            </span>
                            <span className="pending-wages-amount">
                                {d.employees} staff · ₹{formatMoney(d.total, { grouping: true })}
                            </span>
                        </label>
                    ))}
                </div>

                <div className="pending-wages-actions">
                    <button className="pending-wages-skip" onClick={() => resolve([])} disabled={isSaving}>
                        Skip All (No Wages)
                    </button>
                    <button
                        className="pending-wages-add"
                        onClick={() => resolve([...selected])}
                        disabled={isSaving || selected.size === 0}
                    >
                        Add Wages for {selected.size} Day{selected.size === 1 ? '' : 's'} (₹{formatMoney(selectedTotal, { grouping: true })})
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PendingWagesModal;
