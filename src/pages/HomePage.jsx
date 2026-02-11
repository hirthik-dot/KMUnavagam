import './HomePage.css';

/**
 * HOME PAGE
 * Simple entry page with large buttons for elderly users
 * White + Green theme, touch-friendly
 */
function HomePage({ onNavigate }) {
    return (
        <div className="home-page">
            <div className="home-container">
                {/* Header */}
                <div className="home-header">
                    <h1 className="home-title">KM Unavagam</h1>
                    <p className="home-subtitle">Hotel Billing System</p>
                </div>

                {/* Large Navigation Buttons */}
                <div className="home-buttons">
                    <button
                        className="home-btn home-btn-billing"
                        onClick={() => onNavigate('billing')}
                    >
                        <span className="btn-icon">📝</span>
                        <span className="btn-text">New Bill</span>
                    </button>

                    <button
                        className="home-btn home-btn-records"
                        onClick={() => onNavigate('records')}
                    >
                        <span className="btn-icon">📊</span>
                        <span className="btn-text">Records</span>
                    </button>

                    <button
                        className="home-btn home-btn-expenses"
                        onClick={() => onNavigate('expenses')}
                    >
                        <span className="btn-icon">💰</span>
                        <span className="btn-text">Expenses</span>
                    </button>

                    <button
                        className="home-btn home-btn-credits"
                        onClick={() => onNavigate('credits')}
                    >
                        <span className="btn-icon">🤝</span>
                        <span className="btn-text">Credits</span>
                    </button>

                    <button
                        className="home-btn home-btn-admin"
                        onClick={() => onNavigate('admin')}
                    >
                        <span className="btn-icon">⚙️</span>
                        <span className="btn-text">Admin</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default HomePage;
