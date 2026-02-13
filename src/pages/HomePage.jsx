import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Footer from '../components/Footer';
import './HomePage.css';

/**
 * HOME PAGE
 * Simple entry page with large buttons for elderly users
 * White + Green theme, touch-friendly
 */
function HomePage({ onNavigate }) {
    const [stats, setStats] = useState({
        cashSales: 0,
        creditSales: 0,
        totalExpenses: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTodayStats();
    }, []);

    async function loadTodayStats() {
        try {
            setLoading(true);
            const data = await window.electronAPI.getTodayStats();
            
            if (data) {
                setStats({
                    cashSales: data.cashSales || 0,
                    creditSales: data.creditSales || 0,
                    totalExpenses: data.totalExpenses || 0
                });
            }
        } catch (error) {
            console.error('Error loading today stats:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="home-page">
            <PageHeader showBack={false} />
            
            <div className="home-container">
                {/* Stats Cards */}
                <div className="home-stats">
                    <div className="stat-card stat-cash">
                        <div className="stat-label">Cash Sales</div>
                        <div className="stat-value">
                            {loading ? '...' : `₹${stats.cashSales}`}
                        </div>
                    </div>
                    
                    <div className="stat-card stat-credit">
                        <div className="stat-label">Credit Sales</div>
                        <div className="stat-value">
                            {loading ? '...' : `₹${stats.creditSales}`}
                        </div>
                    </div>
                    
                    <div className="stat-card stat-expenses">
                        <div className="stat-label">Total Expenses</div>
                        <div className="stat-value">
                            {loading ? '...' : `₹${stats.totalExpenses}`}
                        </div>
                    </div>
                </div>

                {/* Large Navigation Buttons */}
                <div className="home-buttons">
                    <button
                        className="home-btn home-btn-billing"
                        onClick={() => onNavigate('billing')}
                    >
                        <span className="btn-icon"><i className="fas fa-file-invoice"></i></span>
                        <span className="btn-text">New Bill</span>
                    </button>

                    <button
                        className="home-btn home-btn-records"
                        onClick={() => onNavigate('records')}
                    >
                        <span className="btn-icon"><i className="fas fa-chart-line"></i></span>
                        <span className="btn-text">Records</span>
                    </button>

                    <button
                        className="home-btn home-btn-expenses"
                        onClick={() => onNavigate('expenses')}
                    >
                        <span className="btn-icon"><i className="fas fa-wallet"></i></span>
                        <span className="btn-text">Expenses</span>
                    </button>

                    <button
                        className="home-btn home-btn-credits"
                        onClick={() => onNavigate('credits')}
                    >
                        <span className="btn-icon"><i className="fas fa-handshake"></i></span>
                        <span className="btn-text">Credits</span>
                    </button>

                    <button
                        className="home-btn home-btn-admin"
                        onClick={() => onNavigate('admin')}
                    >
                        <span className="btn-icon"><i className="fas fa-cog"></i></span>
                        <span className="btn-text">Admin</span>
                    </button>
                </div>
            </div>
            
            <Footer />
        </div>
    );
}

export default HomePage;
